'use client';

import { useState, useEffect, useRef } from 'react';
import { format } from 'date-fns';
import EventDetailModal from './EventDetailModal';
import type { CalendarEvent, CohortEvents } from '@/lib/icsUtils';
import { trackEvent } from '@/lib/analytics';

type Props = {
  cohortEvents: CohortEvents;
  title?: string;
  maxEvents?: number;
  showCohortToggle?: boolean;
  defaultCohort?: 'blue' | 'gold';
  className?: string;
};

type CohortType = 'blue' | 'gold';

export default function CalendarListView({ 
  cohortEvents, 
  title = "What's Next",
  maxEvents = 10,
  showCohortToggle = false,
  defaultCohort = 'blue'
}: Props) {
  // ALL hooks must come FIRST before any conditional logic or returns
  const [selectedCohort, setSelectedCohort] = useState<CohortType>(defaultCohort);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [matchedOriginalEvent, setMatchedOriginalEvent] = useState<CalendarEvent | null>(null);
  const [isGlowing, setIsGlowing] = useState(false);
  const [scrollIndex, setScrollIndex] = useState(0);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Sync with external cohort selection
  useEffect(() => {
    setSelectedCohort(defaultCohort);
  }, [defaultCohort]);

  // Load cohort preference from localStorage on mount (if cohort toggle is shown)
  useEffect(() => {
    if (showCohortToggle) {
      const saved = localStorage.getItem('calendar-cohort');
      if (saved === 'blue' || saved === 'gold') {
        setSelectedCohort(saved);
      }
    }
  }, [showCohortToggle]);

  // Save cohort preference to localStorage (if cohort toggle is shown)
  useEffect(() => {
    if (showCohortToggle) {
      localStorage.setItem('calendar-cohort', selectedCohort);
    }
  }, [selectedCohort, showCohortToggle]);

  // Listen for glow animation triggers from MyWeekWidget
  useEffect(() => {
    const handleGlowTrigger = (event: Event) => {
      const customEvent = event as CustomEvent;
      console.log(`✨ CalendarListView received glow trigger`, customEvent?.detail);
      setIsGlowing(true);
      setTimeout(() => {
        setIsGlowing(false);
        console.log(`✨ Glow effect ended`);
      }, 500); // Extended glow duration to 500ms for testing
    };

    // Listen for custom event from MyWeekWidget
    window.addEventListener('triggerCalendarGlow', handleGlowTrigger);
    console.log(`🎧 CalendarListView listening for glow events`);
    
    return () => {
      window.removeEventListener('triggerCalendarGlow', handleGlowTrigger);
      console.log(`🎧 CalendarListView stopped listening for glow events`);
    };
  }, []);

  // Generate course-specific fallback content for events without original calendar matches
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
      micro_blue: { start: new Date(2025, 6, 28), courseId: '1544880', urlPattern: 'pages/week-' },
      micro_gold: { start: new Date(2025, 6, 29), courseId: '1544880', urlPattern: 'pages/week-' },
      leading_blue: { start: new Date(2025, 7, 6), courseId: '1545386', urlPattern: 'pages/' },
      leading_gold: { start: new Date(2025, 7, 7), courseId: '1545386', urlPattern: 'pages/' },
      data_blue: { start: new Date(2025, 9, 14), courseId: '1545042', urlPattern: 'pages/week-' },
      data_gold: { start: new Date(2025, 9, 15), courseId: '1545042', urlPattern: 'pages/week-' },
      marketing_blue: { start: new Date(2025, 9, 14), courseId: '1545360', urlPattern: 'pages/session-' },
      marketing_gold: { start: new Date(2025, 9, 15), courseId: '1545360', urlPattern: 'pages/session-' },
      
      // Spring 2026 Courses  
      macro_blue: { start: new Date(2026, 0, 7), courseId: '1549648', urlPattern: 'pages/week-' },
      macro_gold: { start: new Date(2026, 0, 8), courseId: '1549648', urlPattern: 'pages/week-' },
      accounting_blue: { start: new Date(2026, 0, 5), courseId: '1549713', urlPattern: 'pages/week-' },
      accounting_gold: { start: new Date(2026, 0, 6), courseId: '1549713', urlPattern: 'pages/week-' },
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
      ? `${baseUrl}week-${weekNumber}` // Leading People uses 'pages/week-X' pattern
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

    // If only one event on the same date, return it
    if (sameDateEvents.length === 1) {
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

      if (similarity > bestSimilarity && similarity > 0.3) {
        // Minimum 30% similarity
        bestSimilarity = similarity;
        bestMatch = originalEvent;
      }
    }

    if (bestMatch) {
      return bestMatch;
    }

    // If no good title match, try to generate course content as fallback
    const courseContent = generateCourseContent(cohortEvent);
    if (courseContent) {
      return courseContent;
    }

    // Final fallback - return the first event on the same date
    return sameDateEvents[0];
  };

  const handleEventClick = (event: CalendarEvent) => {
    // Scroll to top of page first
    window.scrollTo({ top: 0, behavior: 'smooth' });
    trackEvent('calendar_event_clicked', { source: 'list_view', title: event.title });
    
    // Teams@Haas: show raw event only
    if (event.source && event.source.toLowerCase().includes('teams@haas')) {
      setSelectedEvent(event);
      setMatchedOriginalEvent(null);
      return;
    }

    setSelectedEvent(event);
    
    // Try to find matching event from original calendar
    const originalEvent = findMatchingOriginalEvent(event, cohortEvents.original || []);
    setMatchedOriginalEvent(originalEvent);
  };

  const handleCloseModal = () => {
    setSelectedEvent(null);
    setMatchedOriginalEvent(null);
  };

  // Get current cohort events
  const currentEvents = cohortEvents[selectedCohort] || [];
  
  // Filter out past events - show all future events
  const allFutureEvents = currentEvents
    .filter(ev => new Date(ev.start) >= new Date());

  // Navigation for large screens
  const handleScrollNext = () => {
    if (scrollContainerRef.current) {
      const cardWidth = 180; // Approximate card width + gap
      scrollContainerRef.current.scrollBy({ left: cardWidth, behavior: 'smooth' });
      setScrollIndex(prev => prev + 1);
      trackEvent('calendar_list_scrolled', { direction: 'next' });
    }
  };

  const handleScrollPrevious = () => {
    if (scrollContainerRef.current) {
      const cardWidth = 180; // Approximate card width + gap
      scrollContainerRef.current.scrollBy({ left: -cardWidth, behavior: 'smooth' });
      setScrollIndex(prev => Math.max(0, prev - 1));
      trackEvent('calendar_list_scrolled', { direction: 'previous' });
    }
  };

  // Check if we can scroll (for showing/hiding arrows)
  const canScrollLeft = scrollIndex > 0;
  const canScrollRight = scrollContainerRef.current 
    ? scrollContainerRef.current.scrollLeft < scrollContainerRef.current.scrollWidth - scrollContainerRef.current.clientWidth - 10
    : allFutureEvents.length > 5;

  return (
    <div 
      className={`calendar-list-widget p-0 rounded-md   border-transparent transition-all duration-500  ${
        isGlowing 
          ? ' border-blue-400 ring-4 ring-blue-400/80 ring-offset-4 ring-offset-white dark:ring-offset-slate-800 shadow-2xl shadow-blue-500/50 ' 
          : ''
      }`} 
      style={{
        boxShadow: isGlowing 
          ? '0 0 30px rgba(59, 130, 246, 0.5), 0 0 40px rgba(59, 130, 246, 0.3), 0 0 50px rgba(59, 130, 246, 0.2)'
          : undefined,
        transform: isGlowing ? 'scale(1.01)' : undefined
      }}
      data-calendar-list-view
    >
      {/* Widget Header */}
      

      {/* Widget Content */}
      <div className="widget-content px-1 py-2 relative bg-slate-500/10 ">
        {/* Events List */}
        {allFutureEvents.length === 0 ? (
          <div className="empty-state text-center py-8">
            <div className="empty-icon w-12 h-12 bg-slate-100 dark:bg-slate-700 rounded-full flex items-center justify-center mx-auto mb-3">
              <span className="text-lg">📅</span>
            </div>
            <p className="empty-message text-sm text-slate-600 dark:text-slate-400">
              No upcoming events for {selectedCohort} cohort.
            </p>
          </div>
        ) : (
          <div className="events-container relative">
            <div 
              ref={scrollContainerRef}
              className="flex gap-1 overflow-x-auto scrollbar-hide scroll-smooth pb-0 px-1 0"
              style={{ 
                scrollbarWidth: 'none',
                msOverflowStyle: 'none',
                WebkitOverflowScrolling: 'touch'
              }}
            >
              {allFutureEvents.map((ev) => {
                const start = new Date(ev.start);
                const end = ev.end ? new Date(ev.end) : undefined;
                const isAllDay = ev.allDay || (!end || (start.getHours() === 0 && start.getMinutes() === 0 && end.getHours() === 0 && end.getMinutes() === 0));

                // Calculate days remaining
                const today = new Date();
                const eventDate = new Date(start);
                
                // Reset time to start of day for accurate day calculation
                today.setHours(0, 0, 0, 0);
                eventDate.setHours(0, 0, 0, 0);
                
                const diffInMs = eventDate.getTime() - today.getTime();
                const diffInDays = Math.round(diffInMs / (1000 * 60 * 60 * 24));
                
          // Generate days remaining text
          let daysRemainingText = '';
          if (diffInDays === 0) {
            daysRemainingText = 'Today';
          } else if (diffInDays === 1) {
            daysRemainingText = 'Tomorrow';
          } else if (diffInDays > 1) {
            daysRemainingText = `${diffInDays} Days Remaining`;
          } else {
            daysRemainingText = `${Math.abs(diffInDays)} Day's Ago`;
          }

          // Generate color for the day indicator circle based on days remaining
          const getDayIndicatorColor = (days: number): string => {
            if (days <= 0) return '#ef4444'; // Today or past - red-500 equivalent
            if (days === 1) return '#f97316'; // Tomorrow - orange-500
            if (days === 2) return '#f59e0b'; // 2 days - amber-500
            if (days === 3) return '#eab308'; // 3 days - yellow-500
            if (days === 4) return '#84cc16'; // 4 days - lime-500
            if (days === 5) return '#22c55e'; // 5 days - green-500
            if (days === 6) return '#06b6d4'; // 6 days - cyan-500
            if (days === 7) return '#14b8a680'; // 7 days - medium opacity teal (50% opacity)
            return '#14b8a680'; // 7+ days - medium opacity teal (50% opacity)
          };

          const circleColor = getDayIndicatorColor(diffInDays);

          return (
            <div 
            key={ev.uid || `${ev.title}-${ev.start}`}
            className="event-card bg-black/20 flex-shrink-0 w-40   p-2 rounded-lg  transition-all duration-100 ease-in-out cursor-pointer hover:box-shadow  hover:bg-violet-500/10 hover:transform hover:translate-y-[-1px]"
            onClick={() => handleEventClick(ev)}
            >
            <div className="event-content flex flex-col h-full">
              {/* Days remaining indicator */}
              <div 
              className="text-xs mb-1 urbanist-medium"
              style={{ color: circleColor }}
              >
              {daysRemainingText}
              </div>
              <h4 className="event-title urbanist-light text-white dark:text-white text-sm mb-0 line-clamp-2 flex-grow">
              {ev.title}
              </h4>
              <div className="event-meta space-y-1 mt-auto">
                {/* <div className="event-time text-xs text-slate-600 dark:text-slate-400">
                <div 
                className="inline-block w-3 h-3 rounded-full mr-2" 
                style={{ backgroundColor: circleColor }}
                ></div>
                <span className="">
                {isAllDay 
                  ? format(start, 'MMM d, yyyy')
                  : `${format(start, 'MMM d, h:mm a')} ${end ? `- ${format(end, 'h:mm a')}` : ''}`
                }
                </span>
                </div> */}
              </div>
            </div>
            </div>
          );
          })}
        </div>
        
        {/* Navigation buttons - hidden on mobile, visible on lg screens */}
        {canScrollLeft && (
          <div className="hidden lg:block absolute top-1/2 -translate-y-1/2 left-0.5 z-50">
            <div 
              className="w-8 h-20 glass-nav-button glass-turbulence rounded-lg flex items-center justify-center cursor-pointer"
              onClick={handleScrollPrevious}
            >
              <svg 
                className="w-6 h-6 text-white drop-shadow-md" 
                fill="currentColor" 
                viewBox="0 0 24 24"
              >
                <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/>
              </svg>
            </div>
          </div>
        )}
        
        {canScrollRight && (
          <div className="hidden lg:block absolute top-1/2 -translate-y-1/2 right-0.5 z-50">
            <div 
              className="w-8 h-20 glass-nav-button glass-turbulence rounded-xl flex items-center justify-center cursor-pointer"
              onClick={handleScrollNext}
            >
              <svg 
                className="w-6 h-6 text-white drop-shadow-md" 
                fill="currentColor" 
                viewBox="0 0 24 24"
              >
                <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/>
              </svg>
            </div>
          </div>
        )}
        </div>
      )}
        </div>

      {/* Event Detail Modal */}
      <EventDetailModal 
      event={selectedEvent} 
      originalEvent={matchedOriginalEvent}
      onClose={handleCloseModal} 
      />
    </div>
  );
}
