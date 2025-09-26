/**
 * Mock UniPile API for generating deterministic invitation data.
 * Simulates fetching invitations with consistent, seeded data generation.
 */

import { eachDayInclusive } from '../lib/date';

export interface MockInvitation {
  externalId: string;
  senderId: string;
  receivedAt: string; // ISO string
}

/**
 * Simple hash function for deterministic pseudo-random number generation
 * @param str - Input string to hash
 * @returns Hash value as number
 */
function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

/**
 * Generates a deterministic count of invitations for a specific day
 * @param tenantId - Tenant identifier
 * @param accountId - Account identifier
 * @param date - Date in YYYY-MM-DD format
 * @returns Number of invitations for that day (0-5)
 */
function getDailyInvitationCount(tenantId: string, accountId: string, date: string): number {
  const seed = `${tenantId}-${accountId}-${date}`;
  const hash = simpleHash(seed);
  return hash % 6; // 0-5 invitations per day
}

/**
 * Generates deterministic invitation data for a specific day
 * @param tenantId - Tenant identifier
 * @param accountId - Account identifier
 * @param date - Date in YYYY-MM-DD format
 * @param count - Number of invitations to generate
 * @returns Array of mock invitations
 */
function generateInvitationsForDay(
  tenantId: string,
  accountId: string,
  date: string,
  count: number
): MockInvitation[] {
  const invitations: MockInvitation[] = [];
  
  for (let i = 0; i < count; i++) {
    const seed = `${tenantId}-${accountId}-${date}-${i}`;
    const hash = simpleHash(seed);
    
    // Generate deterministic external ID
    const externalId = `inv_${hash.toString(36)}_${date.replace(/-/g, '')}_${i}`;
    
    // Generate deterministic sender ID
    const senderHash = simpleHash(`sender-${seed}`);
    const senderId = `sender_${senderHash.toString(36)}`;
    
    // Generate time within the day (spread throughout the day)
    const hourHash = simpleHash(`hour-${seed}`);
    const hour = hourHash % 24;
    const minuteHash = simpleHash(`minute-${seed}`);
    const minute = minuteHash % 60;
    
    const receivedAt = `${date}T${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}:00.000Z`;
    
    invitations.push({
      externalId,
      senderId,
      receivedAt
    });
  }
  
  return invitations;
}

/**
 * Mock function that simulates fetching invitations from UniPile API
 * Generates deterministic data based on tenant, account, and date range
 * @param tenantId - Tenant identifier
 * @param accountId - Account identifier
 * @param fromISO - Start date in YYYY-MM-DD format
 * @param toISO - End date in YYYY-MM-DD format
 * @returns Promise resolving to array of mock invitations
 */
export async function mockFetchInvitations(
  tenantId: string,
  accountId: string,
  fromISO: string,
  toISO: string
): Promise<MockInvitation[]> {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 100));
  
  const allInvitations: MockInvitation[] = [];
  const days = eachDayInclusive(fromISO, toISO);
  
  for (const date of days) {
    const count = getDailyInvitationCount(tenantId, accountId, date);
    const dayInvitations = generateInvitationsForDay(tenantId, accountId, date, count);
    allInvitations.push(...dayInvitations);
  }
  
  // Sort by receivedAt for consistent ordering
  allInvitations.sort((a, b) => a.receivedAt.localeCompare(b.receivedAt));
  
  return allInvitations;
}

/**
 * Gets the deterministic count of invitations for a specific day
 * Useful for testing and validation
 * @param tenantId - Tenant identifier
 * @param accountId - Account identifier
 * @param date - Date in YYYY-MM-DD format
 * @returns Number of invitations for that day
 */
export function getExpectedDailyCount(tenantId: string, accountId: string, date: string): number {
  return getDailyInvitationCount(tenantId, accountId, date);
}

/**
 * Generates sample sender IDs for testing
 * @param tenantId - Tenant identifier
 * @param accountId - Account identifier
 * @param count - Number of sender IDs to generate
 * @returns Array of deterministic sender IDs
 */
export function generateSampleSenderIds(tenantId: string, accountId: string, count: number): string[] {
  const senderIds: string[] = [];
  
  for (let i = 0; i < count; i++) {
    const seed = `sender-${tenantId}-${accountId}-${i}`;
    const hash = simpleHash(seed);
    senderIds.push(`sender_${hash.toString(36)}`);
  }
  
  return senderIds;
}