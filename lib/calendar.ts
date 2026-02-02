import ical from 'node-ical';
import { addDays, isAfter, isBefore } from 'date-fns';
import fs from 'fs';
import path from 'path';

// Safe logging utilities to prevent console output contamination in production
const safeLog = (...args: unknown[]) => {
  if (process.env.NODE_ENV === 'development') {
    console.log(...args);
  }
};

const safeWarn = (...args: unknown[]) => {
  if (process.env.NODE_ENV === 'development') {
    console.warn(...args);
  }
};

export type CalendarEvent = {
  uid?: string;
  title: string;
  start: string;   // ISO
  end?: string;    // ISO
  location?: string;
  url?: string;
  allDay?: boolean;
  description?: string;
  cohort?: 'blue' | 'gold';
  source?: string; // ICS filename for determining course type
  organizer?: string; // Event organizer
  status?: string; // CONFIRMED, TENTATIVE, CANCELLED
  categories?: string[]; // Event categories
};

async function getIcsData(): Promise<string> {
  // If external ICS URL is provided, use it
  if (process.env.CALENDAR_ICS_URL) {
    try {
      const res = await fetch(process.env.CALENDAR_ICS_URL);
      if (!res.ok) throw new Error(`Failed to fetch ICS (${res.status}) from ${process.env.CALENDAR_ICS_URL}`);
      return res.text();
    } catch (error) {
      safeWarn('Failed to fetch external calendar, falling back to local file:', error);
    }
  }

  // Read from local file directly (works in Node runtime)
  try {
    const filePath = path.join(process.cwd(), 'public', 'calendar.ics');
    if (fs.existsSync(filePath)) {
      safeLog('Reading calendar from local file:', filePath);
      return fs.readFileSync(filePath, 'utf-8');
    }
  } catch (error) {
    safeWarn('Could not read local calendar file:', error);
  }

  // Final fallback to HTTP fetch (if file doesn't exist and no external URL)
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL 
    || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
  
  const icsUrl = `${baseUrl}/calendar.ics`;
  safeLog('Fallback: fetching calendar from URL:', icsUrl);
  
  const res = await fetch(icsUrl);
  if (!res.ok) throw new Error(`Failed to fetch ICS (${res.status}) from ${icsUrl}`);
  return res.text();
}

export async function getUpcomingEvents(
  daysAhead = 150,
  limit = 150
): Promise<CalendarEvent[]> {
  const text = await getIcsData();

  const data = ical.sync.parseICS(text);
  const now = new Date();
  const horizon = addDays(now, daysAhead);
  const pastLimit = addDays(now, -120); // Show events from 120 days ago

  const events: CalendarEvent[] = [];

  for (const k of Object.keys(data)) {
    const v = data[k];
    if (!v || v.type !== 'VEVENT' || !v.start) continue;

    // node-ical gives Date objects already in local/server TZ; we expose ISO.
    const start = v.start as Date;
    const end = (v.end as Date) || undefined;

    // Show events within range (past 30 days to future daysAhead)
    if (!isAfter(start, pastLimit)) continue;
    if (!isBefore(start, horizon)) continue;

    const allDay =
      !!v.datetype && v.datetype === 'date' ||
      (!!v.start && start.getHours() === 0 && start.getMinutes() === 0 && (!end || (end.getHours() === 0 && end.getMinutes() === 0)));

    // Helper function to safely extract string values from potentially complex objects
    const safeStringExtract = (value: unknown): string | undefined => {
      if (!value) return undefined;
      if (typeof value === 'string') return value;
      if (typeof value === 'object' && value && 'val' in value && typeof value.val === 'string') return value.val;
      if (typeof value === 'object' && value && 'toString' in value && typeof value.toString === 'function') {
        const str = value.toString();
        return str !== '[object Object]' ? str : undefined;
      }
      return String(value);
    };

    // For all-day events, preserve the local date to avoid timezone shift issues
    // When parsing VALUE=DATE (e.g., 20260324), we want to keep it as March 24, not shift to UTC
    const formatDateForStorage = (date: Date, isAllDay: boolean): string => {
      if (isAllDay) {
        // Use local date components to create an ISO string at midnight UTC
        // This preserves the intended date regardless of server timezone
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}T00:00:00.000Z`;
      }
      return date.toISOString();
    };

    events.push({
      uid: v.uid,
      title: safeStringExtract(v.summary) || 'Untitled',
      start: formatDateForStorage(start, allDay),
      end: end ? formatDateForStorage(end, allDay) : undefined,
      location: safeStringExtract(v.location),
      url: safeStringExtract(v.url),
      description: safeStringExtract(v.description),
      allDay,
    });
  }

  // sort and cap
  events.sort((a, b) => +new Date(a.start) - +new Date(b.start));
  return events.slice(0, limit);
}
