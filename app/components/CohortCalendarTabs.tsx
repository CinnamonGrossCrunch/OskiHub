'use client';

// ============================================================================
// IMPORTS
// ============================================================================
import { useState, useEffect, useRef } from 'react';
import { format, addMonths, subMonths } from 'date-fns';
import Image from 'next/image';
import MonthGrid from './MonthGrid';
import EventDetailModal, { MultiEventModal } from './EventDetailModal';
import type { CalendarEvent, CohortEvents } from '@/lib/icsUtils';
import type { UnifiedDashboardData } from '@/app/api/unified-dashboard/route';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================
type Props = {
  cohortEvents: CohortEvents;
  title: string;
  externalSelectedCohort?: 'blue' | 'gold';
  newsletterData?: UnifiedDashboardData['newsletterData'];
};

type CohortType = 'blue' | 'gold';

/** Newsletter event type for calendar display */
interface NewsletterCalendarEvent extends CalendarEvent {
  htmlContent?: string;
  sourceMetadata: {
    sectionTitle: string;
    sectionIndex: number;
    itemTitle: string;
    itemIndex: number;
  };
  timeSensitive: {
    dates: string[];
    deadline?: string;
    eventType: 'deadline' | 'event' | 'announcement' | 'reminder';
    priority: 'high' | 'medium' | 'low';
  };
  multipleEvents?: NewsletterCalendarEvent[];
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================
export default function CohortCalendarTabs({ cohortEvents, externalSelectedCohort, newsletterData }: Props) {
  
  // --------------------------------------------------------------------------
  // STATE: Cohort & Navigation
  // --------------------------------------------------------------------------
  const [selectedCohort, setSelectedCohort] = useState<CohortType>(externalSelectedCohort || 'blue');
  const [currentMonth, setCurrentMonth] = useState(new Date());
  
  // --------------------------------------------------------------------------
  // STATE: Event Selection & Modal
  // --------------------------------------------------------------------------
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [matchedOriginalEvent, setMatchedOriginalEvent] = useState<CalendarEvent | null>(null);
  const [currentEventIndex, setCurrentEventIndex] = useState<number>(-1);
  
  // --------------------------------------------------------------------------
  // STATE: Event Source Toggles (which calendars to show)
  // --------------------------------------------------------------------------
  const [showGreekTheater, setShowGreekTheater] = useState(false);
  const [showUCLaunch, setShowUCLaunch] = useState(false);
  const [showCalBears, setShowCalBears] = useState(true);
  const [showCampusGroups, setShowCampusGroups] = useState(false);
  const [showAcademicCalendar, setShowAcademicCalendar] = useState(true);
  const [showNewsletter, setShowNewsletter] = useState(true);
  const [showCMG, setShowCMG] = useState(false);
  
  // --------------------------------------------------------------------------
  // STATE: Newsletter Events (converted from newsletter data)
  // --------------------------------------------------------------------------
  const [newsletterEvents, setNewsletterEvents] = useState<NewsletterCalendarEvent[]>([]);
  
  // --------------------------------------------------------------------------
  // STATE: UI Controls
  // --------------------------------------------------------------------------
  const [showEventDropdown, setShowEventDropdown] = useState(false);
  const [glowingDate, setGlowingDate] = useState<string | null>(null);
  
  // --------------------------------------------------------------------------
  // STATE: Multi-Event Modal (when clicking day with multiple events)
  // --------------------------------------------------------------------------
  const [multiEventModalOpen, setMultiEventModalOpen] = useState(false);
  const [multiEventModalEvents, setMultiEventModalEvents] = useState<CalendarEvent[]>([]);
  const [multiEventModalDate, setMultiEventModalDate] = useState<Date | null>(null);
  
  // --------------------------------------------------------------------------
  // REFS
  // --------------------------------------------------------------------------
  const dropdownRef = useRef<HTMLDivElement>(null);

  // ==========================================================================
  // EFFECTS: Load/Save Preferences from localStorage
  // ==========================================================================
  
  /** Load cohort and toggle preferences from localStorage on mount */
  useEffect(() => {
    if (!externalSelectedCohort) {
      const saved = localStorage.getItem('calendar-cohort');
      if (saved === 'blue' || saved === 'gold') {
        setSelectedCohort(saved);
      }
    }
    
    // Load event toggle preferences
    const savedShowNewsletter = localStorage.getItem('calendar-show-newsletter');
    if (savedShowNewsletter !== null) {
      setShowNewsletter(savedShowNewsletter === 'true');
    }
    
    const savedShowCalBears = localStorage.getItem('calendar-show-calbears');
    if (savedShowCalBears !== null) {
      setShowCalBears(savedShowCalBears === 'true');
    }
    
    const savedShowAcademicCalendar = localStorage.getItem('calendar-show-academic');
    if (savedShowAcademicCalendar !== null) {
      setShowAcademicCalendar(savedShowAcademicCalendar === 'true');
    }
    
    const savedShowCMG = localStorage.getItem('calendar-show-cmg');
    if (savedShowCMG !== null) {
      setShowCMG(savedShowCMG === 'true');
    }
  }, [externalSelectedCohort]);

  // ==========================================================================
  // EFFECT: Convert Newsletter Data to Calendar Events
  // ==========================================================================
  useEffect(() => {
    if (!newsletterData) {
      console.log('📰 [CohortCalendarTabs] No newsletter data provided');
      setNewsletterEvents([]);
      return;
    }

    console.log('📰 [CohortCalendarTabs] Converting newsletter data to calendar events...');
    console.log(`📊 Newsletter has ${newsletterData.sections.length} sections`);
    
    // Debug logging (can be removed in production)
    try {
      newsletterData.sections.forEach((section, idx) => {
        console.log(`📰 Section ${idx}: "${section.sectionTitle || 'NO TITLE'}" (${section.items?.length || 0} items)`);
      });
    } catch (error) {
      console.error('📰 Error logging newsletter structure:', error);
    }

    const events: NewsletterCalendarEvent[] = [];

    newsletterData.sections.forEach((section, sectionIdx) => {
      section.items.forEach((item, itemIdx) => {
        let datesToProcess: string[] = [];
        let eventType: 'deadline' | 'event' | 'announcement' | 'reminder' = 'announcement';
        let priority: 'high' | 'medium' | 'low' = 'medium';
        
        // PRIMARY: Check if item has time-sensitive data from AI
        if (item.timeSensitive && item.timeSensitive.dates && item.timeSensitive.dates.length > 0) {
          console.log(`✓ "${item.title}" has timeSensitive data:`, item.timeSensitive.dates);
          datesToProcess = item.timeSensitive.dates;
          eventType = item.timeSensitive.eventType || 'announcement';
          priority = item.timeSensitive.priority || 'medium';
        } else {
          // FALLBACK: Extract dates from HTML content using regex
          console.log(`✗ "${item.title}" has NO timeSensitive - trying regex fallback...`);
          const content = item.html?.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
          if (content) {
            // Date regex patterns for various formats
            const datePatterns = [
              // "Sunday, Nov 16" or "Friday Nov 21"
              /\b(?:Mon|Tues?|Wed(?:nes)?|Thu(?:rs)?|Fri|Sat(?:ur)?|Sun)(?:day)?s?,?\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2}(?:,?\s+\d{4})?\b/gi,
              // "Nov 15" or "Dec 1" or "May 23, 2026"
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
            
            if (dateMatches && dateMatches.length > 0) {
              console.log(`📅 Found ${dateMatches.length} date(s) via regex:`, dateMatches);
              
              // Get current year for dates without explicit year
              const currentYear = new Date().getFullYear();
              const newsletterTitleMatch = newsletterData.title?.match(/\d{1,2}-\d{1,2}-(\d{4})/);
              const newsletterYear = newsletterTitleMatch ? parseInt(newsletterTitleMatch[1]) : currentYear;
              
              console.log(`📆 Newsletter year extracted: ${newsletterYear} (from title: "${newsletterData.title}")`);
              
              // Convert matched date strings to YYYY-MM-DD format
              datesToProcess = dateMatches
                .map(dateStr => {
                  try {
                    // Strip day-of-week (Sunday, Monday, etc.) to avoid JS parsing bugs
                    const cleanDateStr = dateStr.replace(/^\w+,?\s+/, '');
                    
                    console.log(`  🔍 Processing: "${dateStr}" → cleaned: "${cleanDateStr}"`);
                    
                    // Check if date string includes a year
                    const hasYear = /\d{4}/.test(cleanDateStr);
                    
                    let parsedDate: Date;
                    if (hasYear) {
                      // Has year, parse directly
                      parsedDate = new Date(cleanDateStr);
                      console.log(`    ✓ Has year, parsed as: ${parsedDate.toISOString()}`);
                    } else {
                      // No year - add newsletter year (or current year)
                      // Parse with current year first to get month/day
                      const tempDate = new Date(cleanDateStr + ', ' + newsletterYear);
                      parsedDate = tempDate;
                      console.log(`    ✓ No year, added ${newsletterYear}: ${parsedDate.toISOString()}`);
                    }
                    
                    if (!isNaN(parsedDate.getTime())) {
                      return parsedDate.toISOString().split('T')[0]; // YYYY-MM-DD
                    }
                  } catch {
                    return null;
                  }
                  return null;
                })
                .filter((date): date is string => date !== null);
              
              // Deduplicate dates (same date mentioned multiple times in one item)
              datesToProcess = [...new Set(datesToProcess)];
              
              console.log(`✓ Extracted ${datesToProcess.length} valid date(s) (deduplicated):`, datesToProcess);
            } else {
              console.log(`✗ No date patterns found in content`);
            }
          }
        }
        
        // Skip if no dates found
        if (datesToProcess.length === 0) {
          return;
        }

        // CONSERVATIVE FILTERING: Allow events with 1-3 explicit dates
        // Skip items with many dates (4+, likely digest/parking advisory content)
        if (datesToProcess.length > 3) {
          console.log(`⏭️ Skipping "${item.title}" - has ${datesToProcess.length} dates (likely advisory/digest content)`);
          return;
        }

        // Skip items with titles that indicate digest/advisory content (not specific events)
        const skipPatterns = [
          /saturday scoop/i,
          /sunday scoop/i,
          /weekly digest/i,
          /parking.*advisory/i,
          /underhill.*advisory/i,
          /transportation.*advisory/i
        ];
        
        if (skipPatterns.some(pattern => pattern.test(item.title))) {
          console.log(`⏭️ Skipping "${item.title}" - matches advisory/digest pattern`);
          return;
        }

        // Create one calendar event per date mentioned
        datesToProcess.forEach((dateStr) => {
          try {
            // IMPORTANT: Parse date in local timezone (not UTC) to avoid day shifts
            // When dateStr is "2025-11-04", new Date() interprets as UTC midnight,
            // which becomes Nov 3 at 4PM PST. We need to force local timezone.
            let eventDate: Date;
            
            if (dateStr.includes('T')) {
              // Has time component, parse as-is
              eventDate = new Date(dateStr);
            } else {
              // Date-only string (YYYY-MM-DD): parse in local timezone
              // Add 'T12:00:00' to force noon local time, avoiding UTC conversion
              eventDate = new Date(dateStr + 'T12:00:00');
            }
            
            if (isNaN(eventDate.getTime())) {
              console.warn(`⚠️ Invalid date "${dateStr}" in item "${item.title}"`);
              return;
            }

            // Determine if all-day event (no specific time mentioned)
            const allDay = !dateStr.includes('T') || dateStr.endsWith('T00:00:00');

            // Generate unique UID for this event
            const cleanDate = dateStr.split('T')[0].replace(/-/g, '');
            const uid = `newsletter-${sectionIdx}-${itemIdx}-${cleanDate}`;

            const event: NewsletterCalendarEvent = {
              uid,
              title: item.title,
              start: eventDate.toISOString(),
              end: eventDate.toISOString(),
              allDay,
              description: `From newsletter section: ${section.sectionTitle}`,
              htmlContent: item.html, // Use formatted HTML from organized newsletter
              source: 'newsletter',
              sourceMetadata: {
                sectionTitle: section.sectionTitle,
                sectionIndex: sectionIdx,
                itemTitle: item.title,
                itemIndex: itemIdx,
              },
              timeSensitive: item.timeSensitive!, // We already checked it exists above
            };

            events.push(event);
          } catch (err) {
            console.error(`❌ Error processing date "${dateStr}" for item "${item.title}":`, err);
          }
        });
      });
    });

    console.log(`✅ [CohortCalendarTabs] Converted ${events.length} newsletter events from ${newsletterData.sections.length} sections`);
    setNewsletterEvents(events);
  }, [newsletterData]);

  // ==========================================================================
  // EFFECTS: Save Toggle Preferences to localStorage
  // ==========================================================================
  
  useEffect(() => {
    localStorage.setItem('calendar-show-newsletter', String(showNewsletter));
  }, [showNewsletter]);

  useEffect(() => {
    localStorage.setItem('calendar-show-calbears', String(showCalBears));
  }, [showCalBears]);

  useEffect(() => {
    localStorage.setItem('calendar-show-academic', String(showAcademicCalendar));
  }, [showAcademicCalendar]);

  useEffect(() => {
    localStorage.setItem('calendar-show-cmg', String(showCMG));
  }, [showCMG]);

  // ==========================================================================
  // EFFECT: Close Dropdown When Clicking Outside
  // ==========================================================================
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowEventDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // ==========================================================================
  // EFFECTS: Sync Cohort Selection
  // ==========================================================================
  
  /** Sync with external cohort selection (from parent component) */
  useEffect(() => {
    if (externalSelectedCohort) {
      setSelectedCohort(externalSelectedCohort);
    }
  }, [externalSelectedCohort]);

  /** Save cohort preference to localStorage (only if not externally controlled) */
  useEffect(() => {
    if (!externalSelectedCohort) {
      localStorage.setItem('calendar-cohort', selectedCohort);
    }
  }, [selectedCohort, externalSelectedCohort]);

  // ==========================================================================
  // HANDLERS: Navigation & Cohort Selection
  // ==========================================================================
  
  const handleCohortChange = (cohort: CohortType) => {
    if (!externalSelectedCohort) {
      setSelectedCohort(cohort);
    }
  };

  const goToPreviousMonth = () => {
    setCurrentMonth(prev => subMonths(prev, 1));
  };

  const goToNextMonth = () => {
    setCurrentMonth(prev => addMonths(prev, 1));
  };

  // ==========================================================================
  // HELPER: Generate Course-Specific Content for Events
  // ==========================================================================
  /**
   * Generates fallback content for course events without original calendar matches.
   * Creates bCourses URLs based on course start dates and week numbers.
   */
  const generateCourseContent = (cohortEvent: CalendarEvent): CalendarEvent | null => {
    if (!cohortEvent.source) return null;

    const eventDate = new Date(cohortEvent.start);
    const sourceLower = cohortEvent.source.toLowerCase();
    
    // Detect Spring 2026 courses by filename patterns
    const isSpring2026 = sourceLower.includes('spring2026');
    const isMacro = sourceLower.includes('201b') || sourceLower.includes('macro');
    const isAccounting = sourceLower.includes('accounting') || (sourceLower.includes('202') && isSpring2026);
    
    // Fall 2025 courses
    const isCourse201A = (sourceLower.includes('201a') || sourceLower.includes('201') || sourceLower.includes('micro')) && !isMacro;
    const isLeadingPeople = sourceLower.includes('205') || sourceLower.includes('leadingpeople');
    const isDataDecisions = sourceLower.includes('datadecisions') || (sourceLower.includes('202') && !isSpring2026 && !isAccounting);
    const isMarketing = sourceLower.includes('marketing') || sourceLower.includes('208');
    
    // Check if this matches any known course
    const isFall2025Course = isCourse201A || isLeadingPeople || isDataDecisions || isMarketing;
    const isSpring2026Course = isMacro || isAccounting;
    
    if (!isFall2025Course && !isSpring2026Course) return null;

    // Course start dates and bCourses IDs
    const courseConfig = {
      // Fall 2025 Courses
      micro_blue: { start: new Date(2025, 6, 28), courseId: '1544880', urlPattern: 'pages/week-' }, // July 28, 2025
      micro_gold: { start: new Date(2025, 6, 29), courseId: '1544880', urlPattern: 'pages/week-' }, // July 29, 2025
      leading_blue: { start: new Date(2025, 7, 6), courseId: '1545386', urlPattern: 'pages/' }, // August 6, 2025
      leading_gold: { start: new Date(2025, 7, 7), courseId: '1545386', urlPattern: 'pages/' }, // August 7, 2025
      data_blue: { start: new Date(2025, 9, 14), courseId: '1545042', urlPattern: 'pages/week-' }, // October 14, 2025
      data_gold: { start: new Date(2025, 9, 15), courseId: '1545042', urlPattern: 'pages/week-' }, // October 15, 2025
      marketing_blue: { start: new Date(2025, 9, 14), courseId: '1545360', urlPattern: 'pages/session-' }, // October 14, 2025
      marketing_gold: { start: new Date(2025, 9, 15), courseId: '1545360', urlPattern: 'pages/session-' }, // October 15, 2025
      
      // Spring 2026 Courses
      macro_blue: { start: new Date(2026, 0, 7), courseId: '1549648', urlPattern: 'pages/week-' }, // January 7, 2026
      macro_gold: { start: new Date(2026, 0, 8), courseId: '1549648', urlPattern: 'pages/week-' }, // January 8, 2026
      accounting_blue: { start: new Date(2026, 0, 5), courseId: '1549713', urlPattern: 'pages/week-' }, // January 5, 2026
      accounting_gold: { start: new Date(2026, 0, 6), courseId: '1549713', urlPattern: 'pages/week-' }, // January 6, 2026
    };

    let config: { start: Date; courseId: string; urlPattern: string };
    let courseTitle: string;
    
    if (isMacro) {
      config = selectedCohort === 'blue' ? courseConfig.macro_blue : courseConfig.macro_gold;
      courseTitle = 'MacroEconomics';
    } else if (isAccounting) {
      config = selectedCohort === 'blue' ? courseConfig.accounting_blue : courseConfig.accounting_gold;
      courseTitle = 'Financial Accounting';
    } else if (isCourse201A) {
      config = selectedCohort === 'blue' ? courseConfig.micro_blue : courseConfig.micro_gold;
      courseTitle = 'MicroEconomics';
    } else if (isDataDecisions) {
      config = selectedCohort === 'blue' ? courseConfig.data_blue : courseConfig.data_gold;
      courseTitle = 'Data & Decisions';
    } else if (isMarketing) {
      config = selectedCohort === 'blue' ? courseConfig.marketing_blue : courseConfig.marketing_gold;
      courseTitle = 'Marketing';
    } else {
      config = selectedCohort === 'blue' ? courseConfig.leading_blue : courseConfig.leading_gold;
      courseTitle = 'Leading People';
    }

    const baseUrl = `https://bcourses.berkeley.edu/courses/${config.courseId}/${config.urlPattern}`;

    // Calculate week number
    const weeksDiff = Math.floor((eventDate.getTime() - config.start.getTime()) / (7 * 24 * 60 * 60 * 1000));
    const weekNumber = Math.max(1, weeksDiff + 1); // Start from week 1

    // Generate enhanced content
    const enhancedTitle = isMacro 
      ? `MacroEconomics Week ${weekNumber}`
      : isAccounting
        ? `Financial Accounting Week ${weekNumber}`
        : isCourse201A 
          ? `MicroEconomics Week ${weekNumber}`
          : isDataDecisions
            ? `Data & Decisions Week ${weekNumber}`
            : isMarketing
              ? `Marketing Session ${weekNumber}`
              : `Leading People Week ${weekNumber}`;
    
    // Build course URL
    const courseUrl = isLeadingPeople 
      ? `${baseUrl}week-${weekNumber}`
      : `${baseUrl}${weekNumber}`;

    const enhancedDescription = `For course content for ${courseTitle}, Week ${weekNumber}, please click Event Link. `;

    return {
      ...cohortEvent,
      title: enhancedTitle,
      url: courseUrl,
      description: enhancedDescription,
      location: cohortEvent.location || 'Online (bCourses)',
    };
  };

  // ==========================================================================
  // HELPER: Find Matching Event from Original Calendar
  // ==========================================================================
  /**
   * Matches cohort events to original calendar events for enriched content.
   * Falls back to generated course content if no match found.
   */
  const findMatchingOriginalEvent = (
    cohortEvent: CalendarEvent,
    originalEvents: CalendarEvent[]
  ): CalendarEvent | null => {
    // Teams@Haas events: show as-is without matching
    if (cohortEvent.source && cohortEvent.source.toLowerCase().includes('teams@haas')) {
      return null;
    }

    if (!originalEvents.length) {
      return generateCourseContent(cohortEvent);
    }

    const cohortDate = new Date(cohortEvent.start);

    // Try exact date match
    const sameDateEvents = originalEvents.filter(originalEvent => {
      const originalDate = new Date(originalEvent.start);
      return (
        originalDate.getFullYear() === cohortDate.getFullYear() &&
        originalDate.getMonth() === cohortDate.getMonth() &&
        originalDate.getDate() === cohortDate.getDate()
      );
    });

    if (sameDateEvents.length === 0) {
      return generateCourseContent(cohortEvent);
    }

    const generatedContent = generateCourseContent(cohortEvent);

    // Single event on same date - return with enhanced URL
    if (sameDateEvents.length === 1) {
      return {
        ...sameDateEvents[0],
        url: sameDateEvents[0].url || generatedContent?.url,
      };
    }

    // Multiple events on same date - match by title similarity
    const cohortTitle = cohortEvent.title.toLowerCase();

    /** Helper: Calculate title similarity score (0-1) */
    const getTitleSimilarity = (title1: string, title2: string): number => {
      const t1 = title1.toLowerCase().replace(/[^\w\s]/g, '').trim();
      const t2 = title2.toLowerCase().replace(/[^\w\s]/g, '').trim();

      // Check for common keywords
      const keywords1 = t1.split(/\s+/);
      const keywords2 = t2.split(/\s+/);

      let matches = 0;
      for (const word1 of keywords1) {
        if (word1.length > 2) {
          // Only consider words longer than 2 characters
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

    // Find event with highest title similarity (minimum 30%)
    let bestMatch: CalendarEvent | null = null;
    let bestSimilarity = 0;

    for (const originalEvent of sameDateEvents) {
      const similarity = getTitleSimilarity(cohortTitle, originalEvent.title);
      if (similarity > bestSimilarity && similarity > 0.3) {
        bestSimilarity = similarity;
        bestMatch = originalEvent;
      }
    }

    if (bestMatch) {
      return {
        ...bestMatch,
        url: bestMatch.url || generatedContent?.url,
      };
    }

    // Fallback: use generated course content
    if (generatedContent) {
      return generatedContent;
    }

    // Final fallback: first event on same date
    if (sameDateEvents.length > 0) {
      return sameDateEvents[0] as CalendarEvent;
    }
    
    return null;
  };

  // ==========================================================================
  // HANDLERS: Event Click & Modal Navigation
  // ==========================================================================
  
  /** Handle clicking on an event - opens detail modal */
  const handleEventClick = (event: CalendarEvent) => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    
    const eventIndex = currentEvents.findIndex(e => 
      e.start === event.start && e.title === event.title
    );
    setCurrentEventIndex(eventIndex);
    
    // Teams@Haas: show raw event without enrichment
    if (event.source && event.source.toLowerCase().includes('teams@haas')) {
      setSelectedEvent(event);
      setMatchedOriginalEvent(null);
      return;
    }

    // Try to find matching/enriched event from original calendar
    const enrichedEvent = findMatchingOriginalEvent(event, cohortEvents.original || []);
    
    if (enrichedEvent) {
      const mergedEvent: CalendarEvent = {
        ...event,
        url: event.url || enrichedEvent.url,
      };
      setSelectedEvent(mergedEvent);
      setMatchedOriginalEvent(null);
    } else {
      setSelectedEvent(event);
      setMatchedOriginalEvent(null);
    }
  };

  /** Navigate to next event in list */
  const handleNextEvent = () => {
    if (currentEventIndex < currentEvents.length - 1) {
      const nextEvent = currentEvents[currentEventIndex + 1];
      handleEventClick(nextEvent);
    }
  };

  /** Navigate to previous event in list */
  const handlePreviousEvent = () => {
    if (currentEventIndex > 0) {
      const prevEvent = currentEvents[currentEventIndex - 1];
      handleEventClick(prevEvent);
    }
  };

  /** Close the event detail modal */
  const handleCloseModal = () => {
    setSelectedEvent(null);
    setMatchedOriginalEvent(null);
    setCurrentEventIndex(-1);
  };

  // ==========================================================================
  // HANDLERS: Glow Effect & Multi-Event Modal
  // ==========================================================================
  
  /** Trigger violet glow effect on a date cell (after "View in Newsletter" click) */
  const handleTriggerGlow = (eventDate: Date) => {
    const dateString = eventDate.toISOString().split('T')[0];
    setGlowingDate(dateString);
    
    // Auto-remove glow after 7 seconds
    setTimeout(() => {
      setGlowingDate(null);
    }, 7000);
  };

  /** Handle clicking expand button on a day with multiple events */
  const handleMultiEventClick = (events: CalendarEvent[], date: Date) => {
    setMultiEventModalEvents(events);
    setMultiEventModalDate(date);
    setMultiEventModalOpen(true);
  };

  /** Select an event from the multi-event modal */
  const handleSelectFromMultiEventModal = (event: CalendarEvent) => {
    setMultiEventModalOpen(false);
    handleEventClick(event);
  };

  /** Close the multi-event modal */
  const handleCloseMultiEventModal = () => {
    setMultiEventModalOpen(false);
    setMultiEventModalEvents([]);
    setMultiEventModalDate(null);
  };

  // ==========================================================================
  // COMPUTED VALUES
  // ==========================================================================
  
  /** Current cohort's events */
  const currentEvents = cohortEvents[selectedCohort] || [];

  // ==========================================================================
  // RENDER
  // ==========================================================================
  return (
    <>
      {/* ================================================================== */}
      {/* HEADER: Month Navigation & Event Toggles                          */}
      {/* ================================================================== */}
      <header className="mb-2 relative overflow-visible px-0 sm:px-6 lg:px-0">
        <div className="relative flex items-center gap-3 flex-wrap">

          {/* Cohort Tabs - Only show if not externally controlled 
          {!externalSelectedCohort && (
            <div 
              role="tablist" 
              className="flex bg-slate-100 dark:bg-slate-700 rounded-full p-1 flex-shrink-0"
              aria-label="Select cohort"
            >
              <button
                role="tab"
                aria-selected={selectedCohort === 'blue' ? 'true' : 'false'}
                aria-controls="calendar-content"
                onClick={() => handleCohortChange('blue')}
                className={`px-2 py-1 rounded-full text-xs font-medium transition-all duration-200 ${
                  selectedCohort === 'blue'
                    ? 'bg-berkeley-gold text-berkeley-blue shadow-[0_0_0_2px_rgba(0,50,98,0.15)] ring-3 ring-blue-300/30 shadow-blue-500/40'
                    : 'text-white hover:bg-berkeley-blue/10'
                }`}
                style={{
                  backgroundColor: selectedCohort === 'blue' ? '#00336275' : '#00000025',
                  color: selectedCohort === 'blue' ? '#ffffff' : '#4d81b3ff'
                }}
              >
                Blue
              </button>
              <button
                role="tab"
                aria-selected={selectedCohort === 'gold' ? 'true' : 'false'}
                aria-controls="calendar-content"
                onClick={() => handleCohortChange('gold')}
                className={`relative px-2 py-1 rounded-full text-xs font-semibold transition-all duration-200 focus:outline-none
                  ${selectedCohort === 'gold'
                    ? 'bg-berkeley-gold text-md font-medium text-berkeley-blue shadow-[0_0_0_2px_rgba(0,50,98,0.15)] ring-3 ring-white/60 shadow-yellow-500/40'
                    : 'text-berkeley-gold hover:bg-berkeley-gold/10 focus-visible:ring-2 focus-visible:ring-yellow-300/70 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-100 dark:focus-visible:ring-offset-slate-700'
                  }`}
                style={{
                  backgroundColor: selectedCohort === 'gold' ? '#FDB51595' : '#00000025',
                  color: selectedCohort === 'gold' ? '#000000' : '#FDB51575'
                }}
              >
                Gold
              </button>
            </div>
          )}

          {/* Month Navigation - Right on mobile, centered on desktop */}
          <div className="mr-auto ml-2 sm:absolute sm:left-1/2 sm:transform sm:-translate-x-1/2 flex  items-center gap-0 flex-shrink-0">
            <button
              onClick={goToPreviousMonth}
              className="p-0 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors text-white"
              aria-label="Previous month"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h4 className="text-lg px-3 sm:px-10">
              <span className="font-medium text-white">{format(currentMonth, 'MMM')}</span>
              <span className="font-light text-white/60"> {format(currentMonth, 'yyyy')}</span>
            </h4>
            <button
              onClick={goToNextMonth}
              className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors text-white"
              aria-label="Next month"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
          
          {/* Special Event Toggles - Dropdown - Right Anchored */}
          <div className="relative flex-shrink-0 sm:ml-auto" ref={dropdownRef}>
            <button
              onClick={() => setShowEventDropdown(!showEventDropdown)}
              className="flex items-center justify-center gap-2 px-3 py-2 bg-slate-400/10 rounded-full hover:bg-slate-800 transition-all duration-200 shadow-[0_0_20px_rgba(255,255,255,0.3)] hover:shadow-[0_0_30px_rgba(255,255,255,0.5)]"
              aria-label="Toggle special events"
            >
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
              <span className="text-sm font-semibold text-white/80">Events</span>

            </button>

            {/* Dropdown Menu */}
            {showEventDropdown && (
              <div className="absolute top-full right-0 mt-2 bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-slate-200 dark:border-slate-600 py-0 z-50 min-w-[150px]">
                
                {/* Hide All Button */}
                <button
                  onClick={() => {
                    setShowGreekTheater(false);
                    setShowUCLaunch(false);
                    setShowCalBears(false);
                    setShowCampusGroups(false);
                    setShowAcademicCalendar(false);
                    setShowNewsletter(false);
                    setShowCMG(false);
                  }}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 text-xs font-medium text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 hover:text-red-500 dark:hover:text-red-400 transition-colors border-b border-slate-200 dark:border-slate-600 cursor-pointer"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                  </svg>
                  Hide All
                </button>

                {/* Greek Theater Toggle */}
                <label className="flex items-center justify-between px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer">
                  <div className="flex items-center gap-3">
                    <Image
                      src="/greeklogo.png"
                      alt="Greek Theater"
                      width={50}
                      height={50}
                      className="object-contain filter brightness-0 dark:invert"
                    />
                    
                  </div>
                  <div className="relative">
                    <input
                      type="checkbox"
                      checked={showGreekTheater}
                      onChange={(e) => setShowGreekTheater(e.target.checked)}
                      className="sr-only"
                      aria-label="Toggle Greek Theater events"
                    />
                    <div className={`w-10 h-6 rounded-full transition-colors duration-200 ${
                      showGreekTheater ? 'bg-blue-500' : 'bg-slate-300 dark:bg-slate-600'
                    }`}>
                      <div className={`translate-y-1 w-4 h-4 bg-white rounded-full shadow transform transition-transform duration-200 mt-1 ${
                        showGreekTheater ? 'translate-x-5' : 'translate-x-1'
                      }`} />
                    </div>
                  </div>
                </label>

                {/* UC Launch Toggle */}
                <label className="flex items-center justify-between px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer">
                  <div className="flex items-center gap-3">
                    <Image
                      src="/Launch Accelerator logo.png"
                      alt="UC Launch Accelerator"
                      width={50}
                      height={50}
                      className="object-contain filter brightness-0 dark:invert"
                    />
                    
                  </div>
                  <div className="relative">
                    <input
                      type="checkbox"
                      checked={showUCLaunch}
                      onChange={(e) => setShowUCLaunch(e.target.checked)}
                      className="sr-only"
                      aria-label="Toggle UC Launch Accelerator events"
                    />
                    <div className={`w-10 h-6 rounded-full transition-colors duration-200 ${
                      showUCLaunch ? 'bg-blue-500' : 'bg-slate-300 dark:bg-slate-600'
                    }`}>
                      <div className={`translate-y-1 w-4 h-4 bg-white rounded-full shadow transform transition-transform duration-200 mt-1 ${
                        showUCLaunch ? 'translate-x-5' : 'translate-x-1'
                      }`} />
                    </div>
                  </div>
                </label>

                {/* Cal Bears Toggle */}
                <label className="flex items-center justify-between px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer">
                  <div className="flex items-center gap-3">
                    <Image
                      src="/cal_logo.png"
                      alt="Cal Bears"
                      width={40}
                      height={40}
                      className="object-contain filter brightness-0 dark:invert"
                    />
                    
                  </div>
                  <div className="relative">
                    <input
                      type="checkbox"
                      checked={showCalBears}
                      onChange={(e) => setShowCalBears(e.target.checked)}
                      className="sr-only"
                      aria-label="Toggle Cal Bears events"
                    />
                    <div className={`w-10 h-6 rounded-full transition-colors duration-200 ${
                      showCalBears ? 'bg-blue-500' : 'bg-slate-300 dark:bg-slate-600'
                    }`}>
                      <div className={`translate-y-1 w-4 h-4 bg-white rounded-full shadow transform transition-transform duration-200 mt-1 ${
                        showCalBears ? 'translate-x-5' : 'translate-x-1'
                      }`} />
                    </div>
                  </div>
                </label>

                {/* Campus Groups Toggle */}
                <label className="flex items-center justify-between px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-7 flex items-center justify-center bg-blue-600 rounded-lg">
                      <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                    </div>
                    <span className="text-xs font-medium">Club Cal</span>
                  </div>
                  <div className="relative">
                    <input
                      type="checkbox"
                      checked={showCampusGroups}
                      onChange={(e) => setShowCampusGroups(e.target.checked)}
                      className="sr-only"
                      aria-label="Toggle Campus Groups events"
                    />
                    <div className={`w-10 h-6 rounded-full transition-colors duration-200 ${
                      showCampusGroups ? 'bg-blue-500' : 'bg-slate-300 dark:bg-slate-600'
                    }`}>
                      <div className={`translate-y-1 w-4 h-4 bg-white rounded-full shadow transform transition-transform duration-200 mt-1 ${
                        showCampusGroups ? 'translate-x-5' : 'translate-x-1'
                      }`} />
                    </div>
                  </div>
                </label>

                {/* Newsletter Events Toggle */}
                <label className="flex items-center justify-between  px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-7 flex items-center justify-center bg-purple-600 rounded-lg">
                      <svg className="w-6 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M9 21c0 .5.4 1 1 1h4c.6 0 1-.5 1-1v-1H9v1zm3-19C8.1 2 5 5.1 5 9c0 2.4 1.2 4.5 3 5.7V17c0 .5.4 1 1 1h6c.6 0 1-.5 1-1v-2.3c1.8-1.3 3-3.4 3-5.7 0-3.9-3.1-7-7-7z"/>
                      </svg>
                    </div>
                    <span className="text-sm pr-2 font-medium">Newsletter</span>
                  </div>
                  <div className="relative">
                    <input
                      type="checkbox"
                      checked={showNewsletter}
                      onChange={(e) => setShowNewsletter(e.target.checked)}
                      className="sr-only"
                      aria-label="Toggle Newsletter events"
                      disabled={!newsletterData}
                    />
                    <div className={`w-10 h-6 rounded-full transition-colors duration-200 ${
                      showNewsletter ? 'bg-purple-500' : 'bg-slate-300 dark:bg-slate-600'
                    }`}>
                      <div className={`translate-y-1 w-4 h-4 bg-white rounded-full shadow transform transition-transform duration-200 mt-1 ${
                        showNewsletter ? 'translate-x-5' : 'translate-x-1'
                      }`} />
                    </div>
                  </div>
                </label>

                {/* Haas Academic Calendar Toggle */}
                <label className="flex items-center justify-between px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-7 flex items-center justify-center bg-amber-600 rounded-lg">
                      <svg className="w-6 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V10h14v10zm0-12H5V6h14v2z"/>
                      </svg>
                    </div>
                    <span className="text-sm pr-2 font-medium">Academic</span>
                  </div>
                  <div className="relative">
                    <input
                      type="checkbox"
                      checked={showAcademicCalendar}
                      onChange={(e) => setShowAcademicCalendar(e.target.checked)}
                      className="sr-only"
                      aria-label="Toggle Academic Calendar events"
                    />
                    <div className={`w-10 h-6 rounded-full transition-colors duration-200 ${
                      showAcademicCalendar ? 'bg-amber-500' : 'bg-slate-300 dark:bg-slate-600'
                    }`}>
                      <div className={`translate-y-1 w-4 h-4 bg-white rounded-full shadow transform transition-transform duration-200 mt-1 ${
                        showAcademicCalendar ? 'translate-x-5' : 'translate-x-1'
                      }`} />
                    </div>
                  </div>
                </label>

                {/* CMG (Career Management Group) Toggle */}
                <label className="flex items-center justify-between px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-7 flex items-center justify-center bg-pink-400 rounded-lg">
                      <svg className="w-6 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M20 6h-4V4c0-1.1-.9-2-2-2h-4c-1.1 0-2 .9-2 2v2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zM10 4h4v2h-4V4zm10 16H4V8h16v12z"/>
                      </svg>
                    </div>
                    <span className="text-sm pr-2 font-medium">CMG</span>
                  </div>
                  <div className="relative">
                    <input
                      type="checkbox"
                      checked={showCMG}
                      onChange={(e) => setShowCMG(e.target.checked)}
                      className="sr-only"
                      aria-label="Toggle CMG Career Management events"
                    />
                    <div className={`w-10 h-6 rounded-full transition-colors duration-200 ${
                      showCMG ? 'bg-pink-400' : 'bg-slate-300 dark:bg-slate-600'
                    }`}>
                      <div className={`translate-y-1 w-4 h-4 bg-white rounded-full shadow transform transition-transform duration-200 mt-1 ${
                        showCMG ? 'translate-x-5' : 'translate-x-1'
                      }`} />
                    </div>
                  </div>
                </label>

              {/* COMING SOON*/}
                <label className="flex items-center justify-center text-center px-5 py-1 hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-extralight text-slate-300/50 dark:text-slate-300/50">
                      Custom Feeds coming soon
                    </span>
                    
                  </div>
                  
                </label>
              </div>
            )}
          </div>

       
        </div>
      </header>

      {/* ================================================================== */}
      {/* CALENDAR GRID                                                      */}
      {/* ================================================================== */}
      <div id="calendar-content" role="tabpanel">
        <div className="-mb-0 mx-1 rounded-none sm:rounded-xl overflow-hidden">
          <MonthGrid 
            events={currentEvents} 
            currentMonth={currentMonth} 
            onEventClick={handleEventClick} 
            showGreekTheater={showGreekTheater}
            showUCLaunch={showUCLaunch}
            launchEvents={cohortEvents.launch || []}
            showCalBears={showCalBears}
            calBearsEvents={cohortEvents.calBears || []}
            showCampusGroups={showCampusGroups}
            campusGroupsEvents={cohortEvents.campusGroups || []}
            showAcademicCalendar={showAcademicCalendar}
            academicCalendarEvents={cohortEvents.academicCalendar || []}
            showCMG={showCMG}
            cmgEvents={cohortEvents.cmg || []}
            showNewsletter={showNewsletter}
            newsletterEvents={newsletterEvents}
            glowingDate={glowingDate}
            onMultiEventClick={handleMultiEventClick}
          />
        </div>
      </div>

      {/* ================================================================== */}
      {/* EVENT DETAIL MODAL                                                 */}
      {/* ================================================================== */}
      <EventDetailModal 
        event={selectedEvent} 
        originalEvent={matchedOriginalEvent}
        onClose={handleCloseModal}
        onNext={handleNextEvent}
        onPrevious={handlePreviousEvent}
        hasNext={currentEventIndex >= 0 && currentEventIndex < currentEvents.length - 1}
        hasPrevious={currentEventIndex > 0}
        onTriggerGlow={handleTriggerGlow}
      />

      {/* ================================================================== */}
      {/* MULTI-EVENT MODAL (when clicking day with 2+ events)              */}
      {/* ================================================================== */}
      <MultiEventModal
        isOpen={multiEventModalOpen}
        events={multiEventModalEvents}
        date={multiEventModalDate}
        onClose={handleCloseMultiEventModal}
        onSelectEvent={handleSelectFromMultiEventModal}
      />
    </>
  );
}
