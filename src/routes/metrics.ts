/**
 * Metrics API routes for invitation data processing and retrieval.
 * Implements UniPile-style ingestion with idempotent storage and daily rollups.
 */

import { Request, Response } from 'express';
import { mockFetchInvitations } from '../unipile/mock';
import {
  writeRawInvitations,
  queryInvitationsByDateRange,
  writeDailyRollups,
  getTotalInvitationsInPeriod,
  RawInvitation
} from '../lib/firestore';
import { 
  isValidISODate, 
  eachDayInclusive, 
  addDaysUTC, 
  fromISODateUTC, 
  toISODateUTC 
} from '../lib/date';

// Response types
interface MetricDataPoint {
  date: string;
  value: number;
  status: 'ok';
  previousPeriodComparison?: number;
}

interface ErrorResponse {
  error: string;
  details?: string;
}

/**
 * Validates query parameters for the metrics endpoint
 * @param query - Express query object
 * @returns Validation result with parsed parameters or error
 */
function validateQueryParams(query: any): {
  valid: boolean;
  params?: {
    tenantId: string;
    accountId: string;
    from: string;
    to: string;
  };
  error?: string;
} {
  const { tenantId, accountId, from, to } = query;

  // Check required parameters
  if (!tenantId || typeof tenantId !== 'string') {
    return { valid: false, error: 'tenantId is required and must be a string' };
  }

  if (!accountId || typeof accountId !== 'string') {
    return { valid: false, error: 'accountId is required and must be a string' };
  }

  if (!from || typeof from !== 'string') {
    return { valid: false, error: 'from is required and must be a string in YYYY-MM-DD format' };
  }

  if (!to || typeof to !== 'string') {
    return { valid: false, error: 'to is required and must be a string in YYYY-MM-DD format' };
  }

  // Validate date formats
  if (!isValidISODate(from)) {
    return { valid: false, error: 'from must be a valid date in YYYY-MM-DD format' };
  }

  if (!isValidISODate(to)) {
    return { valid: false, error: 'to must be a valid date in YYYY-MM-DD format' };
  }

  // Validate date range
  const fromDate = fromISODateUTC(from);
  const toDate = fromISODateUTC(to);

  if (fromDate > toDate) {
    return { valid: false, error: 'from date must be less than or equal to to date' };
  }

  return {
    valid: true,
    params: { tenantId, accountId, from, to }
  };
}

/**
 * Creates a zero-filled map of dates with invitation counts
 * @param dateRange - Array of dates in YYYY-MM-DD format
 * @param actualCounts - Map of actual counts by date
 * @returns Map with all dates having counts (0 if no data)
 */
function createZeroFilledCounts(
  dateRange: string[],
  actualCounts: Map<string, number>
): Map<string, number> {
  const zeroFilled = new Map<string, number>();
  
  for (const date of dateRange) {
    zeroFilled.set(date, actualCounts.get(date) || 0);
  }
  
  return zeroFilled;
}

/**
 * Main handler for GET /metrics/invitations/daily
 * Processes invitation data with idempotent storage and returns chart-ready JSON
 */
export async function getDailyInvitationMetrics(req: Request, res: Response): Promise<void> {
  try {
    // Validate query parameters
    const validation = validateQueryParams(req.query);
    if (!validation.valid) {
      res.status(400).json({
        error: 'Invalid query parameters',
        details: validation.error
      } as ErrorResponse);
      return;
    }

    const { tenantId, accountId, from, to } = validation.params!;

    console.log(`Processing metrics request: tenant=${tenantId}, account=${accountId}, from=${from}, to=${to}`);

    // Step 1: Mock fetch UniPile invitations for the requested range
    console.log('Fetching invitations from UniPile mock API...');
    const mockInvitations = await mockFetchInvitations(tenantId, accountId, from, to);
    console.log(`Fetched ${mockInvitations.length} invitations from mock API`);

    // Step 2: Transform to raw invitation format and write idempotently to Firestore
    const rawInvitations: RawInvitation[] = mockInvitations.map(invitation => ({
      tenantId,
      accountId,
      externalId: invitation.externalId,
      receivedAt: invitation.receivedAt
    }));

    console.log('Writing raw invitations to Firestore...');
    await writeRawInvitations(rawInvitations);
    console.log(`Wrote ${rawInvitations.length} raw invitations to Firestore`);

    // Step 3: Read back from Firestore to compute actual counts (source of truth)
    console.log('Querying invitation counts from Firestore...');
    const invitationResults = await queryInvitationsByDateRange(tenantId, accountId, from, to);
    
    // Convert to map for easier lookup
    const actualCountsMap = new Map<string, number>();
    invitationResults.forEach(result => {
      actualCountsMap.set(result.date, result.count);
    });

    // Step 4: Zero-fill missing days in the requested range
    const dateRange = eachDayInclusive(from, to);
    const zeroFilledCounts = createZeroFilledCounts(dateRange, actualCountsMap);
    console.log(`Zero-filled ${dateRange.length} days in range`);

    // Step 5: Write daily rollups to Firestore
    const rollups = Array.from(zeroFilledCounts.entries()).map(([date, count]) => ({
      date,
      invitationsCount: count,
      status: 'ok' as const
    }));

    console.log('Writing daily rollups to Firestore...');
    await writeDailyRollups(tenantId, accountId, rollups);
    console.log(`Wrote ${rollups.length} daily rollups to Firestore`);

    // Step 6: Compute previous period comparison (7 days before the requested range)
    const fromDate = fromISODateUTC(from);
    const previousPeriodEnd = addDaysUTC(fromDate, -1); // Day before 'from'
    const previousPeriodStart = addDaysUTC(fromDate, -7); // 7 days before 'from'
    
    const previousFromISO = toISODateUTC(previousPeriodStart);
    const previousToISO = toISODateUTC(previousPeriodEnd);
    
    console.log(`Computing previous period comparison: ${previousFromISO} to ${previousToISO}`);
    const previousPeriodComparison = await getTotalInvitationsInPeriod(
      tenantId, 
      accountId, 
      previousFromISO, 
      previousToISO
    );
    console.log(`Previous period total: ${previousPeriodComparison}`);

    // Step 7: Format response data
    const data: MetricDataPoint[] = Array.from(zeroFilledCounts.entries()).map(([date, value], index) => ({
      date,
      value,
      status: 'ok' as const,
      ...(index === 0 ? { previousPeriodComparison } : {})
    }));

    console.log(`Returning ${data.length} data points with previous period comparison: ${previousPeriodComparison}`);
    res.json(data);

  } catch (error) {
    console.error('Error processing metrics request:', error);
    
    const errorResponse: ErrorResponse = {
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error occurred'
    };
    
    res.status(500).json(errorResponse);
  }
}