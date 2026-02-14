import { toZonedTime } from 'date-fns-tz';

/**
 * Utility functions for handling dates consistently between server and client
 * Addresses SSR/CSR hydration mismatches common in Next.js deployments
 * 
 * All date operations use America/Los_Angeles timezone (PST/PDT) since this is
 * for UC Berkeley EWMBA program. Vercel serverless functions run in UTC, so we
 * must explicitly convert to Berkeley time.
 */

const BERKELEY_TZ = 'America/Los_Angeles';

/**
 * Get a consistent "today" date in Berkeley timezone
 * Converts server UTC time to PST/PDT to avoid one-day-ahead bugs
 */
export function getConsistentToday(): Date {
  const nowUTC = new Date();
  // Convert UTC to Berkeley time (PST/PDT depending on DST)
  const nowBerkeley = toZonedTime(nowUTC, BERKELEY_TZ);
  // Normalize to midnight in Berkeley timezone
  return new Date(nowBerkeley.getFullYear(), nowBerkeley.getMonth(), nowBerkeley.getDate());
}

/**
 * Parse a date string in a way that's consistent between server and client
 * Handles timezone edge cases that can cause date shifting
 * NOTE: This is for user-input dates, NOT for ICS/calendar dates which should use parseICSDate
 */
export function parseConsistentDate(dateString: string): Date {
  const dateUTC = new Date(dateString);
  // Convert to Berkeley timezone before normalizing
  const dateBerkeley = toZonedTime(dateUTC, BERKELEY_TZ);
  // Return as local Date object (NOT UTC) to avoid timezone shift
  // Use local Date constructor to match the Berkeley date exactly
  return new Date(dateBerkeley.getFullYear(), dateBerkeley.getMonth(), dateBerkeley.getDate());
}

/**
 * Parse an ICS/calendar ISO date string (e.g., "2025-10-19T07:00:00.000Z")
 * ICS dates are stored in UTC but represent local time events
 * This extracts just the date portion in Berkeley timezone
 */
export function parseICSDate(isoString: string): Date {
  // Parse the UTC timestamp
  const utcDate = new Date(isoString);
  // Convert to Berkeley timezone
  const berkeleyDate = toZonedTime(utcDate, BERKELEY_TZ);
  // Return as a local Date object with just year/month/day (NOT UTC!)
  // Use local Date constructor to match the Berkeley date exactly
  return new Date(berkeleyDate.getFullYear(), berkeleyDate.getMonth(), berkeleyDate.getDate());
}

/**
 * Get week range starting from Sunday in Berkeley timezone
 * Ensures week calculations happen in PST/PDT, not UTC
 */
export function getConsistentWeekRange(): { start: Date; end: Date } {
  const today = getConsistentToday(); // Already in Berkeley timezone
  const dayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  
  // Calculate the start of the week (Sunday) in Berkeley time
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate() - dayOfWeek, 0, 0, 0, 0);
  
  // Calculate the end as next Sunday at 00:00:00 (exclusive) = 7 days later
  const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 8, 0, 0, 0, 0);
  
  return { start, end };
}

/**
 * Format date consistently for display
 * Uses parseConsistentDate which already handles Berkeley timezone conversion
 */
export function formatConsistentDate(dateString: string): string {
  const date = parseConsistentDate(dateString);
  return date.toLocaleDateString('en-US', { 
    weekday: 'short', 
    month: 'short', 
    day: 'numeric' 
  });
}

/**
 * Check if a date string falls within a week range, handling timezone consistently
 * For ICS/calendar dates (ISO strings)
 */
export function isDateInWeekRange(dateString: string, weekStart: Date, weekEnd: Date): boolean {
  const eventDate = parseICSDate(dateString);
  return eventDate >= weekStart && eventDate < weekEnd;
}
