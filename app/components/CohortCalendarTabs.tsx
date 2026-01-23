'use client';

import { useState, useEffect, useRef } from 'react';
import { format, addMonths, subMonths } from 'date-fns';
import Image from 'next/image';
import MonthGrid from './MonthGrid';
import EventDetailModal from './EventDetailModal';
import type { CalendarEvent, CohortEvents } from '@/lib/icsUtils';
import type { UnifiedDashboardData } from '@/app/api/unified-dashboard/route';

type Props = {
  cohortEvents: CohortEvents;
  title: string;
  externalSelectedCohort?: 'blue' | 'gold';
  newsletterData?: UnifiedDashboardData['newsletterData'];
};

type CohortType = 'blue' | 'gold';

// Newsletter event type for calendar display
interface NewsletterCalendarEvent extends CalendarEvent {
  htmlContent?: string; // Formatted HTML from organized newsletter
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
  multipleEvents?: NewsletterCalendarEvent[]; // For combined events with multiple newsletter items on same date
}

export default function CohortCalendarTabs({ cohortEvents, externalSelectedCohort, newsletterData }: Props) {
  const [selectedCohort, setSelectedCohort] = useState<CohortType>(externalSelectedCohort || 'blue');
  const [currentMonth, setCurrentMonth] = useState(new Date()); // Current month
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [matchedOriginalEvent, setMatchedOriginalEvent] = useState<CalendarEvent | null>(null);
  const [currentEventIndex, setCurrentEventIndex] = useState<number>(-1); // Track current event index
  const [showGreekTheater, setShowGreekTheater] = useState(false);
  const [showUCLaunch, setShowUCLaunch] = useState(false);
  const [showCalBears, setShowCalBears] = useState(true); // Default ON
  const [showCampusGroups, setShowCampusGroups] = useState(false);
  const [showAcademicCalendar, setShowAcademicCalendar] = useState(true); // Default ON
  const [showNewsletter, setShowNewsletter] = useState(true); // Default ON
  const [newsletterEvents, setNewsletterEvents] = useState<NewsletterCalendarEvent[]>([]);
  const [showEventDropdown, setShowEventDropdown] = useState(false);
  const [glowingDate, setGlowingDate] = useState<string | null>(null); // Track which date should glow (ISO string)
  // Multi-event modal state
  const [multiEventModalOpen, setMultiEventModalOpen] = useState(false);
  const [multiEventModalEvents, setMultiEventModalEvents] = useState<CalendarEvent[]>([]);
  const [multiEventModalDate, setMultiEventModalDate] = useState<Date | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Load cohort preference from localStorage on mount (only if not externally controlled)
  useEffect(() => {
    if (!externalSelectedCohort) {
      const saved = localStorage.getItem('calendar-cohort');
      if (saved === 'blue' || saved === 'gold') {
        setSelectedCohort(saved);
      }
    }
    
    // Load event toggle preferences from localStorage
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
  }, [externalSelectedCohort]);

  // Convert newsletter data to calendar events when provided
  useEffect(() => {
    if (!newsletterData) {
      console.log('📰 [CohortCalendarTabs] No newsletter data provided');
      setNewsletterEvents([]);
      return;
    }

    console.log('📰 [CohortCalendarTabs] Converting newsletter data to calendar events...');
    console.log(`📊 Newsletter has ${newsletterData.sections.length} sections`);
    console.log('� [v2] Enhanced regex date extraction active'); // Cache buster
    console.log('�📰 Full newsletterData:', JSON.stringify(newsletterData, null, 2));
    
    // Debug: Log the structure of newsletter items
    try {
      newsletterData.sections.forEach((section, idx) => {
        console.log(`📰 Section ${idx}:`, section);
        console.log(`📰 Section ${idx} title: "${section.sectionTitle || 'NO TITLE'}"`);
        console.log(`📰 Section ${idx} items:`, section.items);
        console.log(`📰 Section ${idx} items length: ${section.items?.length || 0}`);
        
        if (section.items && section.items.length > 0) {
          section.items.forEach((item, itemIdx) => {
            console.log(`📰   Item ${itemIdx} "${item.title}":`, {
              hasTimeSensitive: !!item.timeSensitive,
              timeSensitiveStructure: item.timeSensitive,
              fullItem: item
            });
          });
        }
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
        
        // Primary: Check if item has time-sensitive data from AI
        if (item.timeSensitive && item.timeSensitive.dates && item.timeSensitive.dates.length > 0) {
          console.log(`✓ "${item.title}" has timeSensitive data:`, item.timeSensitive.dates);
          datesToProcess = item.timeSensitive.dates;
          eventType = item.timeSensitive.eventType || 'announcement';
          priority = item.timeSensitive.priority || 'medium';
        } else {
          // Fallback: Extract dates from HTML content using regex (same as MyWeek widget)
          console.log(`✗ "${item.title}" has NO timeSensitive - trying regex fallback...`);
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
  }, [newsletterData]); // Re-run when newsletter data changes

  // Save newsletter toggle preference to localStorage
  useEffect(() => {
    localStorage.setItem('calendar-show-newsletter', String(showNewsletter));
  }, [showNewsletter]);

  // Save Cal Bears toggle preference to localStorage
  useEffect(() => {
    localStorage.setItem('calendar-show-calbears', String(showCalBears));
  }, [showCalBears]);

  // Save Academic Calendar toggle preference to localStorage
  useEffect(() => {
    localStorage.setItem('calendar-show-academic', String(showAcademicCalendar));
  }, [showAcademicCalendar]);

  // Handle clicking outside dropdown to close it
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

  // Sync with external cohort selection
  useEffect(() => {
    if (externalSelectedCohort) {
      setSelectedCohort(externalSelectedCohort);
    }
  }, [externalSelectedCohort]);

  // Save cohort preference to localStorage (only if not externally controlled)
  useEffect(() => {
    if (!externalSelectedCohort) {
      localStorage.setItem('calendar-cohort', selectedCohort);
    }
  }, [selectedCohort, externalSelectedCohort]);

  const handleCohortChange = (cohort: CohortType) => {
    // Only allow local changes if not externally controlled
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

  // Generate course-specific fallback content for events without original calendar matches
  const generateCourseContent = (cohortEvent: CalendarEvent): CalendarEvent | null => {
    if (!cohortEvent.source) return null;

    const eventDate = new Date(cohortEvent.start);
    const isCourse201 = cohortEvent.source.includes('201') || cohortEvent.source.includes('micro');
    const isLeadingPeople = cohortEvent.source.includes('205') || cohortEvent.source.includes('leadingpeople');
    const isDataDecisions = cohortEvent.source.includes('DataDecisions') || cohortEvent.source.includes('202');
    const isMarketing = cohortEvent.source.includes('Marketing') || cohortEvent.source.includes('208');
    
    if (!isCourse201 && !isLeadingPeople && !isDataDecisions && !isMarketing) return null;

    // Course start dates
    const courseStartDates = {
      // MicroEconomics (201) start dates
      micro_blue: new Date(2025, 6, 28), // July 28, 2025 (Monday)
      micro_gold: new Date(2025, 6, 29), // July 29, 2025 (Tuesday)
      // Leading People start dates  
      leading_blue: new Date(2025, 7, 6), // August 6, 2025
      leading_gold: new Date(2025, 7, 7), // August 7, 2025
      // Data & Decisions (202) start dates
      data_blue: new Date(2025, 9, 14), // October 14, 2025 (Monday)
      data_gold: new Date(2025, 9, 15), // October 15, 2025 (Tuesday)
      // Marketing (208) start dates
      marketing_blue: new Date(2025, 9, 14), // October 14, 2025 (Monday)
      marketing_gold: new Date(2025, 9, 15), // October 15, 2025 (Tuesday)
    };

    let startDate: Date;
    let courseTitle: string;
    let baseUrl: string;
    
    if (isCourse201) {
      startDate = selectedCohort === 'blue' ? courseStartDates.micro_blue : courseStartDates.micro_gold;
      courseTitle = 'MicroEconomics';
      baseUrl = 'https://bcourses.berkeley.edu/courses/1544880/pages/week-';
    } else if (isDataDecisions) {
      startDate = selectedCohort === 'blue' ? courseStartDates.data_blue : courseStartDates.data_gold;
      courseTitle = 'Data & Decisions';
      baseUrl = 'https://bcourses.berkeley.edu/courses/1545042/pages/week-';
    } else if (isMarketing) {
      startDate = selectedCohort === 'blue' ? courseStartDates.marketing_blue : courseStartDates.marketing_gold;
      courseTitle = 'Marketing';
      baseUrl = 'https://bcourses.berkeley.edu/courses/1545360/pages/session-';
    } else {
      startDate = selectedCohort === 'blue' ? courseStartDates.leading_blue : courseStartDates.leading_gold;
      courseTitle = 'Leading People';
      baseUrl = 'https://bcourses.berkeley.edu/courses/1545386/pages/';
    }

    // Calculate week number
    const weeksDiff = Math.floor((eventDate.getTime() - startDate.getTime()) / (7 * 24 * 60 * 60 * 1000));
    const weekNumber = Math.max(1, weeksDiff + 1); // Start from week 1

    // Generate enhanced content
    const enhancedTitle = isCourse201 
      ? `MicroEconomics Week ${weekNumber}`
      : isDataDecisions
        ? `Data & Decisions Week ${weekNumber}`
        : isMarketing
          ? `Marketing Session ${weekNumber}`
          : `Leading People Week ${weekNumber}`;
    
    const courseUrl = isCourse201 
      ? `${baseUrl}${weekNumber}`
      : isDataDecisions
        ? `${baseUrl}${weekNumber}`
        : isMarketing
          ? `${baseUrl}${weekNumber}`
          : `${baseUrl}week-${weekNumber}`;

    const enhancedDescription = `For course content for ${courseTitle}, Week ${weekNumber}, please click Event Link. `;

    console.log(`Generated course content for ${cohortEvent.title}: ${enhancedTitle} -> ${courseUrl}`);

    return {
      ...cohortEvent,
      title: enhancedTitle,
      url: courseUrl,
      description: enhancedDescription,
      location: cohortEvent.location || 'Online (bCourses)',
    };
  };

  // Client-side function to find matching event from original calendar
  const findMatchingOriginalEvent = (
    cohortEvent: CalendarEvent,
    originalEvents: CalendarEvent[]
  ): CalendarEvent | null => {
    // Always display Teams@Haas events as-is (no matching or generated content)
    if (cohortEvent.source && cohortEvent.source.toLowerCase().includes('teams@haas')) {
      return null; // explicitly no matching content
    }

    if (!originalEvents.length) {
      // No original events available - try to generate course content
      return generateCourseContent(cohortEvent);
    }

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

    if (sameDateEvents.length === 0) {
      // No date match found - try to generate course content
      return generateCourseContent(cohortEvent);
    }

    // Generate the course URL for this event (we'll use it to enhance matched events)
    const generatedContent = generateCourseContent(cohortEvent);

    // If only one event on the same date, return it enhanced with generated URL
    if (sameDateEvents.length === 1) {
      console.log(`Found matching event by date: ${sameDateEvents[0].title}`);
      return {
        ...sameDateEvents[0],
        url: sameDateEvents[0].url || generatedContent?.url, // Add generated URL if ICS doesn't have one
      };
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

    // Find the event with the highest title similarity
    let bestMatch: CalendarEvent | null = null;
    let bestSimilarity = 0;

    for (const originalEvent of sameDateEvents) {
      const similarity = getTitleSimilarity(cohortTitle, originalEvent.title);
      console.log(`Comparing "${cohortTitle}" with "${originalEvent.title.toLowerCase()}" - similarity: ${similarity}`);

      if (similarity > bestSimilarity && similarity > 0.3) {
        // Minimum 30% similarity
        bestSimilarity = similarity;
        bestMatch = originalEvent;
      }
    }

    if (bestMatch) {
      console.log(`Found best matching event (${bestSimilarity.toFixed(2)} similarity): ${bestMatch.title}`);
      return {
        ...bestMatch,
        url: bestMatch.url || generatedContent?.url, // Add generated URL if ICS doesn't have one
      };
    }

    // If no good title match, try to generate course content as fallback
    if (generatedContent) {
      console.log(`No good title match found, using generated course content: ${generatedContent.title}`);
      return generatedContent;
    }

    // Final fallback - return the first event on the same date
    if (sameDateEvents.length > 0) {
      const fallbackEvent = sameDateEvents[0] as CalendarEvent;
      console.log(`No good title match found, returning first event on same date: ${fallbackEvent.title}`);
      return fallbackEvent;
    }
    
    // Should never reach here, but return null as ultimate fallback
    return null;
  };

  const handleEventClick = (event: CalendarEvent) => {
    // Scroll to top of page first
    window.scrollTo({ top: 0, behavior: 'smooth' });
    
    // Find the index of this event in the current events array
    const eventIndex = currentEvents.findIndex(e => 
      e.start === event.start && e.title === event.title
    );
    setCurrentEventIndex(eventIndex);
    
    // Teams@Haas: show raw event only
    if (event.source && event.source.toLowerCase().includes('teams@haas')) {
      setSelectedEvent(event);
      setMatchedOriginalEvent(null);
      console.log(`Teams@Haas event selected (no enrichment): ${event.title}`);
      return;
    }

    // Try to find matching/enriched event from original calendar (this adds the URL!)
    const enrichedEvent = findMatchingOriginalEvent(event, cohortEvents.original || []);
    
    if (enrichedEvent) {
      console.log(`✅ Enriched event with URL: ${enrichedEvent.url}`);
      // Merge: Use the base event (has rich ICS description) but add the URL from enrichedEvent
      const mergedEvent: CalendarEvent = {
        ...event, // Start with base event (has rich description from ICS)
        url: enrichedEvent.url, // Add the generated URL
      };
      setSelectedEvent(mergedEvent);
      setMatchedOriginalEvent(null);
    } else {
      console.log(`⚠️ No enrichment found for "${event.title}"`);
      setSelectedEvent(event);
      setMatchedOriginalEvent(null);
    }
  };

  const handleNextEvent = () => {
    if (currentEventIndex < currentEvents.length - 1) {
      const nextEvent = currentEvents[currentEventIndex + 1];
      handleEventClick(nextEvent);
    }
  };

  const handlePreviousEvent = () => {
    if (currentEventIndex > 0) {
      const prevEvent = currentEvents[currentEventIndex - 1];
      handleEventClick(prevEvent);
    }
  };

  const handleCloseModal = () => {
    setSelectedEvent(null);
    setMatchedOriginalEvent(null);
    setCurrentEventIndex(-1);
  };

  // Handle triggering glow effect on date cell after "View in Newsletter" is clicked
  const handleTriggerGlow = (eventDate: Date) => {
    const dateString = eventDate.toISOString().split('T')[0]; // Convert to YYYY-MM-DD format
    console.log(`✨ [CohortCalendarTabs] Triggering violet glow for date: ${dateString}`);
    
    setGlowingDate(dateString);
    
    // Auto-remove glow after 7 seconds
    setTimeout(() => {
      setGlowingDate(null);
      console.log(`🌅 [CohortCalendarTabs] Violet glow faded out for date: ${dateString}`);
    }, 7000);
  };

  // Handle multi-event expand click from MonthGrid
  const handleMultiEventClick = (events: CalendarEvent[], date: Date) => {
    console.log(`📅 [CohortCalendarTabs] Multi-event expand clicked for ${date.toDateString()}:`, events.length, 'events');
    setMultiEventModalEvents(events);
    setMultiEventModalDate(date);
    setMultiEventModalOpen(true);
  };

  // Handle selecting an event from multi-event modal
  const handleSelectFromMultiEventModal = (event: CalendarEvent) => {
    setMultiEventModalOpen(false);
    handleEventClick(event);
  };

  // Close multi-event modal
  const handleCloseMultiEventModal = () => {
    setMultiEventModalOpen(false);
    setMultiEventModalEvents([]);
    setMultiEventModalDate(null);
  };

  // Get current cohort events
  const currentEvents = cohortEvents[selectedCohort] || [];

  // Debug logging for Campus Groups
  console.log('Campus Groups Events:', cohortEvents.campusGroups?.length || 0, 'events');
  console.log('Show Campus Groups:', showCampusGroups);
  console.log('Campus Groups Events Detail:', cohortEvents.campusGroups);

  return (
    <>
      {/* Compact Header - All controls on one line */}
      <header className="mb-4 relative overflow-visible px-0 sm:px-6 lg:px-0">{/* Removed px-4 on mobile for full width */}
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
          <div className="mr-auto ml-2 sm:absolute sm:left-1/2 sm:transform sm:-translate-x-1/2 flex items-center gap-0 flex-shrink-0">
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

      {/* Calendar Content */}
      <div id="calendar-content" role="tabpanel">
        <div className="-mb-0 mx-1 rounded-none sm:rounded-xl overflow-hidden">{/* Removed -mx-6 sm:-mx-0 to prevent overflow */}
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
            showNewsletter={showNewsletter}
            newsletterEvents={newsletterEvents}
            glowingDate={glowingDate}
            onMultiEventClick={handleMultiEventClick}
          />
        </div>
      </div>

      {/* Event Detail Modal */}
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

      {/* Multi-Event Grid Modal */}
      {multiEventModalOpen && multiEventModalDate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="backdrop-blur-3xl bg-slate-900/80 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col border border-slate-700/50">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700/50">
              <div>
                <h2 className="text-lg font-semibold text-white">
                  Events on {format(multiEventModalDate, 'EEEE, MMMM d, yyyy')}
                </h2>
                <p className="text-sm text-slate-400 mt-0.5">
                  {multiEventModalEvents.length} events • Click to view details
                </p>
              </div>
              <button
                onClick={handleCloseMultiEventModal}
                className="p-2 rounded-lg hover:bg-slate-700 transition-colors"
                aria-label="Close"
              >
                <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Event Grid */}
            <div className="px-6 py-4 overflow-y-auto flex-1">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {multiEventModalEvents.map((event, index) => {
                  // Determine event color based on source
                  const getEventColor = () => {
                    if (event.source?.includes('newsletter')) return 'bg-purple-600/30 border-purple-500/50 hover:bg-purple-600/50';
                    if (event.source?.includes('uc_launch')) return 'bg-orange-600/30 border-orange-500/50 hover:bg-orange-600/50';
                    if (event.source?.includes('campus_groups')) return 'bg-blue-600/30 border-blue-500/50 hover:bg-blue-600/50';
                    if (event.source?.includes('cal_bears')) return 'bg-blue-800/30 border-yellow-500/50 hover:bg-blue-800/50';
                    if (event.source?.includes('haas_academic')) return 'bg-amber-600/30 border-amber-500/50 hover:bg-amber-600/50';
                    if (event.source?.includes('201a_micro')) return 'bg-green-800/30 border-green-700/50 hover:bg-green-800/50';
                    if (event.source?.includes('201b_macro')) return 'bg-blue-900/30 border-blue-700/50 hover:bg-blue-900/50';
                    if (event.source?.includes('202_')) return 'bg-teal-700/30 border-teal-600/50 hover:bg-teal-700/50';
                    if (event.source?.includes('205_')) return 'bg-red-800/30 border-red-700/50 hover:bg-red-800/50';
                    if (event.source?.includes('206_')) return 'bg-sky-700/30 border-sky-600/50 hover:bg-sky-700/50';
                    return 'bg-slate-700/30 border-slate-600/50 hover:bg-slate-700/50';
                  };

                  // Get event type label
                  const getEventType = () => {
                    if (event.source?.includes('newsletter')) return '📰 Newsletter';
                    if (event.source?.includes('uc_launch')) return '🚀 UC Launch';
                    if (event.source?.includes('campus_groups')) return '👥 Campus Groups';
                    if (event.source?.includes('cal_bears')) return '🐻 Cal Bears';
                    if (event.source?.includes('haas_academic')) return '📅 Academic';
                    return '📚 Course';
                  };

                  return (
                    <button
                      key={event.uid || `${event.title}-${index}`}
                      onClick={() => handleSelectFromMultiEventModal(event)}
                      className={`text-left p-4 rounded-xl border ${getEventColor()} transition-all duration-200 cursor-pointer hover:scale-[1.02] hover:shadow-lg`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="text-xs text-slate-400 mb-1">{getEventType()}</div>
                          <h3 className="text-sm font-medium text-white truncate">{event.title}</h3>
                          {event.description && (
                            <p className="text-xs text-slate-400 mt-1 line-clamp-2">
                              {event.description.substring(0, 100)}
                              {event.description.length > 100 ? '...' : ''}
                            </p>
                          )}
                          {event.start && !event.allDay && (
                            <p className="text-xs text-slate-500 mt-2">
                              {format(new Date(event.start), 'h:mm a')}
                              {event.end && ` - ${format(new Date(event.end), 'h:mm a')}`}
                            </p>
                          )}
                        </div>
                        <svg className="w-4 h-4 text-slate-500 flex-shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
