import { runAI } from './aiClient';
import { getConsistentToday, getConsistentWeekRange, parseICSDate, isDateInWeekRange } from './date-utils';

// Safe console logging - prevents JSON contamination in production
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

// Daily AI caching configuration
interface CachedAIResult {
  data: CohortMyWeekAnalysis;
  timestamp: number;
  date: string;
}

const AI_CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours
const aiCache = new Map<string, CachedAIResult>();

function getTodayDateString(): string {
  // Use getConsistentToday() for Berkeley-timezone-aware date on Vercel (UTC server)
  const today = getConsistentToday();
  const y = today.getFullYear();
  const m = String(today.getMonth() + 1).padStart(2, '0');
  const d = String(today.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`; // YYYY-MM-DD in Berkeley timezone
}

// function getCacheKey(cohort: string): string {
//   return `ai-summary-${cohort}-${getTodayDateString()}`;
// }

function isCacheValid(cached: CachedAIResult | undefined): boolean {
  if (!cached) return false;
  
  const now = Date.now();
  const isWithinTimeLimit = (now - cached.timestamp) < AI_CACHE_DURATION;
  const isSameDay = cached.date === getTodayDateString();
  
  return isWithinTimeLimit && isSameDay;
}

export interface WeeklyEvent {
  date: string;
  time?: string;
  title: string;
  type: 'assignment' | 'class' | 'exam' | 'administrative' | 'social' | 'newsletter' | 'other';
  priority?: 'high' | 'medium' | 'low';
  description?: string;
  location?: string;
  url?: string;
  // Source tracking for newsletter items
  sourceType?: 'calendar' | 'newsletter';
  newsletterSource?: {
    sectionTitle: string;
    sectionIndex: number;
    itemTitle: string;
    itemIndex: number;
  };
}

// Cohort-specific analysis interface
export interface CohortMyWeekAnalysis {
  weekStart: string;
  weekEnd: string;
  blueEvents: WeeklyEvent[];
  goldEvents: WeeklyEvent[];
  blueSummary: string;
  goldSummary: string;
  processingTime: number;
  aiMeta?: {
    model: string;
    modelsTried: string[];
    ms: number;
  };
}

// Define proper TypeScript interfaces for data structures
interface CohortEvent {
  start: string;
  end?: string;
  title: string;
  summary?: string; // Alternative title field
  description?: string;
  location?: string;
  url?: string;
}

interface CohortEvents {
  blue?: CohortEvent[];
  gold?: CohortEvent[];
}

interface TimeSensitiveInfo {
  dates: string[];
  deadline?: string;
  eventType: 'deadline' | 'event' | 'announcement' | 'reminder';
  priority: 'high' | 'medium' | 'low';
}

interface NewsletterItem {
  title: string;
  html: string;
  timeSensitive?: TimeSensitiveInfo;
}

interface NewsletterSection {
  sectionTitle: string;
  items: NewsletterItem[];
}

interface NewsletterData {
  sections: NewsletterSection[];
}

interface ProcessedNewsletterEvent extends NewsletterItem {
  section: string;
  relevantDates: string[];
  priority?: string;
  eventType?: string;
  fallbackParsing?: boolean;
  // Source tracking for tracing back to newsletter
  sourceMetadata?: {
    sectionTitle: string;
    sectionIndex: number;
    itemTitle: string;
    itemIndex: number;
  };
}

/**
 * Get the date range for "this week" (from today to the upcoming Sunday, inclusive)
 * Uses a consistent timezone approach to avoid SSR/CSR mismatches
 */
function getThisWeekRange(): { start: Date; end: Date } {
  const { start, end } = getConsistentWeekRange();
  
  safeLog(`🗓️ Week range: ${start.toISOString()} to ${end.toISOString()}`);
  safeLog(`   Today: ${getConsistentToday().toDateString()} (day ${getConsistentToday().getDay()}), Week: ${start.toDateString()} to ${end.toDateString()} (Sunday through Sunday, 8 days)`);
  
  return { start, end };
}

/**
 * Categorize calendar events based on title and description patterns
 */
function categorizeEvent(title: string, description?: string, source?: string): { 
  type: WeeklyEvent['type']; 
  priority: WeeklyEvent['priority'] 
} {
  const titleLower = title.toLowerCase();
  const descLower = (description || '').toLowerCase();
  const sourceLower = (source || '').toLowerCase();
  
  // High priority patterns (deadlines, exams)
  if (titleLower.includes('due') || titleLower.includes('deadline') || 
      titleLower.includes('assignment') || titleLower.includes('problem set') ||
      titleLower.includes('project') || titleLower.includes('submission') ||
      descLower.includes('due') || descLower.includes('deadline')) {
    return { type: 'assignment', priority: 'high' };
  }
  
  // Exam patterns
  if (titleLower.includes('exam') || titleLower.includes('test') || 
      titleLower.includes('quiz') || titleLower.includes('midterm') ||
      titleLower.includes('final') || descLower.includes('exam')) {
    return { type: 'exam', priority: 'high' };
  }
  
  // Class session patterns
  if (titleLower.includes('class') || titleLower.includes('session') || 
      titleLower.includes('lecture') || titleLower.includes('seminar') ||
      titleLower.includes('workshop') || titleLower.includes('microeconomics') ||
      titleLower.includes('leading people') || descLower.includes('lecture') ||
      descLower.includes('synchronous')) {
    return { type: 'class', priority: 'medium' };
  }
  
  // Administrative patterns
  if (titleLower.includes('registration') || titleLower.includes('form') || 
      titleLower.includes('application') || titleLower.includes('check-in') ||
      titleLower.includes('integrity') || titleLower.includes('verify') ||
      descLower.includes('registration') || descLower.includes('form')) {
    return { type: 'administrative', priority: 'medium' };
  }
  
  // Social events (teams@haas, networking, events)
  if (sourceLower.includes('teams@haas') || sourceLower.includes('uc_launch') ||
      titleLower.includes('team') || titleLower.includes('networking') ||
      titleLower.includes('social') || titleLower.includes('meetup') ||
      titleLower.includes('debrief') || titleLower.includes('collaborative') ||
      titleLower.includes('pitch') || titleLower.includes('accelerator')) {
    return { type: 'social', priority: 'low' };
  }
  
  // Newsletter content
  if (sourceLower.includes('newsletter')) {
    return { type: 'newsletter', priority: 'low' };
  }
  
  // Default fallback
  return { type: 'other', priority: 'medium' };
}

/**
 * Filter calendar events for the current week
 */
function filterCalendarEventsForWeek(cohortEvents: CohortEvents, weekStart: Date, weekEnd: Date): CohortEvent[] {
  const events: CohortEvent[] = [];
  
  if (!cohortEvents) {
    safeLog('❌ No cohort events provided');
    return events;
  }
  
  // Process blue cohort events
  if (cohortEvents.blue?.length) {
    safeLog(`📘 Processing ${cohortEvents.blue.length} blue cohort events`);
    events.push(...cohortEvents.blue);
  }
  
  // Process gold cohort events
  if (cohortEvents.gold?.length) {
    safeLog(`📙 Processing ${cohortEvents.gold.length} gold cohort events`);
    events.push(...cohortEvents.gold);
  }
  
  safeLog(`📊 Total events before date filtering: ${events.length}`);
  safeLog(`📅 Filtering for range: ${weekStart.toDateString()} to ${weekEnd.toDateString()}`);
  
  // Filter events that fall within the week range
  const filteredEvents = events.filter(event => {
    if (!event.start) {
      safeLog(`⚠️ Event missing start date: ${event.title}`);
      return false;
    }
    
    // Parse the event date more carefully to avoid timezone issues
    const isInRange = isDateInWeekRange(event.start, weekStart, weekEnd);
    const eventDate = parseICSDate(event.start);
    
    if (isInRange) {
      safeLog(`✅ Including event: ${event.title} on ${eventDate.toDateString()}`);
    } else {
      safeLog(`❌ Excluding event: ${event.title} on ${eventDate.toDateString()} (outside range)`);
    }
    
    return isInRange;
  });
  
  safeLog(`📊 Events after date filtering: ${filteredEvents.length}`);
  return filteredEvents;
}

/**
 * Extract newsletter events/announcements for the current week from AI-organized data
 */
function extractNewsletterEventsForWeek(newsletterData: NewsletterData, weekStart: Date, weekEnd: Date): ProcessedNewsletterEvent[] {
  const events: ProcessedNewsletterEvent[] = [];
  
  if (!newsletterData?.sections) {
    safeLog('❌ No newsletter sections found!');
    return events;
  }
  
  safeLog('📰 Analyzing newsletter sections for time-sensitive content...');
  safeLog(`📊 Total sections to process: ${newsletterData.sections.length}`);
  
  // Process each organized section
  newsletterData.sections.forEach((section: NewsletterSection, sectionIndex: number) => {
    if (!section.items) return;
    
    safeLog(`📂 Processing section: ${section.sectionTitle} (${section.items.length} items)`);
    
    safeLog(`📂 Processing section: ${section.sectionTitle} (${section.items.length} items)`);
    
    section.items.forEach((item: NewsletterItem, itemIndex: number) => {
      // Check if item has time-sensitive information
      if (item.timeSensitive && item.timeSensitive.dates) {
        safeLog(`  ✓ Item "${item.title}" has timeSensitive data: ${item.timeSensitive.dates.join(', ')}`);
        const relevantDates = item.timeSensitive.dates.filter((dateStr: string) => {
          try {
            const itemDate = new Date(dateStr);
            return itemDate >= weekStart && itemDate <= weekEnd;
          } catch {
            return false;
          }
        });
        
        if (relevantDates.length > 0) {
          events.push({
            title: item.title,
            html: item.html,
            section: section.sectionTitle,
            timeSensitive: item.timeSensitive,
            relevantDates,
            priority: item.timeSensitive.priority || 'medium',
            eventType: item.timeSensitive.eventType || 'announcement',
            // Add source tracking metadata for click-to-source navigation
            sourceMetadata: {
              sectionTitle: section.sectionTitle,
              sectionIndex,
              itemTitle: item.title,
              itemIndex
            }
          });
          
          safeLog(`📅 Found time-sensitive item: ${item.title} (${relevantDates.length} relevant dates) [Section ${sectionIndex}:${itemIndex}]`);
        }
      } else {
        safeLog(`  ✗ Item "${item.title}" has NO timeSensitive data - checking fallback`);
        // Fallback: Look for date patterns in content for items without time-sensitive tags
        const content = item.html?.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
        if (content) {
          // Enhanced regex to match multiple date formats:
          // - "Sunday, Nov 16" or "Sunday Nov 16"
          // - "Nov 16, 2025" or "Nov 16"
          // - "November 16, 2025"
          // - "Saturday May 23, 2PM" (no comma after month)
          // - "Dec 1 at 11:59 PM"
          const datePatterns = [
            // Pattern 1: Day name + Month + Date (e.g., "Sunday, Nov 16" or "Friday Nov 21")
            /\b(?:Mon|Tues?|Wed(?:nes)?|Thu(?:rs)?|Fri|Sat(?:ur)?|Sun)(?:day)?s?,?\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2}(?:,?\s+\d{4})?\b/gi,
            // Pattern 2: Month + Date (e.g., "Nov 15" or "Dec 1" or "May 23, 2026")
            /\b(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{1,2}(?:,?\s+\d{4})?\b/gi
          ];
          
          const allMatches: string[] = [];
          datePatterns.forEach(pattern => {
            const matches = content.match(pattern);
            if (matches) {
              allMatches.push(...matches);
            }
          });
          
          const dateMatches = allMatches.length > 0 ? allMatches : null;
          
          if (dateMatches) {
            const relevantDates: string[] = [];
            
            // Get year from newsletter title or use current year
            const currentYear = new Date().getFullYear();
            const newsletterYear = currentYear; // Could extract from newsletterData.title if needed
            
            dateMatches.forEach((dateMatch: string) => {
              try {
                // Strip day-of-week (Sunday, Monday, etc.) to avoid JS parsing bugs
                const cleanDateStr = dateMatch.replace(/^\w+,?\s+/, '');
                
                // Check if date string includes a year
                const hasYear = /\d{4}/.test(cleanDateStr);
                
                let eventDate: Date;
                if (hasYear) {
                  // Has year, parse directly
                  eventDate = new Date(cleanDateStr);
                } else {
                  // No year - add newsletter year (or current year)
                  eventDate = new Date(cleanDateStr + ', ' + newsletterYear);
                }
                
                if (eventDate >= weekStart && eventDate <= weekEnd) {
                  // Use local date components to avoid UTC timezone shift
                  const ey = eventDate.getFullYear();
                  const em = String(eventDate.getMonth() + 1).padStart(2, '0');
                  const ed = String(eventDate.getDate()).padStart(2, '0');
                  relevantDates.push(`${ey}-${em}-${ed}`);
                }
              } catch {
                // Ignore invalid dates
              }
            });
            
            // Deduplicate dates (same date mentioned multiple times in one item)
            const uniqueDates = [...new Set(relevantDates)];
            
            if (uniqueDates.length > 0) {
              events.push({
                title: item.title,
                html: item.html,
                section: section.sectionTitle,
                relevantDates: uniqueDates,
                priority: 'low',
                eventType: 'announcement',
                fallbackParsing: true,
                // Add source tracking for fallback items too
                sourceMetadata: {
                  sectionTitle: section.sectionTitle,
                  sectionIndex,
                  itemTitle: item.title,
                  itemIndex
                }
              });
              
              safeLog(`📝 Found fallback item: ${item.title} (${relevantDates.length} dates) [Section ${sectionIndex}:${itemIndex}]`);
            }
          }
        }
      }
    });
  });
  
  safeLog(`📊 Total newsletter events found: ${events.length}`);
  return events;
}



// New function for cohort-specific analysis with daily caching
export async function analyzeCohortMyWeekWithAI(
  cohortEvents: CohortEvents,
  newsletterData: NewsletterData
): Promise<CohortMyWeekAnalysis> {
  
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OpenAI API key not found');
  }

  const today = getTodayDateString();
  const cacheKey = `ai-summary-combined-${today}`;
  
  // Check if we have valid cached data for today
  const cached = aiCache.get(cacheKey);
  
  if (isCacheValid(cached)) {
    safeLog(`📋 Using cached AI summaries for ${today} (cached at ${new Date(cached!.timestamp).toLocaleTimeString()})`);
    
    return {
      ...cached!.data,
      processingTime: 0 // Instant from cache
    };
  }

  safeLog(`🤖 Generating fresh AI summaries for ${today}...`);
  const startTime = Date.now();
  const { start: weekStart, end: weekEnd } = getThisWeekRange();
  
  safeLog('🗓️ Cohort My Week Analysis starting...');
  safeLog('📅 Week range:', weekStart.toISOString(), 'to', weekEnd.toISOString());
  
  try {
    // Filter events for each cohort separately
    const blueCalendarEvents = filterCalendarEventsForWeek({ blue: cohortEvents.blue || [] }, weekStart, weekEnd);
    const goldCalendarEvents = filterCalendarEventsForWeek({ gold: cohortEvents.gold || [] }, weekStart, weekEnd);
    const newsletterEvents = extractNewsletterEventsForWeek(newsletterData, weekStart, weekEnd);
    
    safeLog('📘 Blue cohort calendar events:', blueCalendarEvents.length);
    safeLog('📙 Gold cohort calendar events:', goldCalendarEvents.length);
    safeLog('📰 Newsletter events found:', newsletterEvents.length);
    
    // Skip AI summaries in dev mode (summaries are currently disabled in MyWeekWidget UI)
    // This saves ~32 seconds of AI processing time during development
    const skipAISummariesInDev = process.env.NODE_ENV === 'development';
    
    let blueAnalysis: { events: WeeklyEvent[]; summary: string };
    let goldAnalysis: { events: WeeklyEvent[]; summary: string };
    
    if (skipAISummariesInDev) {
      safeLog('🔧 DEV MODE: Skipping AI summary generation (disabled in UI anyway)');
      
      // Generate basic event lists without AI
      blueAnalysis = await generateBasicAnalysis(blueCalendarEvents, newsletterEvents, 'Blue', weekStart, weekEnd);
      goldAnalysis = await generateBasicAnalysis(goldCalendarEvents, newsletterEvents, 'Gold', weekStart, weekEnd);
    } else {
      // PRODUCTION: Generate AI summaries in parallel for both cohorts
      safeLog('🚀 Running Blue + Gold AI analysis in parallel...');
      [blueAnalysis, goldAnalysis] = await Promise.all([
        generateCohortSpecificAnalysis(
          blueCalendarEvents, 
          newsletterEvents, 
          'Blue', 
          weekStart, 
          weekEnd
        ),
        generateCohortSpecificAnalysis(
          goldCalendarEvents, 
          newsletterEvents, 
          'Gold', 
          weekStart, 
          weekEnd
        )
      ]);
    }

    const result: CohortMyWeekAnalysis = {
      weekStart: weekStart.toISOString().split('T')[0],
      weekEnd: weekEnd.toISOString().split('T')[0],
      blueEvents: blueAnalysis.events,
      goldEvents: goldAnalysis.events,
      blueSummary: blueAnalysis.summary,
      goldSummary: goldAnalysis.summary,
      processingTime: Date.now() - startTime
    };

    // Cache the results for today
    aiCache.set(cacheKey, {
      data: result,
      timestamp: Date.now(),
      date: today
    });
    
    safeLog(`✅ AI summaries cached for ${today} (${result.processingTime}ms)`);
    
    return result;

  } catch (error) {
    safeError('💥 Error in Cohort My Week AI analysis:', error);
    
    // Fallback: return basic event lists without AI processing
    const blueEvents = filterCalendarEventsForWeek({ blue: cohortEvents.blue || [] }, weekStart, weekEnd).map(event => {
      const eventDate = parseICSDate(event.start);
      const originalEventDate = new Date(event.start);
      const { type, priority } = categorizeEvent(
        event.summary || event.title || 'Calendar Event',
        event.description
      );
      
      return {
        date: `${eventDate.getFullYear()}-${String(eventDate.getMonth() + 1).padStart(2, '0')}-${String(eventDate.getDate()).padStart(2, '0')}`,
        time: originalEventDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }),
        title: event.summary || event.title || 'Calendar Event',
        type,
        priority,
        description: event.description || undefined,
        location: event.location || undefined,
        url: event.url || undefined
      };
    });

    const goldEvents = filterCalendarEventsForWeek({ gold: cohortEvents.gold || [] }, weekStart, weekEnd).map(event => {
      const eventDate = parseICSDate(event.start);
      const originalEventDate = new Date(event.start);
      const { type, priority } = categorizeEvent(
        event.summary || event.title || 'Calendar Event',
        event.description
      );
      
      return {
        date: `${eventDate.getFullYear()}-${String(eventDate.getMonth() + 1).padStart(2, '0')}-${String(eventDate.getDate()).padStart(2, '0')}`,
        time: originalEventDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }),
        title: event.summary || event.title || 'Calendar Event',
        type,
        priority,
        description: event.description || undefined,
        location: event.location || undefined,
        url: event.url || undefined
      };
    });
    
    const fallbackResult: CohortMyWeekAnalysis = {
      weekStart: weekStart.toISOString().split('T')[0],
      weekEnd: weekEnd.toISOString().split('T')[0],
      blueEvents,
      goldEvents,
      blueSummary: `AI analysis failed for Blue cohort: ${error instanceof Error ? error.message : 'Unknown error'}. Showing basic calendar events.`,
      goldSummary: `AI analysis failed for Gold cohort: ${error instanceof Error ? error.message : 'Unknown error'}. Showing basic calendar events.`,
      processingTime: Date.now() - startTime
    };
    
    // Cache fallback result to avoid repeated failures
    aiCache.set(cacheKey, {
      data: fallbackResult,
      timestamp: Date.now(),
      date: today
    });
    
    return fallbackResult;
  }
}

// Helper function for dev mode - skip AI, just organize events without summaries
async function generateBasicAnalysis(
  calendarEvents: CohortEvent[],
  newsletterEvents: ProcessedNewsletterEvent[],
  cohortName: string,
  weekStart: Date,
  weekEnd: Date
): Promise<{ events: WeeklyEvent[]; summary: string }> {
  
  const events: WeeklyEvent[] = calendarEvents.map(event => {
    const eventDate = parseICSDate(event.start);
    const originalEventDate = new Date(event.start);
    const { type, priority } = categorizeEvent(
      event.summary || event.title || 'Calendar Event',
      event.description
    );
    
    return {
      date: `${eventDate.getFullYear()}-${String(eventDate.getMonth() + 1).padStart(2, '0')}-${String(eventDate.getDate()).padStart(2, '0')}`,
      time: originalEventDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }),
      title: event.summary || event.title || 'Calendar Event',
      type,
      priority,
      description: event.description || undefined,
      location: event.location || undefined,
      url: event.url || undefined
    };
  });
  
  // Add newsletter events
  newsletterEvents.forEach(item => {
    item.relevantDates.forEach(dateStr => {
      events.push({
        date: dateStr,
        title: item.title,
        type: 'newsletter',
        priority: item.priority as WeeklyEvent['priority'] || 'low',
        description: item.html?.replace(/<[^>]*>/g, ' ').substring(0, 200) || undefined,
        sourceType: 'newsletter',
        newsletterSource: item.sourceMetadata
      });
    });
  });
  
  return {
    events,
    summary: `[DEV MODE] ${cohortName} cohort: ${events.length} events this week.`
  };
}

// Helper function to generate cohort-specific analysis
async function generateCohortSpecificAnalysis(
  calendarEvents: CohortEvent[],
  newsletterEvents: ProcessedNewsletterEvent[],
  cohortName: string,
  weekStart: Date,
  weekEnd: Date
): Promise<{ events: WeeklyEvent[]; summary: string }> {
  
  // Prepare content for AI analysis
  const calendarContent = calendarEvents.map(event => {
    const eventDate = parseICSDate(event.start);
    const originalEventDate = new Date(event.start);
    return `Date: ${eventDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} (${eventDate.toISOString().split('T')[0]})
Time: ${originalEventDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
Title: ${event.summary || event.title || 'Untitled Event'}
Description: ${event.description || 'No description'}
Location: ${event.location || 'No location'}
URL: ${event.url || ''}`;
  }).join('\n\n');
  
  const newsletterContent = newsletterEvents.map(event => {
    const dates = event.relevantDates.join(', ');
    const content = event.html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    
    return `Section: ${event.section}
Title: ${event.title}
Relevant Dates: ${dates}
Priority: ${event.priority}
Event Type: ${event.eventType}
Content: ${content.substring(0, 500)}${content.length > 500 ? '...' : ''}`;
  }).join('\n\n');

  const prompt = `You are an AI assistant helping a UC Berkeley EWMBA ${cohortName} cohort student organize their week.

Analyze the following calendar events and newsletter content for the ${cohortName} cohort for the week of ${weekStart.toLocaleDateString()} to ${weekEnd.toLocaleDateString()}.

**${cohortName.toUpperCase()} COHORT CALENDAR EVENTS:**
${calendarContent || `No ${cohortName} cohort calendar events found for this week.`}

**NEWSLETTER HIGHLIGHTS (relevant to all students):**
${newsletterContent || 'No newsletter events found for this week.'}

**REQUIREMENTS:**

1. **Focus specifically on ${cohortName} cohort events** while including relevant general announcements
2. **Extract and organize ALL relevant events** for this specific week
3. **Prioritize cohort-specific activities** and deadlines
4. **Categorize each event** using these specific types:
   - 'assignment': Homework, problem sets, projects due, deadlines
   - 'class': Lectures, seminars, class sessions, workshops
   - 'exam': Tests, quizzes, midterms, finals
   - 'administrative': Registration, forms, check-ins, verification
   - 'social': Teams@Haas, networking, group activities, social events
   - 'newsletter': General announcements and information
   - 'other': Events that don't fit other categories
5. **Assign priority levels**: 'high' for deadlines and exams, 'medium' for classes and administrative items, 'low' for social and newsletter content
6. **Provide a casual, funny weekly summary** (1-2 sentences max, under 230 characters) with personality - use humor, and conversational tone to highlight key themes for the ${cohortName} cohort
7. **Preserve all important details** including times, locations, and URLs
8. **Format dates consistently** as YYYY-MM-DD

**SUMMARY TONE REQUIREMENTS:**
- **Character limit**: EXACTLY 200-230 characters (including spaces) - aim for the sweet spot!
- **Tone**: Casual, encouraging and friendly
- **Style**: NO emoji use, use contractions, keep it encouraging and motivational
- **Focus**: What's actually important this week with clear, actionable guidance


Return ONLY a JSON object with this exact structure:

{
  "events": [
    {
      "date": "2025-09-17",
      "time": "6:00 PM", 
      "title": "Event Title",
      "type": "assignment",
      "priority": "high",
      "description": "Brief description",
      "location": "Location if available",
      "url": "URL if available"
    }
  ],
  "aiSummary": "This week's focus: [clear, encouraging summary in 200-230 chars]"
}`;

  safeLog(`🤖 Sending ${cohortName} cohort analysis to AI...`);
  
  const ai = await runAI({ prompt, reasoningEffort: 'low', verbosity: 'low', temperature: 0.1 });
  const response = ai.text;
  safeLog(`📦 Raw AI response for ${cohortName} cohort length:`, response.length);
  
  // Clean up the response - same logic as main analyzer
  let cleanedResponse = response;
  if (cleanedResponse.startsWith('```json')) {
    cleanedResponse = cleanedResponse.slice(7);
  }
  if (cleanedResponse.startsWith('```')) {
    cleanedResponse = cleanedResponse.slice(3);
  }
  if (cleanedResponse.endsWith('```')) {
    cleanedResponse = cleanedResponse.slice(0, -3);
  }
  cleanedResponse = cleanedResponse.trim();
  
  // Basic validation - ensure we have a complete JSON object
  if (!cleanedResponse.startsWith('{') || !cleanedResponse.endsWith('}')) {
    safeError(`❌ AI response for ${cohortName} does not appear to be a complete JSON object`);
    safeLog('🔍 Response start:', cleanedResponse.substring(0, 100));
    safeLog('🔍 Response end:', cleanedResponse.substring(Math.max(0, cleanedResponse.length - 100)));
    throw new Error(`AI response for ${cohortName} is not a complete JSON object`);
  }
  
  safeLog('🔍 Attempting to parse AI response...');
  
  let parsed;
  try {
    parsed = JSON.parse(cleanedResponse);
  } catch (parseError) {
    safeError('❌ JSON parsing failed:', parseError);
    safeLog('🔍 Problematic response excerpt:', cleanedResponse.substring(0, 500) + '...');
    throw new Error(`Failed to parse AI response as JSON: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`);
  }
  
  // Ensure events have proper categorization and fallback if needed
  const processedEvents = (parsed.events || []).map((event: Partial<WeeklyEvent> & { title: string }) => {
    // If AI didn't provide proper categorization, apply our logic
    if (!event.type || !['assignment', 'class', 'exam', 'administrative', 'social', 'newsletter', 'other'].includes(event.type)) {
      const { type, priority } = categorizeEvent(event.title, event.description);
      event.type = type;
      event.priority = priority;
    }
    
    // Ensure priority is set
    if (!event.priority) {
      event.priority = categorizeEvent(event.title, event.description).priority;
    }
    
    // Try to match back to newsletter source for traceability
    // Check if this event came from a newsletter item
    const matchingNewsletterEvent = newsletterEvents.find(
      ne => ne.title === event.title || 
            ne.title.toLowerCase().includes(event.title.toLowerCase()) ||
            event.title.toLowerCase().includes(ne.title.toLowerCase())
    );
    
    if (matchingNewsletterEvent?.sourceMetadata) {
      // This is a newsletter-sourced event - add source tracking
      return {
        ...event,
        sourceType: 'newsletter' as const,
        newsletterSource: matchingNewsletterEvent.sourceMetadata
      };
    }
    
    // Calendar-sourced events
    return {
      ...event,
      sourceType: 'calendar' as const
    };
  });
  
  return {
    events: processedEvents,
    summary: parsed.aiSummary || `No summary generated for ${cohortName} cohort`
  };
}
