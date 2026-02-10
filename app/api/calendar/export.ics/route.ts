/**
 * ICS Calendar Export API
 * 
 * Generates a subscribable ICS/iCalendar feed from OskiHub events.
 * Gmail, Apple Calendar, and Outlook can subscribe to this URL for automatic updates.
 * 
 * Usage: GET /api/calendar/export.ics?blue=1&calbears=1&newsletter=1
 * 
 * Query parameters (all optional, all default to false):
 *   - blue: Include blue cohort class events
 *   - gold: Include gold cohort class events  
 *   - uclaunch: Include UC Launch Accelerator events
 *   - calbears: Include Cal Bears sporting events
 *   - campusgroups: Include Campus Groups events
 *   - newsletter: Include newsletter-extracted events
 *   - greektheater: Include Greek Theater events
 *   - teamsathaas: Include Teams@Haas events
 *   - cmg: Include CMG (Career Management Group) events
 *   - all: Include all event types (shortcut)
 */

// Node runtime required for ical parsing
export const runtime = 'nodejs';
// Force dynamic rendering for this API route
export const dynamic = 'force-dynamic';
// Cache for 30 minutes on server
export const revalidate = 1800;

import { NextRequest, NextResponse } from 'next/server';
import { getCohortEvents, type CalendarEvent } from '@/lib/icsUtils';
import { 
  generateIcsCalendar, 
  parseFilterOptionsFromParams,
  type IcsFilterOptions 
} from '@/lib/icsGenerator';
import { parseGreekTheaterEvents, greekTheaterToCalendarEvent } from '@/lib/greekTheater';

// Safe logging that doesn't interfere with responses in production
const safeLog = (...args: unknown[]) => {
  if (process.env.NODE_ENV === 'development') {
    console.log(...args);
  }
};

const safeError = (...args: unknown[]) => {
  console.error(...args);
};

/**
 * Fetch newsletter events from the newsletter API and convert to CalendarEvent format
 */
async function fetchNewsletterEvents(): Promise<CalendarEvent[]> {
  try {
    // Get base URL for internal API call
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL 
      || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
    
    safeLog('[ICS Export] Fetching newsletter data...');
    
    const response = await fetch(`${baseUrl}/api/newsletter`, {
      next: { revalidate: 3600 } // Cache for 1 hour
    });
    
    if (!response.ok) {
      safeLog('[ICS Export] Newsletter API returned non-OK status:', response.status);
      return [];
    }
    
    const newsletterData = await response.json();
    
    if (!newsletterData?.sections) {
      safeLog('[ICS Export] No newsletter sections found');
      return [];
    }
    
    const events: CalendarEvent[] = [];
    
    safeLog(`[ICS Export] Newsletter has ${newsletterData.sections?.length || 0} sections`);
    
    // Extract events from newsletter sections
    newsletterData.sections.forEach((section: { sectionTitle?: string; items?: { title: string; html?: string; timeSensitive?: { dates?: string[]; priority?: string; eventType?: string } }[] }) => {
      if (!section.items) return;
      
      safeLog(`[ICS Export] Section "${section.sectionTitle}" has ${section.items.length} items`);
      
      section.items.forEach((item: { title: string; html?: string; timeSensitive?: { dates?: string[]; priority?: string; eventType?: string } }) => {
        safeLog(`[ICS Export] Processing: "${item.title}"`);
        
        // Collect all dates for this item
        const allDates: string[] = [];
        
        // Strategy 1: Check for time-sensitive items with dates
        if (item.timeSensitive?.dates && Array.isArray(item.timeSensitive.dates)) {
          safeLog(`  Found ${item.timeSensitive.dates.length} timeSensitive dates`);
          allDates.push(...item.timeSensitive.dates);
        }
        
        // Strategy 2: Parse dates from HTML content (fallback)
        if (allDates.length === 0 && item.html) {
          const content = item.html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
          const datePattern = /\b(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{1,2}(?:,?\s+\d{4})?\b/gi;
          const matches = content.match(datePattern);
          
          if (matches && matches.length > 0) {
            safeLog(`  Found ${matches.length} date matches in content: ${matches.join(', ')}`);
            const currentYear = new Date().getFullYear();
            const seenDates = new Set<string>();
            
            matches.forEach((dateMatch: string) => {
              try {
                const hasYear = /\d{4}/.test(dateMatch);
                const eventDate = new Date(hasYear ? dateMatch : `${dateMatch}, ${currentYear}`);
                
                if (!isNaN(eventDate.getTime())) {
                  const dateKey = eventDate.toISOString().split('T')[0];
                  if (!seenDates.has(dateKey)) {
                    seenDates.add(dateKey);
                    allDates.push(eventDate.toISOString());
                  }
                }
              } catch {
                // Skip invalid dates
              }
            });
          }
        }
        
        // Create events for all found dates
        if (allDates.length > 0) {
          safeLog(`  Creating ${allDates.length} events for "${item.title}"`);
          
          allDates.forEach((dateStr: string) => {
            try {
              const eventDate = new Date(dateStr);
              if (!isNaN(eventDate.getTime())) {
                // Strip HTML for description
                const plainText = (item.html || '')
                  .replace(/<[^>]*>/g, ' ')
                  .replace(/\s+/g, ' ')
                  .replace(/&nbsp;/g, ' ')
                  .replace(/&amp;/g, '&')
                  .trim()
                  .slice(0, 500); // Limit description length
                
                events.push({
                  uid: `newsletter-${item.title.slice(0, 20).replace(/[^a-zA-Z0-9]/g, '')}-${dateStr}`,
                  title: item.title,
                  start: eventDate.toISOString(),
                  end: eventDate.toISOString(),
                  allDay: true,
                  description: plainText,
                  source: 'newsletter',
                  categories: ['Newsletter', section.sectionTitle || 'Announcement']
                });
                
                safeLog(`    ✓ Created event for ${eventDate.toISOString().split('T')[0]}`);
              }
            } catch {
              // Skip invalid dates
            }
          });
        } else {
          safeLog(`  ⚠️ No dates found for "${item.title}"`);
        }
      });
    });
    
    safeLog(`[ICS Export] Extracted ${events.length} events from newsletter`);
    
    // Debug: show sample events
    if (events.length > 0) {
      safeLog(`[ICS Export] Sample event:`, JSON.stringify(events[0], null, 2));
    }
    
    return events;
  } catch (error) {
    safeError('[ICS Export] Error fetching newsletter events:', error);
    return [];
  }
}

/**
 * Fetch Greek Theater events and convert to CalendarEvent format
 */
function fetchGreekTheaterEvents(): CalendarEvent[] {
  try {
    const greekEvents = parseGreekTheaterEvents();
    const calendarEvents = greekEvents.map(event => {
      const calEvent = greekTheaterToCalendarEvent(event);
      return {
        ...calEvent,
        source: 'greek_theater',
        allDay: false
      };
    });
    safeLog(`[ICS Export] Loaded ${calendarEvents.length} Greek Theater events`);
    return calendarEvents;
  } catch (error) {
    safeError('[ICS Export] Error loading Greek Theater events:', error);
    return [];
  }
}

export async function GET(request: NextRequest) {
  try {
    safeLog('[ICS Export] Processing request...');
    
    const { searchParams } = new URL(request.url);
    
    // Check for 'all' parameter (shortcut to include everything)
    const includeAll = searchParams.get('all') === 'true' || searchParams.get('all') === '1';
    
    // Parse filter options from query params
    let filterOptions: IcsFilterOptions;
    if (includeAll) {
      filterOptions = {
        blueClasses: true,
        goldClasses: true,
        ucLaunch: true,
        calBears: true,
        campusGroups: true,
        newsletter: true,
        greekTheater: true,
        teamsAtHaas: true,
        cmg: true
      };
    } else {
      filterOptions = parseFilterOptionsFromParams(searchParams);
    }
    
    safeLog('[ICS Export] Filter options:', filterOptions);
    
    // Check if at least one option is selected
    const hasAnyFilter = Object.values(filterOptions).some(v => v === true);
    if (!hasAnyFilter) {
      // Default to blue cohort classes if nothing selected
      filterOptions.blueClasses = true;
      safeLog('[ICS Export] No filters specified, defaulting to blue classes');
    }
    
    // Collect all events based on selected filters
    const allEvents: CalendarEvent[] = [];
    
    // Fetch cohort and related events
    if (filterOptions.blueClasses || filterOptions.goldClasses || 
        filterOptions.ucLaunch || filterOptions.calBears || 
        filterOptions.campusGroups || filterOptions.teamsAtHaas ||
        filterOptions.cmg) {
      
      safeLog('[ICS Export] Fetching cohort events...');
      const cohortEvents = await getCohortEvents(365, 500); // Extended range
      
      if (filterOptions.blueClasses) {
        allEvents.push(...cohortEvents.blue);
      }
      if (filterOptions.goldClasses) {
        allEvents.push(...cohortEvents.gold);
      }
      if (filterOptions.ucLaunch) {
        allEvents.push(...cohortEvents.launch);
      }
      if (filterOptions.calBears) {
        allEvents.push(...cohortEvents.calBears);
      }
      if (filterOptions.campusGroups) {
        allEvents.push(...cohortEvents.campusGroups);
      }
      if (filterOptions.cmg) {
        allEvents.push(...(cohortEvents.cmg || []));
      }
      
      safeLog(`[ICS Export] Added cohort events: ${allEvents.length} total`);
    }
    
    // Fetch newsletter events
    if (filterOptions.newsletter) {
      const newsletterEvents = await fetchNewsletterEvents();
      allEvents.push(...newsletterEvents);
      safeLog(`[ICS Export] Added newsletter events, now ${allEvents.length} total`);
    }
    
    // Fetch Greek Theater events
    if (filterOptions.greekTheater) {
      const greekEvents = fetchGreekTheaterEvents();
      allEvents.push(...greekEvents);
      safeLog(`[ICS Export] Added Greek Theater events, now ${allEvents.length} total`);
    }
    
    // Build calendar name based on filters
    const calendarNameParts: string[] = ['OskiHub'];
    if (filterOptions.blueClasses && !filterOptions.goldClasses) calendarNameParts.push('Blue');
    if (filterOptions.goldClasses && !filterOptions.blueClasses) calendarNameParts.push('Gold');
    if (filterOptions.calBears) calendarNameParts.push('Cal Bears');
    if (filterOptions.newsletter) calendarNameParts.push('Newsletter');
    if (filterOptions.ucLaunch) calendarNameParts.push('UC Launch');
    if (filterOptions.greekTheater) calendarNameParts.push('Greek Theater');
    if (filterOptions.cmg) calendarNameParts.push('CMG');
    const calendarName = calendarNameParts.length > 1 ? calendarNameParts.join(' - ') : 'OskiHub Calendar';
    
    // Generate ICS content (no additional filtering needed, events are pre-filtered)
    const icsContent = generateIcsCalendar(allEvents, calendarName);
    
    safeLog(`[ICS Export] Generated ICS with ${allEvents.length} events`);
    
    // Return ICS file with proper headers
    return new NextResponse(icsContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': 'attachment; filename="oskihub-calendar.ics"',
        'Cache-Control': 'public, s-maxage=1800, stale-while-revalidate=3600',
        'X-Event-Count': String(allEvents.length)
      }
    });
    
  } catch (error) {
    safeError('[ICS Export] Error generating ICS:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    // Return error as plain text (not ICS format)
    return new NextResponse(
      `Error generating calendar: ${errorMessage}`, 
      { 
        status: 500,
        headers: {
          'Content-Type': 'text/plain'
        }
      }
    );
  }
}
