/**
 * ICS Calendar Generator
 * 
 * Generates valid ICS/iCalendar format files from CalendarEvent arrays.
 * Used to create subscribable calendar feeds for external calendar apps (Gmail, Apple, Outlook).
 */

import type { CalendarEvent } from './icsUtils';

// Calendar name for the generated feed
const CALENDAR_NAME = 'OskiHub Calendar';
const CALENDAR_PRODID = '-//OskiHub//EWMBA Hub Calendar//EN';

/**
 * Escape special characters for ICS text fields
 */
function escapeIcsText(text: string): string {
  if (!text) return '';
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '');
}

/**
 * Format a date to ICS date format (YYYYMMDD) for all-day events
 */
function formatIcsDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}${month}${day}`;
}

/**
 * Format a date to ICS datetime format (YYYYMMDDTHHMMSS) for timed events in Pacific Time
 * This uses local time representation (not UTC) for use with TZID=America/Los_Angeles
 */
function formatIcsDateTimeLocal(date: Date): string {
  // Convert to PST/PDT using Intl.DateTimeFormat for reliable server-side timezone handling
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
  
  const parts = formatter.formatToParts(date);
  const get = (type: string) => parts.find(p => p.type === type)?.value || '00';
  
  const year = get('year');
  const month = get('month');
  const day = get('day');
  const hours = get('hour');
  const minutes = get('minute');
  const seconds = get('second');
  
  return `${year}${month}${day}T${hours}${minutes}${seconds}`;
}

/**
 * Format a date to ICS datetime format (YYYYMMDDTHHMMSSZ) for timed events in UTC
 * Use this for DTSTAMP which must be in UTC
 */
function formatIcsDateTimeUTC(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  const hours = String(date.getUTCHours()).padStart(2, '0');
  const minutes = String(date.getUTCMinutes()).padStart(2, '0');
  const seconds = String(date.getUTCSeconds()).padStart(2, '0');
  return `${year}${month}${day}T${hours}${minutes}${seconds}Z`;
}

/**
 * Generate a unique UID for an event
 */
function generateUid(event: CalendarEvent): string {
  if (event.uid) {
    return event.uid;
  }
  // Create a UID from title and start date if none exists
  const hash = `${event.title}-${event.start}`.replace(/[^a-zA-Z0-9]/g, '');
  return `${hash}@oskihub.com`;
}

/**
 * Fold long lines per ICS spec (max 75 chars, continuation starts with space)
 */
function foldLine(line: string): string {
  const maxLength = 75;
  if (line.length <= maxLength) return line;
  
  let result = '';
  let currentPosition = 0;
  
  while (currentPosition < line.length) {
    if (currentPosition === 0) {
      result += line.substring(0, maxLength);
      currentPosition = maxLength;
    } else {
      result += '\r\n ' + line.substring(currentPosition, currentPosition + maxLength - 1);
      currentPosition += maxLength - 1;
    }
  }
  
  return result;
}

/**
 * Get a category based on event source for ICS CATEGORIES field
 */
function getEventCategory(event: CalendarEvent): string[] {
  const categories: string[] = [];
  
  if (!event.source) {
    categories.push('General');
    return categories;
  }
  
  const source = event.source.toLowerCase();
  
  if (source.includes('uc_launch')) {
    categories.push('UC Launch');
  } else if (source.includes('cal_bears')) {
    categories.push('Cal Bears');
  } else if (source.includes('campus_groups')) {
    categories.push('Campus Groups');
  } else if (source.includes('newsletter') || source === 'newsletter') {
    categories.push('Newsletter');
  } else if (source.includes('teams@haas')) {
    categories.push('Teams@Haas');
  } else if (source.includes('201') || source.includes('micro')) {
    categories.push('EWMBA 201');
    categories.push('Microeconomics');
  } else if (source.includes('202') || source.includes('datadecisions')) {
    categories.push('EWMBA 202');
    categories.push('Data & Decisions');
  } else if (source.includes('205') || source.includes('leadingpeople')) {
    categories.push('EWMBA 205');
    categories.push('Leading People');
  } else if (source.includes('208') || source.includes('marketing')) {
    categories.push('EWMBA 208');
    categories.push('Marketing');
  } else {
    categories.push('EWMBA Class');
  }
  
  // Add cohort if available
  if (event.cohort) {
    categories.push(`Cohort ${event.cohort.charAt(0).toUpperCase() + event.cohort.slice(1)}`);
  }
  
  return categories;
}

/**
 * Convert a single CalendarEvent to ICS VEVENT format
 */
function eventToVEvent(event: CalendarEvent): string {
  const lines: string[] = [];
  
  lines.push('BEGIN:VEVENT');
  
  // UID (required)
  lines.push(`UID:${generateUid(event)}`);
  
  // Timestamp (required) - must be in UTC
  const now = new Date();
  lines.push(`DTSTAMP:${formatIcsDateTimeUTC(now)}`);
  
  // Start date/time (required)
  const startDate = new Date(event.start);
  if (event.allDay) {
    lines.push(`DTSTART;VALUE=DATE:${formatIcsDate(startDate)}`);
  } else {
    // Use timezone-aware format for timed events
    lines.push(`DTSTART;TZID=America/Los_Angeles:${formatIcsDateTimeLocal(startDate)}`);
  }
  
  // End date/time (optional but recommended)
  if (event.end) {
    const endDate = new Date(event.end);
    if (event.allDay) {
      // For all-day events, end is exclusive in ICS spec, so add 1 day
      endDate.setDate(endDate.getDate() + 1);
      lines.push(`DTEND;VALUE=DATE:${formatIcsDate(endDate)}`);
    } else {
      // Use timezone-aware format for timed events
      lines.push(`DTEND;TZID=America/Los_Angeles:${formatIcsDateTimeLocal(endDate)}`);
    }
  } else if (event.allDay) {
    // If no end date for all-day, default to 1 day duration
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 1);
    lines.push(`DTEND;VALUE=DATE:${formatIcsDate(endDate)}`);
  }
  
  // Summary/Title (required)
  lines.push(`SUMMARY:${escapeIcsText(event.title)}`);
  
  // Description (optional)
  if (event.description) {
    // Strip HTML tags for ICS description
    const plainDescription = event.description
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .trim();
    if (plainDescription) {
      lines.push(`DESCRIPTION:${escapeIcsText(plainDescription)}`);
    }
  }
  
  // Location (optional)
  if (event.location) {
    lines.push(`LOCATION:${escapeIcsText(event.location)}`);
  }
  
  // URL (optional)
  if (event.url) {
    lines.push(`URL:${event.url}`);
  }
  
  // Categories
  const categories = getEventCategory(event);
  if (categories.length > 0) {
    lines.push(`CATEGORIES:${categories.map(escapeIcsText).join(',')}`);
  }
  
  // Status
  if (event.status) {
    lines.push(`STATUS:${event.status.toUpperCase()}`);
  } else {
    lines.push('STATUS:CONFIRMED');
  }
  
  // Add source as X-property for debugging/filtering
  if (event.source) {
    lines.push(`X-OSKIHUB-SOURCE:${escapeIcsText(event.source)}`);
  }
  
  lines.push('END:VEVENT');
  
  return lines.map(foldLine).join('\r\n');
}

/**
 * Event filter options for ICS generation
 */
export interface IcsFilterOptions {
  /** Include blue cohort class events */
  blueClasses?: boolean;
  /** Include gold cohort class events */
  goldClasses?: boolean;
  /** Include UC Launch Accelerator events */
  ucLaunch?: boolean;
  /** Include Cal Bears sporting events */
  calBears?: boolean;
  /** Include Campus Groups events */
  campusGroups?: boolean;
  /** Include Newsletter-extracted events */
  newsletter?: boolean;
  /** Include Greek Theater events */
  greekTheater?: boolean;
  /** Include Teams@Haas events */
  teamsAtHaas?: boolean;
}

/**
 * Check if an event matches the given filter options
 */
export function eventMatchesFilter(event: CalendarEvent, options: IcsFilterOptions): boolean {
  const source = (event.source || '').toLowerCase();
  
  // Newsletter events
  if (source === 'newsletter' || source.includes('newsletter')) {
    return options.newsletter === true;
  }
  
  // UC Launch events
  if (source.includes('uc_launch')) {
    return options.ucLaunch === true;
  }
  
  // Cal Bears events
  if (source.includes('cal_bears')) {
    return options.calBears === true;
  }
  
  // Campus Groups events
  if (source.includes('campus_groups')) {
    return options.campusGroups === true;
  }
  
  // Greek Theater events
  if (source.includes('greek_theater') || source.includes('greektheater')) {
    return options.greekTheater === true;
  }
  
  // Teams@Haas events (check before class sources since it's in class ICS files)
  if (event.title.includes('Teams@Haas') || source.includes('teams@haas')) {
    return options.teamsAtHaas === true;
  }
  
  // Class events - check cohort
  if (event.cohort === 'blue') {
    return options.blueClasses === true;
  }
  
  if (event.cohort === 'gold') {
    return options.goldClasses === true;
  }
  
  // Default: include if any class option is selected
  if (options.blueClasses || options.goldClasses) {
    return true;
  }
  
  return false;
}

/**
 * Generate a complete ICS calendar file from an array of events
 */
export function generateIcsCalendar(
  events: CalendarEvent[], 
  calendarName: string = CALENDAR_NAME,
  filterOptions?: IcsFilterOptions
): string {
  const lines: string[] = [];
  
  // Calendar header
  lines.push('BEGIN:VCALENDAR');
  lines.push('VERSION:2.0');
  lines.push(`PRODID:${CALENDAR_PRODID}`);
  lines.push('CALSCALE:GREGORIAN');
  lines.push('METHOD:PUBLISH');
  lines.push(`X-WR-CALNAME:${escapeIcsText(calendarName)}`);
  lines.push('X-WR-TIMEZONE:America/Los_Angeles');
  
  // Add timezone component for Pacific Time
  lines.push('BEGIN:VTIMEZONE');
  lines.push('TZID:America/Los_Angeles');
  lines.push('BEGIN:DAYLIGHT');
  lines.push('TZOFFSETFROM:-0800');
  lines.push('TZOFFSETTO:-0700');
  lines.push('TZNAME:PDT');
  lines.push('DTSTART:19700308T020000');
  lines.push('RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU');
  lines.push('END:DAYLIGHT');
  lines.push('BEGIN:STANDARD');
  lines.push('TZOFFSETFROM:-0700');
  lines.push('TZOFFSETTO:-0800');
  lines.push('TZNAME:PST');
  lines.push('DTSTART:19701101T020000');
  lines.push('RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU');
  lines.push('END:STANDARD');
  lines.push('END:VTIMEZONE');
  
  // Filter events if options provided
  let filteredEvents = events;
  if (filterOptions) {
    filteredEvents = events.filter(event => eventMatchesFilter(event, filterOptions));
  }
  
  // Add events
  for (const event of filteredEvents) {
    lines.push(eventToVEvent(event));
  }
  
  // Calendar footer
  lines.push('END:VCALENDAR');
  
  return lines.join('\r\n');
}

/**
 * Parse filter options from URL query parameters
 */
export function parseFilterOptionsFromParams(params: URLSearchParams): IcsFilterOptions {
  // Helper to parse boolean params (defaults to false unless explicitly 'true' or '1')
  const getBoolParam = (key: string, defaultValue: boolean = false): boolean => {
    const value = params.get(key);
    if (value === null) return defaultValue;
    return value === 'true' || value === '1';
  };
  
  return {
    blueClasses: getBoolParam('blue', false),
    goldClasses: getBoolParam('gold', false),
    ucLaunch: getBoolParam('uclaunch', false),
    calBears: getBoolParam('calbears', false),
    campusGroups: getBoolParam('campusgroups', false),
    newsletter: getBoolParam('newsletter', false),
    greekTheater: getBoolParam('greektheater', false),
    teamsAtHaas: getBoolParam('teamsathaas', false),
  };
}

/**
 * Build a subscription URL for the ICS feed with given filter options
 */
export function buildIcsSubscriptionUrl(baseUrl: string, options: IcsFilterOptions): string {
  const params = new URLSearchParams();
  
  if (options.blueClasses) params.set('blue', '1');
  if (options.goldClasses) params.set('gold', '1');
  if (options.ucLaunch) params.set('uclaunch', '1');
  if (options.calBears) params.set('calbears', '1');
  if (options.campusGroups) params.set('campusgroups', '1');
  if (options.newsletter) params.set('newsletter', '1');
  if (options.greekTheater) params.set('greektheater', '1');
  if (options.teamsAtHaas) params.set('teamsathaas', '1');
  
  const queryString = params.toString();
  return queryString ? `${baseUrl}?${queryString}` : baseUrl;
}
