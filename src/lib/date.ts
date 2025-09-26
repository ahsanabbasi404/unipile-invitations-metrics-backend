/**
 * UTC date utilities for consistent date handling across the application.
 * All functions work exclusively in UTC to avoid timezone-related issues.
 */

/**
 * Converts a Date object to ISO date string in UTC (YYYY-MM-DD format)
 * @param date - The date to convert
 * @returns ISO date string in YYYY-MM-DD format
 */
export function toISODateUTC(date: Date): string {
  return date.toISOString().split('T')[0];
}

/**
 * Adds the specified number of days to a date in UTC
 * @param date - The base date
 * @param days - Number of days to add (can be negative)
 * @returns New Date object with days added
 */
export function addDaysUTC(date: Date, days: number): Date {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

/**
 * Creates a Date object from an ISO date string (YYYY-MM-DD) at UTC midnight
 * @param isoDate - ISO date string in YYYY-MM-DD format
 * @returns Date object set to UTC midnight of the specified date
 */
export function fromISODateUTC(isoDate: string): Date {
  return new Date(`${isoDate}T00:00:00.000Z`);
}

/**
 * Generates an array of all dates (inclusive) between from and to dates
 * @param fromDate - Start date (inclusive)
 * @param toDate - End date (inclusive)
 * @returns Array of ISO date strings (YYYY-MM-DD) for each day in the range
 */
export function eachDayInclusive(fromDate: string, toDate: string): string[] {
  const start = fromISODateUTC(fromDate);
  const end = fromISODateUTC(toDate);
  const days: string[] = [];
  
  let current = new Date(start);
  while (current <= end) {
    days.push(toISODateUTC(current));
    current = addDaysUTC(current, 1);
  }
  
  return days;
}

/**
 * Validates if a string is a valid ISO date (YYYY-MM-DD)
 * @param dateString - String to validate
 * @returns true if valid ISO date format, false otherwise
 */
export function isValidISODate(dateString: string): boolean {
  const regex = /^\d{4}-\d{2}-\d{2}$/;
  if (!regex.test(dateString)) {
    return false;
  }
  
  const date = fromISODateUTC(dateString);
  return toISODateUTC(date) === dateString;
}

/**
 * Gets the start of day in UTC for a given date
 * @param date - Input date
 * @returns New Date object set to UTC midnight
 */
export function startOfDayUTC(date: Date): Date {
  const result = new Date(date);
  result.setUTCHours(0, 0, 0, 0);
  return result;
}

/**
 * Gets the end of day in UTC for a given date (23:59:59.999)
 * @param date - Input date
 * @returns New Date object set to end of UTC day
 */
export function endOfDayUTC(date: Date): Date {
  const result = new Date(date);
  result.setUTCHours(23, 59, 59, 999);
  return result;
}