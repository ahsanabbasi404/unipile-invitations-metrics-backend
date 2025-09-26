/**
 * Firestore initialization and helper functions for the UniPile metrics service.
 * Supports both emulator and production environments.
 */

import * as admin from 'firebase-admin';
import { getFirestore, Firestore, FieldValue } from 'firebase-admin/firestore';
import { toISODateUTC, fromISODateUTC, startOfDayUTC, addDaysUTC } from './date';

// Types for our data structures
export interface RawInvitation {
  tenantId: string;
  accountId: string;
  externalId: string;
  receivedAt: string; // ISO string
}

export interface DailyRollup {
  date: string; // YYYY-MM-DD
  invitationsCount: number;
  status: 'ok';
  updatedAt: string; // ISO string
}

export interface InvitationQueryResult {
  date: string;
  count: number;
}

// Initialize Firebase Admin
let db: Firestore;

export function initializeFirestore(): Firestore {
  if (db) {
    return db;
  }

  // Check if Firebase app is already initialized
  if (admin.apps.length === 0) {
    // Initialize Firebase Admin
    try {
      // Load service account credentials
      const path = require('path');
      const serviceAccountPath = path.resolve('./firebase/unipile-ec7ec-firebase-adminsdk-fbsvc-6da41647d7.json');
      const serviceAccount = require(serviceAccountPath);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
    } catch (error) {
      console.error('Failed to initialize Firebase Admin:', error);
      throw error;
    }
  }

  db = getFirestore();
  
  // Set emulator host if running locally
  if (process.env.FIRESTORE_EMULATOR_HOST) {
    console.log('Using Firestore emulator at:', process.env.FIRESTORE_EMULATOR_HOST);
  }

  return db;
}

/**
 * Writes raw invitations to Firestore idempotently using externalId as document ID
 * @param invitations - Array of raw invitation data
 */
export async function writeRawInvitations(invitations: RawInvitation[]): Promise<void> {
  const firestore = initializeFirestore();
  const batch = firestore.batch();

  for (const invitation of invitations) {
    const docRef = firestore.collection('invitations').doc(invitation.externalId);
    // Use merge: true for idempotent writes
    batch.set(docRef, invitation, { merge: true });
  }

  await batch.commit();
}

/**
 * Queries invitations by tenant, account, and date range
 * @param tenantId - Tenant identifier
 * @param accountId - Account identifier  
 * @param fromDate - Start date (YYYY-MM-DD, inclusive)
 * @param toDate - End date (YYYY-MM-DD, inclusive)
 * @returns Array of invitations grouped by date with counts
 */
export async function queryInvitationsByDateRange(
  tenantId: string,
  accountId: string,
  fromDate: string,
  toDate: string
): Promise<InvitationQueryResult[]> {
  const firestore = initializeFirestore();
  
  // Convert to UTC timestamps for querying
  const fromTimestamp = startOfDayUTC(fromISODateUTC(fromDate));
  const toTimestamp = startOfDayUTC(addDaysUTC(fromISODateUTC(toDate), 1)); // Next day start for exclusive end

  const query = firestore
    .collection('invitations')
    .where('tenantId', '==', tenantId)
    .where('accountId', '==', accountId)
    .where('receivedAt', '>=', fromTimestamp.toISOString())
    .where('receivedAt', '<', toTimestamp.toISOString());

  const snapshot = await query.get();
  
  // Group by date and count
  const dateCountMap = new Map<string, number>();
  
  snapshot.forEach(doc => {
    const data = doc.data() as RawInvitation;
    const date = toISODateUTC(new Date(data.receivedAt));
    dateCountMap.set(date, (dateCountMap.get(date) || 0) + 1);
  });

  // Convert to array format
  return Array.from(dateCountMap.entries()).map(([date, count]) => ({
    date,
    count
  }));
}

/**
 * Writes daily rollup documents to Firestore
 * @param tenantId - Tenant identifier
 * @param accountId - Account identifier
 * @param rollups - Array of daily rollup data
 */
export async function writeDailyRollups(
  tenantId: string,
  accountId: string,
  rollups: Omit<DailyRollup, 'updatedAt'>[]
): Promise<void> {
  const firestore = initializeFirestore();
  const batch = firestore.batch();

  for (const rollup of rollups) {
    const docPath = `metrics/${tenantId}/accounts/${accountId}/daily/${rollup.date}`;
    const docRef = firestore.doc(docPath);
    
    const rollupWithTimestamp: DailyRollup = {
      ...rollup,
      updatedAt: new Date().toISOString()
    };
    
    batch.set(docRef, rollupWithTimestamp, { merge: true });
  }

  await batch.commit();
}

/**
 * Queries invitations for a specific date range to calculate totals
 * Used for previous period comparison
 * @param tenantId - Tenant identifier
 * @param accountId - Account identifier
 * @param fromDate - Start date (YYYY-MM-DD, inclusive)
 * @param toDate - End date (YYYY-MM-DD, inclusive)
 * @returns Total count of invitations in the period
 */
export async function getTotalInvitationsInPeriod(
  tenantId: string,
  accountId: string,
  fromDate: string,
  toDate: string
): Promise<number> {
  const results = await queryInvitationsByDateRange(tenantId, accountId, fromDate, toDate);
  return results.reduce((total, result) => total + result.count, 0);
}

/**
 * Gets the Firestore instance (initializes if needed)
 * @returns Firestore instance
 */
export function getFirestoreInstance(): Firestore {
  return initializeFirestore();
}