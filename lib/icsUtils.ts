import ical from 'node-ical';
import { addDays, isAfter, isBefore } from 'date-fns';
import { fromZonedTime } from 'date-fns-tz';
import fs from 'fs';
import path from 'path';

// Safe logging utilities to prevent console output contamination in production
const safeLog = (...args: unknown[]) => {
  if (process.env.NODE_ENV === 'development') {
    console.log(...args);
  }
};

const safeError = (...args: unknown[]) => {
  if (process.env.NODE_ENV === 'development') {
    console.error(...args);
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

export type CohortEvents = {
  blue: CalendarEvent[];
  gold: CalendarEvent[];
  original: CalendarEvent[]; // Original calendar.ics events for rich content matching
  launch: CalendarEvent[]; // UC Launch Accelerator events
  calBears: CalendarEvent[]; // Cal Bears home events
  campusGroups: CalendarEvent[]; // Campus Groups events
  academicCalendar: CalendarEvent[]; // Haas Academic Calendar (holidays, breaks, finals)
  cmg: CalendarEvent[]; // Career Management Group (CMG) events
};

// File mappings for each cohort
const COHORT_FILES = {
  blue: [
    // Spring 2026 courses
    'ewmba201b_macro_blue_spring2026.ics',
    'ewmba202_accounting_blue_spring2026.ics',
    'ewmba_springb_blue_spring2026.ics',
    // Fall 2025 courses (archive)
    'ewmba201a_micro_blue_fall2025.ics',
    'ewmba_leadingpeople_blue_fall2025.ics',
    'DataDecisions-Blue.ics',
    'Marketing-Blue-Final.ics',
    'teams@Haas.ics'
  ],
  gold: [
    // Spring 2026 courses
    'ewmba201b_macro_gold_spring2026.ics',
    'ewmba202_accounting_gold_spring2026.ics',
    'ewmba_springb_gold_spring2026.ics',
    // Fall 2025 courses (archive)
    'ewmba201a_micro_gold_fall2025.ics',
    'ewmba_leadingpeople_gold_fall2025.ics',
    'DataDecisions-Gold.ics',
    'Marketing-Gold-Final.ics',
    'teams@Haas.ics'
  ]
};/**
 * Fetch ICS data from either external URL or local file
 */
async function fetchIcsData(filename: string): Promise<string> {
  // For development/local, always try local files first
  if (process.env.NODE_ENV === 'development') {
    try {
      const filePath = path.join(process.cwd(), 'public', filename);
      if (fs.existsSync(filePath)) {
        safeLog(`Reading ICS from local file: ${filePath}`);
        const content = fs.readFileSync(filePath, 'utf-8');
        if (content.trim().length > 0) {
          return content;
        } else {
          safeWarn(`Local ICS file ${filename} is empty`);
        }
      } else {
        safeWarn(`Local ICS file not found: ${filePath}`);
      }
    } catch (error) {
      safeWarn(`Could not read local ICS file ${filename}:`, error);
    }
  }

  // If CALENDAR_ICS_URL points to a single file, only use it for calendar.ics
  if (process.env.CALENDAR_ICS_URL && filename === 'calendar.ics') {
    try {
      safeLog(`Fetching single ICS from: ${process.env.CALENDAR_ICS_URL}`);
      const res = await fetch(process.env.CALENDAR_ICS_URL);
      if (!res.ok) throw new Error(`Failed to fetch ${filename} (${res.status})`);
      return res.text();
    } catch (error) {
      safeWarn(`Failed to fetch external ICS ${filename}:`, error);
    }
  }

  // For cohort-specific files, try local files in both dev and production
  try {
    const filePath = path.join(process.cwd(), 'public', filename);
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf-8');
      if (content.trim().length > 0) {
        return content;
      }
    }
  } catch (error) {
    safeWarn(`Could not read local ICS file ${filename}:`, error);
  }

  // If we reach here, file wasn't found or was empty
  // For leading people files we suppress throwing to allow fallback logic
  if (/leadingpeople|205_/i.test(filename)) {
    safeWarn(`Could not fetch ICS data for ${filename} - returning empty string for fallback`);
    return '';
  }
  throw new Error(`Could not fetch ICS data for ${filename} - file not found or empty`);
}

/**
 * Parse ICS text and convert to CalendarEvent array
 */
function parseIcsToEvents(icsText: string, cohort: 'blue' | 'gold', filename?: string): CalendarEvent[] {
  try {
    // Handle ICS line folding BEFORE removing blank lines
    // ICS line folding uses CRLF followed by space or tab for continuation
    const unfoldedIcs = icsText
      .replace(/\r\n/g, '\n')  // Normalize line endings first
      .replace(/\r/g, '\n')    // Handle old Mac line endings
      .replace(/\n[ \t]/g, '') // Unfold lines (remove newline + space/tab)
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)  // Remove blank lines after unfolding
      .join('\n');
    
    safeLog(`Successfully unfolded ICS content for ${cohort} cohort from ${filename}`);
    
    const data = ical.sync.parseICS(unfoldedIcs);
    const events: CalendarEvent[] = [];

    for (const k of Object.keys(data)) {
      const v = data[k];
      if (!v || v.type !== 'VEVENT') {
        continue;
      }

      if (!v.start) {
        safeWarn(`Skipping event with no start date: ${v.summary}`);
        continue;
      }

      const start = v.start instanceof Date ? v.start : new Date(v.start);
      const end = v.end ? (v.end instanceof Date ? v.end : new Date(v.end)) : undefined;

      // Validate date
      if (isNaN(start.getTime())) {
        safeWarn(`Skipping event with invalid start date: ${v.summary}, start: ${v.start}`);
        continue;
      }

      const allDay =
        !!v.datetype && v.datetype === 'date' ||
        (start.getHours() === 0 && start.getMinutes() === 0 && (!end || (end.getHours() === 0 && end.getMinutes() === 0)));

      // Normalize floating and TZID times to UTC without hardcoded offsets.
      // Floating times (no TZID, no Z) are interpreted as America/Los_Angeles.
      const DEFAULT_TZ = 'America/Los_Angeles';

      type RawIcsDateTime = {
        value: string;
        tzid?: string;
        isUtc: boolean;
      };

      const buildIcsDateTime = (raw: RawIcsDateTime): Date => {
        const datePart = raw.value.slice(0, 8);
        const timePart = raw.value.slice(9);
        const isoLike = `${datePart.slice(0, 4)}-${datePart.slice(4, 6)}-${datePart.slice(6, 8)}T${timePart.slice(0, 2)}:${timePart.slice(2, 4)}:${timePart.slice(4, 6)}`;
        if (raw.isUtc) {
          return new Date(`${isoLike}Z`);
        }
        const timeZone = raw.tzid || DEFAULT_TZ;
        return fromZonedTime(isoLike, timeZone);
      };

      const getEventBlock = (uid?: string): string | null => {
        if (!uid) return null;
        const safeUid = uid.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const match = unfoldedIcs.match(new RegExp(`UID:${safeUid}[\\s\\S]*?END:VEVENT`, 'i'));
        return match ? match[0] : null;
      };

      const extractDateTime = (block: string, prop: 'DTSTART' | 'DTEND'): RawIcsDateTime | null => {
        const match = block.match(new RegExp(`${prop}(?:;TZID=([^:;]+))?:(\\d{8}T\\d{6})(Z)?`, 'i'));
        if (!match) return null;
        return {
          value: match[2],
          tzid: match[1],
          isUtc: match[3] === 'Z',
        };
      };

      let adjustedStart = start;
      let adjustedEnd = end;

      if (!allDay) {
        const eventBlock = getEventBlock(v.uid);
        if (eventBlock) {
          const rawStart = extractDateTime(eventBlock, 'DTSTART');
          const rawEnd = extractDateTime(eventBlock, 'DTEND');

          if (rawStart) {
            adjustedStart = buildIcsDateTime(rawStart);
          }
          if (rawEnd) {
            adjustedEnd = buildIcsDateTime(rawEnd);
          }
        }
      }

      // Helper function to safely extract string values with better debugging
      const safeStringExtract = (value: unknown, fieldName?: string): string | undefined => {
        if (!value) return undefined;
        if (typeof value === 'string') {
          const result = value.trim();
          if (fieldName && result && result.length > 50) {
            safeLog(`Extracted ${fieldName}: ${result.substring(0, 100)}...`);
          }
          return result || undefined;
        }
        if (typeof value === 'object' && value && 'val' in value && typeof value.val === 'string') {
          const result = value.val.trim();
          if (fieldName && result && result.length > 50) {
            safeLog(`Extracted ${fieldName} from .val: ${result.substring(0, 100)}...`);
          }
          return result || undefined;
        }
        if (typeof value === 'object' && value && 'toString' in value && typeof value.toString === 'function') {
          const str = value.toString();
          const result = str !== '[object Object]' ? str.trim() : undefined;
          if (fieldName && result && result.length > 50) {
            safeLog(`Extracted ${fieldName} from toString: ${result.substring(0, 100)}...`);
          }
          return result || undefined;
        }
        const result = String(value).trim();
        return result || undefined;
      };

      const description = safeStringExtract(v.description, 'description');
      const location = safeStringExtract(v.location, 'location');
      const url = safeStringExtract(v.url, 'url');
      const organizer = safeStringExtract(v.organizer, 'organizer');
      const status = safeStringExtract(v.status, 'status');
      const summaryVal = safeStringExtract(v.summary);

      // If parsing calendar.ics, leadingpeople, or 205 files, remove any Teams@Haas events (they come from dedicated teams@Haas.ics)
      if (filename === 'calendar.ics' || (filename && (filename.includes('leadingpeople') || filename.includes('205')))) {
        const combinedText = `${summaryVal || ''} ${description || ''}`;
        if (/teams@haas/i.test(combinedText)) {
          safeLog(`Filtered Teams@Haas event from ${filename}: ${summaryVal}`);
          continue; // skip adding this event
        }
      }

      // Extract categories if present
      interface ICalEventWithCategories {
        categories?: string | string[] | { [key: string]: unknown };
      }
      const vWithCategories = v as ICalEventWithCategories;
      let categories: string[] | undefined;
      if (vWithCategories.categories) {
        if (Array.isArray(vWithCategories.categories)) {
          categories = vWithCategories.categories.map((cat: unknown) => safeStringExtract(cat)).filter(Boolean) as string[];
        } else {
          const catStr = safeStringExtract(vWithCategories.categories);
          categories = catStr ? catStr.split(',').map(c => c.trim()).filter(Boolean) : undefined;
        }
      }

      const event: CalendarEvent = {
        uid: v.uid,
        title: summaryVal || 'Untitled',
        start: adjustedStart.toISOString(),
        end: adjustedEnd?.toISOString(),
        location,
        url,
        description,
        allDay,
        cohort,
        source: filename,
        organizer,
        status,
        categories,
      };

      // Sanitize Leading People related events: remove any 'team@haas' content
      if (filename && (filename.includes('leadingpeople') || filename.includes('205_'))) {
        if (event.description && /team@haas/i.test(event.description)) {
          const cleaned = event.description.replace(/team@haas/ig, '').replace(/\n\s*\n/g, '\n').trim();
          if (cleaned !== event.description) {
            safeLog(`Sanitized 'team@haas' from description in ${filename}`);
            event.description = cleaned;
          }
        }
        if (event.organizer && /team@haas/i.test(event.organizer)) {
          safeLog(`Removed organizer 'team@haas' in ${filename}`);
          event.organizer = undefined;
        }
      }

      events.push(event);
    }

    safeLog(`Successfully parsed ${events.length} events for ${cohort} cohort`);
    return events;
  } catch (error) {
    safeError(`Error parsing ICS for ${cohort} cohort:`, error);
    return [];
  }
}

/**
 * Fetch and parse events for a single cohort
 */
async function fetchCohortEvents(cohort: 'blue' | 'gold'): Promise<CalendarEvent[]> {
  const files = COHORT_FILES[cohort];
  const allEvents: CalendarEvent[] = [];

  safeLog(`Fetching ${cohort} cohort events from ${files.length} files`);

  // Helper to attempt loading a single file with fallback
  const loadFileWithFallback = async (filename: string): Promise<CalendarEvent[]> => {
    try {
      const icsText = await fetchIcsData(filename);
      let events = parseIcsToEvents(icsText, cohort, filename);
      if (events.length === 0 && filename.includes('leadingpeople')) {
        // Fallback to legacy 205 file naming if new file is empty
        const legacyName = filename.replace('ewmba_leadingpeople', 'ewmba205').replace('leadingpeople_', '205_').replace('fall2025', 'fallA2025_v2');
        safeWarn(`No events parsed from ${filename}. Trying legacy fallback ${legacyName}`);
        try {
          const legacyIcs = await fetchIcsData(legacyName);
            const legacyEvents = parseIcsToEvents(legacyIcs, cohort, legacyName);
            if (legacyEvents.length > 0) {
              safeLog(`Loaded ${legacyEvents.length} fallback events from ${legacyName}`);
              events = legacyEvents;
            }
        } catch (legacyErr) {
          safeWarn(`Fallback legacy file ${legacyName} also failed:`, legacyErr);
        }
      }
      return events;
    } catch (error) {
      safeError(`Failed to process ${filename} for ${cohort} cohort:`, error);
      // If new naming failed, attempt legacy directly when relevant
      if (filename.includes('leadingpeople')) {
        const legacyName = filename.replace('ewmba_leadingpeople', 'ewmba205').replace('leadingpeople_', '205_').replace('fall2025', 'fallA2025_v2');
        try {
          safeWarn(`Attempting legacy file after error: ${legacyName}`);
          const legacyIcs = await fetchIcsData(legacyName);
          return parseIcsToEvents(legacyIcs, cohort, legacyName);
        } catch {
          safeWarn(`Legacy attempt also failed for ${legacyName}`);
        }
      }
      return [];
    }
  };

  // Fetch all files for this cohort in parallel
  const results = await Promise.all(files.map(f => loadFileWithFallback(f)));

  // Merge all events
  for (const events of results) {
    allEvents.push(...events);
  }

  // Source priority for deduplication (lower index = higher priority)
  const SOURCE_PRIORITY = [
    'Marketing-Blue-Final.ics',
    'Marketing-Gold-Final.ics',
    'DataDecisions-Blue.ics',
    'DataDecisions-Gold.ics',
    'teams@Haas.ics',
    'ewmba201a_micro_blue_fall2025.ics',
    'ewmba201a_micro_gold_fall2025.ics',
    'ewmba_leadingpeople_blue_fall2025.ics',
    'ewmba_leadingpeople_gold_fall2025.ics',
    'ewmba205_blue_fallA2025_v2.ics',
    'ewmba205_gold_fallA2025_v2.ics',
  ];

  const sourceRank = (src?: string): number => {
    if (!src) return Number.MAX_SAFE_INTEGER;
    const index = SOURCE_PRIORITY.findIndex(priority => src.includes(priority));
    return index === -1 ? Number.MAX_SAFE_INTEGER : index;
  };

  // UID-first deduplication with source priority
  const dedupPrefMap = new Map<string, CalendarEvent>();
  const debug = process.env.CALENDAR_DEBUG === '1';

  for (const ev of allEvents) {
    // Use UID if available for better deduplication, otherwise fall back to date+title
    const key = ev.uid 
      ? `uid:${ev.uid.trim().toLowerCase()}`
      : `${ev.start.substring(0,10)}|${(ev.title || '').toLowerCase().trim()}`;

    const existing = dedupPrefMap.get(key);
    
    if (!existing) {
      dedupPrefMap.set(key, ev);
      if (debug && key.includes('marketing-case-preferences')) {
        safeLog(`[DEDUPE] New event: ${ev.title} from ${ev.source}`);
      }
      continue;
    }

    // Choose winner based on source priority (lower rank = higher priority)
    const incomingRank = sourceRank(ev.source);
    const existingRank = sourceRank(existing.source);
    const winner = incomingRank < existingRank ? ev : existing;
    
    if (debug && key.includes('marketing-case-preferences')) {
      safeLog(`[DEDUPE] Conflict for: ${ev.title}`);
      safeLog(`  Incoming: ${ev.source} (rank ${incomingRank})`);
      safeLog(`  Existing: ${existing.source} (rank ${existingRank})`);
      safeLog(`  Winner: ${winner.source}`);
    }
    
    dedupPrefMap.set(key, winner);
  }
  const output = Array.from(dedupPrefMap.values());
  if (output.length !== allEvents.length) {
    safeLog(`De-duplicated ${allEvents.length - output.length} events (post Teams@Haas + course-specific preference) for ${cohort}`);
  }

  safeLog(`Total ${cohort} cohort events (after dedupe + Teams@Haas preference): ${output.length}`);
  return output;
}

/**
 * Filter events by date range
 */
function filterEventsByDateRange(
  events: CalendarEvent[], 
  daysAhead = 30, 
  limit = 150
): CalendarEvent[] {
  const now = new Date();
  const horizon = addDays(now, daysAhead);
  const pastLimit = addDays(now, -120); // Show events from 120 days ago (matches calendar.ts)

  const filteredEvents = events.filter(event => {
    const start = new Date(event.start);
    return isAfter(start, pastLimit) && isBefore(start, horizon);
  });

  // Sort by start date and limit results
  filteredEvents.sort((a, b) => +new Date(a.start) - +new Date(b.start));
  return filteredEvents.slice(0, limit);
}

/**
 * Find a matching event from the original calendar based on date and title similarity
 */
export function findMatchingOriginalEvent(
  cohortEvent: CalendarEvent, 
  originalEvents: CalendarEvent[]
): CalendarEvent | null {
  if (!originalEvents.length) return null;

  const cohortDate = new Date(cohortEvent.start);
  
  // First, try exact date match
  const sameDateEvents = originalEvents.filter(originalEvent => {
    const originalDate = new Date(originalEvent.start);
    return (
      originalDate.getFullYear() === cohortDate.getFullYear() &&
      originalDate.getMonth() === cohortDate.getMonth() &&
      originalDate.getDate() === cohortDate.getDate()
    );
  });

  if (sameDateEvents.length === 0) return null;

  // If only one event on the same date, return it
  if (sameDateEvents.length === 1) {
    safeLog(`Found matching event by date: ${sameDateEvents[0].title}`);
    return sameDateEvents[0];
  }

  // Multiple events on same date - try to match by title similarity
  const cohortTitle = cohortEvent.title.toLowerCase();
  
  // Helper function to calculate title similarity
  const getTitleSimilarity = (title1: string, title2: string): number => {
    const t1 = title1.toLowerCase().replace(/[^\w\s]/g, '').trim();
    const t2 = title2.toLowerCase().replace(/[^\w\s]/g, '').trim();
    
    // Check for common keywords
    const keywords1 = t1.split(/\s+/);
    const keywords2 = t2.split(/\s+/);
    
    let matches = 0;
    for (const word1 of keywords1) {
      if (word1.length > 2) { // Only consider words longer than 2 characters
        for (const word2 of keywords2) {
          if (word1 === word2 || word1.includes(word2) || word2.includes(word1)) {
            matches++;
            break;
          }
        }
      }
    }
    
    return matches / Math.max(keywords1.length, keywords2.length);
  };

  // Find the event with the highest title similarity
  let bestMatch: CalendarEvent | null = null;
  let bestSimilarity = 0;

  for (const originalEvent of sameDateEvents) {
    const similarity = getTitleSimilarity(cohortTitle, originalEvent.title);
    safeLog(`Comparing "${cohortTitle}" with "${originalEvent.title.toLowerCase()}" - similarity: ${similarity}`);
    
    if (similarity > bestSimilarity && similarity > 0.3) { // Minimum 30% similarity
      bestSimilarity = similarity;
      bestMatch = originalEvent;
    }
  }

  if (bestMatch) {
    safeLog(`Found best matching event (${bestSimilarity.toFixed(2)} similarity): ${bestMatch.title}`);
    return bestMatch;
  }

  // If no good title match, return the first event on the same date
  safeLog(`No good title match found, returning first event on same date: ${sameDateEvents[0].title}`);
  return sameDateEvents[0];
}

/**
 * Fetch and parse events from the original calendar.ics file
 */
async function fetchOriginalCalendarEvents(): Promise<CalendarEvent[]> {
  safeLog('Fetching original calendar.ics events for rich content matching');

  try {
    const icsText = await fetchIcsData('calendar.ics');
    const events = parseIcsToEvents(icsText, 'blue', 'calendar.ics'); // Default to blue for compatibility
    safeLog(`Successfully parsed ${events.length} events from original calendar.ics`);
    return events;
  } catch (error) {
    safeError('Error fetching original calendar events:', error);
    return [];
  }
}

/**
 * Fetch and parse events from the UC Launch Accelerator ICS file
 */
async function fetchUCLaunchEvents(): Promise<CalendarEvent[]> {
  safeLog('Fetching UC Launch Accelerator events');

  try {
    const icsText = await fetchIcsData('uc_launch_events_fall2025.ics');
    const events = parseIcsToEvents(icsText, 'blue', 'uc_launch_events_fall2025.ics'); // Default to blue for compatibility
    safeLog(`Successfully parsed ${events.length} events from UC Launch calendar`);
    return events;
  } catch (error) {
    safeError('Error fetching UC Launch events:', error);
    return [];
  }
}

async function fetchCalBearsEvents(): Promise<CalendarEvent[]> {
  safeLog('Fetching Cal Bears home events');

  try {
    const icsText = await fetchIcsData('cal_bears_home_2025_original.ics');
    const events = parseIcsToEvents(icsText, 'blue', 'cal_bears_home_2025_original.ics'); // Default to blue for compatibility
    safeLog(`Successfully parsed ${events.length} events from Cal Bears calendar`);
    return events;
  } catch (error) {
    safeError('Error fetching Cal Bears events:', error);
    return [];
  }
}

/**
 * Fetch and parse events from the Campus Groups ICS URL
 */
async function fetchCampusGroupsEvents(): Promise<CalendarEvent[]> {
  safeLog('Fetching Campus Groups events');

  try {
    const campusGroupsUrl = 'https://haas.campusgroups.com/ics?uid=67214d1a-6c1a-11f0-9d0d-0265b2da6df3&type=group&eid=21fd71de3371203c09be0e414fe6f145';
    
    // Fetch from URL
    const response = await fetch(campusGroupsUrl);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const icsText = await response.text();
    const events = parseIcsToEvents(icsText, 'blue', 'campus_groups.ics'); // Default to blue for compatibility
    safeLog(`Successfully parsed ${events.length} events from Campus Groups calendar`);
    return events;
  } catch (error) {
    safeError('Error fetching Campus Groups events:', error);
    return [];
  }
}

/**
 * Fetch and parse events from the Haas Academic Calendar ICS file
 */
async function fetchHaasAcademicCalendar(): Promise<CalendarEvent[]> {
  safeLog('Fetching Haas Academic Calendar events');

  try {
    const icsText = await fetchIcsData('haas_academic_calendar_spring2026.ics');
    const events = parseIcsToEvents(icsText, 'blue', 'haas_academic_calendar_spring2026.ics');
    safeLog(`Successfully parsed ${events.length} events from Haas Academic Calendar`);
    return events;
  } catch (error) {
    safeError('Error fetching Haas Academic Calendar events:', error);
    return [];
  }
}

/**
 * Fetch and parse events from the Career Management Group (CMG) ICS file
 */
async function fetchCMGEvents(): Promise<CalendarEvent[]> {
  safeLog('Fetching CMG (Career Management Group) events');

  try {
    const icsText = await fetchIcsData('Career_Management_Calendar-Spring_26.ics');
    const events = parseIcsToEvents(icsText, 'blue', 'Career_Management_Calendar-Spring_26.ics');
    safeLog(`Successfully parsed ${events.length} events from CMG calendar`);
    return events;
  } catch (error) {
    safeError('Error fetching CMG events:', error);
    return [];
  }
}

/**
 * Main function to fetch events for both cohorts plus original calendar
 */
export async function getCohortEvents(
  daysAhead = 150,
  limit = 150
): Promise<CohortEvents> {
  safeLog('Fetching events for both cohorts, original calendar, and UC Launch...');

  try {
    // Fetch both cohorts, original calendar, UC Launch events, Cal Bears events, Campus Groups events, Academic Calendar, and CMG in parallel
    const [blueEvents, goldEvents, originalEvents, launchEvents, calBearsEvents, campusGroupsEvents, academicCalendarEvents, cmgEvents] = await Promise.all([
      fetchCohortEvents('blue'),
      fetchCohortEvents('gold'),
      fetchOriginalCalendarEvents().catch(() => {
        safeWarn('Could not load original calendar.ics, continuing without rich content matching');
        return [];
      }),
      fetchUCLaunchEvents().catch(() => {
        safeWarn('Could not load UC Launch events, continuing without them');
        return [];
      }),
      fetchCalBearsEvents().catch(() => {
        safeWarn('Could not load Cal Bears events, continuing without them');
        return [];
      }),
      fetchCampusGroupsEvents().catch(() => {
        safeWarn('Could not load Campus Groups events, continuing without them');
        return [];
      }),
      fetchHaasAcademicCalendar().catch((err) => {
        safeWarn('Could not load Haas Academic Calendar, continuing without them:', err);
        return [];
      }),
      fetchCMGEvents().catch((err) => {
        safeWarn('Could not load CMG events, continuing without them:', err);
        return [];
      })
    ]);

    // Debug: Log raw academic calendar events
    safeLog(`📅 [DEBUG] Raw academicCalendarEvents: ${academicCalendarEvents.length} events`);
    if (academicCalendarEvents.length > 0) {
      safeLog(`📅 [DEBUG] First academic event: ${JSON.stringify(academicCalendarEvents[0])}`);
    }

    // Helper to inject ALL future Teams@Haas events (next 1 year) regardless of horizon
    const injectTeams = (filtered: CalendarEvent[], all: CalendarEvent[]): CalendarEvent[] => {
      const now = new Date();
      const oneYear = new Date(now.getFullYear() + 1, now.getMonth(), now.getDate());
      const existingKeys = new Set(filtered.map(ev => `${ev.start}|${(ev.title||'').toLowerCase()}`));
      const additions: CalendarEvent[] = [];
      for (const ev of all) {
        if ((ev.source || '').toLowerCase().includes('teams@haas')) {
          const startDate = new Date(ev.start);
            if (startDate >= now && startDate <= oneYear) {
              const key = `${ev.start}|${(ev.title||'').toLowerCase()}`;
              if (!existingKeys.has(key)) {
                existingKeys.add(key);
                additions.push(ev);
              }
            }
        }
      }
      if (additions.length) {
        safeLog(`Injected ${additions.length} future Teams@Haas events beyond horizon`);
      }
      // Merge and resort
      const merged = [...filtered, ...additions];
      merged.sort((a,b) => +new Date(a.start) - +new Date(b.start));
      return merged;
    };

    // Filter and sort events for each cohort
    let filteredBlue = filterEventsByDateRange(blueEvents, daysAhead, limit);
    let filteredGold = filterEventsByDateRange(goldEvents, daysAhead, limit);
    const filteredOriginal = filterEventsByDateRange(originalEvents, daysAhead * 2, limit * 2); // Wider range for matching

    // Ensure Teams@Haas future events (e.g., Oct, Feb) are present
    filteredBlue = injectTeams(filteredBlue, blueEvents);
    filteredGold = injectTeams(filteredGold, goldEvents);

    // Filter and limit launch events with extended date range (6 months ahead)
    const filteredLaunch = filterEventsByDateRange(launchEvents, daysAhead * 6, limit);
    
    // Filter and limit Cal Bears events with extended date range (6 months ahead)
    const filteredCalBears = filterEventsByDateRange(calBearsEvents, daysAhead * 6, limit);
    
    // Filter and limit Campus Groups events with extended date range (6 months ahead)
    const filteredCampusGroups = filterEventsByDateRange(campusGroupsEvents, daysAhead * 6, limit);
    
    // Filter and limit Academic Calendar events with extended date range (6 months ahead)
    const filteredAcademicCalendar = filterEventsByDateRange(academicCalendarEvents, daysAhead * 6, limit);
    
    // Filter and limit CMG events with extended date range (6 months ahead)
    const filteredCMG = filterEventsByDateRange(cmgEvents, daysAhead * 6, limit);

    safeLog(`Filtered events - Blue: ${filteredBlue.length}, Gold: ${filteredGold.length}, Original: ${filteredOriginal.length}, Launch: ${filteredLaunch.length}, Cal Bears: ${filteredCalBears.length}, Campus Groups: ${filteredCampusGroups.length}, Academic Calendar: ${filteredAcademicCalendar.length}, CMG: ${filteredCMG.length}`);

    return {
      blue: filteredBlue,
      gold: filteredGold,
      original: filteredOriginal,
      launch: filteredLaunch,
      calBears: filteredCalBears,
      campusGroups: filteredCampusGroups,
      academicCalendar: filteredAcademicCalendar,
      cmg: filteredCMG
    };
  } catch (error) {
    safeError('Error fetching cohort events:', error);
    throw error;
  }
}

/**
 * Fallback to single calendar for backward compatibility
 */
export async function getSingleCalendarEvents(
  daysAhead = 30,
  limit = 150
): Promise<CalendarEvent[]> {
  safeLog('Fetching single calendar events (fallback mode)');

  try {
    // Try to read the main calendar.ics file
    const icsText = await fetchIcsData('calendar.ics');
    const events = parseIcsToEvents(icsText, 'blue'); // Default to blue for compatibility
    return filterEventsByDateRange(events, daysAhead, limit);
  } catch (error) {
    safeError('Error fetching single calendar events:', error);
    throw error;
  }
}
