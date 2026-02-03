'use client';

import { useMemo, useEffect } from 'react';
import { startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, format, addDays, differenceInDays, isWithinInterval, startOfDay, endOfDay } from 'date-fns';
import Image from 'next/image';
import type { CalendarEvent } from '@/lib/icsUtils';
import { hasGreekTheaterEventOnDate, getGreekTheaterEventsForDate, greekTheaterToCalendarEvent } from '@/lib/greekTheater';

// Newsletter event type (extends CalendarEvent with optional htmlContent)
type NewsletterCalendarEvent = CalendarEvent & {
  htmlContent?: string;
  sourceMetadata?: {
    sectionTitle: string;
    sectionIndex: number;
    itemTitle: string;
    itemIndex: number;
  };
  multipleEvents?: NewsletterCalendarEvent[]; // For combined events with multiple newsletter items on same date
};

type Props = {
  events: CalendarEvent[];
  currentMonth: Date;
  onEventClick: (event: CalendarEvent) => void;
  showGreekTheater?: boolean;
  showUCLaunch?: boolean;
  launchEvents?: CalendarEvent[];
  showCalBears?: boolean;
  calBearsEvents?: CalendarEvent[];
  showCampusGroups?: boolean;
  campusGroupsEvents?: CalendarEvent[];
  showNewsletter?: boolean;
  newsletterEvents?: NewsletterCalendarEvent[];
  showAcademicCalendar?: boolean;
  academicCalendarEvents?: CalendarEvent[];
  glowingDate?: string | null; // Date string (YYYY-MM-DD) that should have violet glow effect
  onMultiEventClick?: (events: CalendarEvent[], date: Date) => void; // Handler for expand button with multiple events
};

export default function MonthGrid({ 
  events, 
  currentMonth, 
  onEventClick, 
  showGreekTheater = true, 
  showUCLaunch = true,
  launchEvents = [],
  showCalBears = true,
  calBearsEvents = [],
  showCampusGroups = false,
  campusGroupsEvents = [],
  showNewsletter = false,
  newsletterEvents = [],
  showAcademicCalendar = true,
  academicCalendarEvents = [],
  glowingDate = null,
  onMultiEventClick
}: Props) {
  // Remove the internal state since month is controlled by parent
  // const [currentMonth, setCurrentMonth] = useState(new Date(2025, 7, 1));

  // Debug log newsletter props on component mount/update
  useEffect(() => {
    console.log(`📰 [MonthGrid] Props received:`, {
      showNewsletter,
      newsletterEventsCount: newsletterEvents.length,
      newsletterEventsSample: newsletterEvents.slice(0, 2)
    });
  }, [showNewsletter, newsletterEvents]);

  // Compute grid days
  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 0 }); // Sunday start
    const end = endOfWeek(endOfMonth(currentMonth), { weekStartsOn: 0 });
    return eachDayOfInterval({ start, end });
  }, [currentMonth]);

  // Helper to check if an event spans multiple days
  // Note: ICS DTEND handling depends on format:
  // - DATE-only format (VALUE=DATE): DTEND is exclusive (day after last day)
  // - DATE-TIME format: DTEND is the actual end time, so if it ends at 23:xx, that day is included
  const isMultiDayEvent = (event: CalendarEvent): boolean => {
    if (!event.end) return false;
    const start = startOfDay(new Date(event.start));
    const endDate = new Date(event.end);
    const end = startOfDay(endDate);
    
    // Check if this is a timed event ending near end of day (23:xx hour)
    // ISO format: "2026-01-25T23:59:00.000Z" - check the hour
    const endHour = endDate.getHours();
    const isTimedEndOfDay = endHour === 23;
    
    if (isTimedEndOfDay) {
      // Timed event ending at 23:xx - end date IS the last day
      return differenceInDays(end, start) >= 1;
    } else {
      // DATE-only or earlier time - DTEND is exclusive, subtract 1 day
      const actualEnd = startOfDay(addDays(end, -1));
      return differenceInDays(actualEnd, start) >= 1;
    }
  };

  // Helper to check if an event is a quiz window (multi-day quiz period from course ICS)
  const isQuizWindowEvent = (event: CalendarEvent): boolean => {
    // Check if title contains "Quiz" and it's a multi-day event
    const isQuizTitle = event.title.toLowerCase().includes('quiz') && 
                        event.title.toLowerCase().includes('window');
    return isQuizTitle && isMultiDayEvent(event);
  };

  // Get the actual end date accounting for ICS format differences
  // - DATE-only format (VALUE=DATE): DTEND is exclusive (day after last day)
  // - DATE-TIME format ending at 23:xx: DTEND day IS the last day
  const getActualEndDate = (event: CalendarEvent): Date => {
    if (!event.end) return new Date(event.start);
    const endDate = new Date(event.end);
    const endHour = endDate.getHours();
    const isTimedEndOfDay = endHour === 23;
    
    if (isTimedEndOfDay) {
      // Timed event ending at 23:xx - this day IS the last day
      return startOfDay(endDate);
    } else {
      // DATE-only or earlier time - DTEND is exclusive, subtract 1 day
      return startOfDay(addDays(endDate, -1));
    }
  };

  // Get multi-day spanning events that appear on a specific day
  const getSpanningEventsForDay = (day: Date, allEvents: CalendarEvent[]): { event: CalendarEvent; isStart: boolean; isEnd: boolean; spanInWeek: number; dayPositionInWeek: number }[] => {
    const dayStart = startOfDay(day);
    const dayOfWeek = day.getDay(); // 0 = Sunday, 6 = Saturday
    
    return allEvents
      .filter(event => {
        if (!isMultiDayEvent(event)) return false;
        const eventStart = startOfDay(new Date(event.start));
        const eventEnd = getActualEndDate(event);
        // Check if this day falls within the event's span
        return isWithinInterval(dayStart, { start: eventStart, end: eventEnd });
      })
      .map(event => {
        const eventStart = startOfDay(new Date(event.start));
        const eventEnd = getActualEndDate(event);
        const isStart = isSameDay(dayStart, eventStart);
        const isEnd = isSameDay(dayStart, eventEnd);
        
        // Calculate how many days this event spans within the current week row
        const weekStart = addDays(dayStart, -dayOfWeek);
        const weekEnd = addDays(weekStart, 6);
        
        const effectiveStart = eventStart < weekStart ? weekStart : eventStart;
        const effectiveEnd = eventEnd > weekEnd ? weekEnd : eventEnd;
        const spanInWeek = differenceInDays(effectiveEnd, effectiveStart) + 1;
        
        // Position in the week (0-6)
        const dayPositionInWeek = dayOfWeek;
        
        return { event, isStart, isEnd, spanInWeek, dayPositionInWeek };
      });
  };

  return (
    <div>
      {/* Remove any potential navigation wrapper */}
      <div className="grid grid-cols-7 gap-px bg-slate-700/10 drop-shadow-">
      {/* Weekday headers */}
      {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map((d) => (
        <div key={d} className="bg-white/5 text-xs text-center font-light uppercase text-slate-300">
          {d}
        </div>
      ))}

      {/* Days */}
      {days.map((day) => {
        // Filter regular events - exclude quiz window events (they show as spanning bars)
        const dayEvents = events.filter((ev) =>
          isSameDay(new Date(ev.start), day) && !isQuizWindowEvent(ev)
        );
        
        // Get quiz window events that START on this day (for showing start of bar)
        const startingQuizWindowEvents = events.filter((ev) =>
          isSameDay(new Date(ev.start), day) && isQuizWindowEvent(ev)
        );
        
        // Get quiz window events that span this day (but don't start on this day)
        const spanningQuizWindowEvents = events.filter((ev) => {
          if (!isQuizWindowEvent(ev)) return false;
          const eventStart = startOfDay(new Date(ev.start));
          const eventEnd = getActualEndDate(ev);
          const dayStart = startOfDay(day);
          // Event spans this day but doesn't start on this day
          return dayStart > eventStart && dayStart <= eventEnd;
        });
        
        // Add UC Launch events for this day if they should be shown
        const dayLaunchEvents = showUCLaunch ? launchEvents.filter((ev) =>
          isSameDay(new Date(ev.start), day)
        ) : [];
        
        // Add Cal Bears events for this day if they should be shown
        const dayCalBearsEvents = showCalBears ? calBearsEvents.filter((ev) =>
          isSameDay(new Date(ev.start), day)
        ) : [];
        
        // Add Campus Groups events for this day if they should be shown
        const dayCampusGroupsEvents = showCampusGroups ? campusGroupsEvents.filter((ev) =>
          isSameDay(new Date(ev.start), day)
        ) : [];
        
        // Add Academic Calendar events for this day if they should be shown
        // IMPORTANT: Exclude multi-day events - they appear ONLY as spanning bars, not as regular events
        const dayAcademicCalendarEvents = showAcademicCalendar ? academicCalendarEvents.filter((ev) =>
          isSameDay(new Date(ev.start), day) && !isMultiDayEvent(ev)
        ) : [];
        
        // Get multi-day academic calendar events that START on this day (for showing start of bar)
        const startingMultiDayAcademicEvents = showAcademicCalendar ? academicCalendarEvents.filter((ev) =>
          isSameDay(new Date(ev.start), day) && isMultiDayEvent(ev)
        ) : [];
        
        // Get multi-day academic calendar events that span this day (but don't start on this day)
        // Note: We use getActualEndDate to account for exclusive DTEND in ICS format
        const spanningAcademicEvents = showAcademicCalendar ? academicCalendarEvents.filter((ev) => {
          if (!ev.end) return false;
          const eventStart = startOfDay(new Date(ev.start));
          const eventEnd = getActualEndDate(ev);
          const dayStart = startOfDay(day);
          // Event spans this day but doesn't start on this day
          return dayStart > eventStart && dayStart <= eventEnd;
        }) : [];
        
        // Add Newsletter events for this day if they should be shown
        const dayNewsletterEvents = showNewsletter ? newsletterEvents.filter((ev) =>
          isSameDay(new Date(ev.start), day)
        ) : [];
        
        // Debug logging for Newsletter events (only on 1st of month to avoid spam)
        if (day.getDate() === 1) {
          console.log(`📰 [MonthGrid] Newsletter Debug for ${format(day, 'MMMM yyyy')}:`, {
            showNewsletter,
            totalNewsletterEvents: newsletterEvents.length,
            sampleEvent: newsletterEvents[0],
            allNewsletterDates: newsletterEvents.map(ev => ({
              title: ev.title,
              start: ev.start,
              parsed: new Date(ev.start).toISOString()
            })),
            eventsForThisMonth: newsletterEvents.filter(ev => {
              const evDate = new Date(ev.start);
              return evDate.getMonth() === day.getMonth() && evDate.getFullYear() === day.getFullYear();
            }).length
          });
        }
        
        // Debug logging for Campus Groups
        if (day.getDate() === 1) { // Only log once per month to avoid spam
          console.log(`MonthGrid Campus Groups Debug:`, {
            showCampusGroups,
            campusGroupsEventsLength: campusGroupsEvents.length,
            campusGroupsEvents: campusGroupsEvents,
            month: format(day, 'MMMM yyyy')
          });
        }
        if (showCampusGroups && campusGroupsEvents.length > 0) {
          console.log(`Campus Groups: ${campusGroupsEvents.length} total events, ${dayCampusGroupsEvents.length} events for ${day.toDateString()}`);
        }
        
        // Handle newsletter events - if multiple, combine into one
        let processedNewsletterEvents = dayNewsletterEvents;
        if (dayNewsletterEvents.length > 1) {
          // Create a single combined event for multiple newsletter events
          const combinedEvent = {
            ...dayNewsletterEvents[0],
            title: 'Multiple Events',
            description: dayNewsletterEvents.map(ev => ev.title).join('\n• '),
            htmlContent: dayNewsletterEvents.map((ev, idx) => 
              `<div class="newsletter-event-${idx}">
                <h3 class="font-semibold text-lg mb-2">${ev.title}</h3>
                ${ev.htmlContent || ''}
              </div>`
            ).join('<hr class="my-4 border-slate-300" />'),
            multipleEvents: dayNewsletterEvents,
            type: 'newsletter' as const
          };
          processedNewsletterEvents = [combinedEvent];
        }
        
        // Combine regular events with launch events, Campus Groups events, Academic Calendar, and Newsletter events
        // NOTE: Cal Bears events are EXCLUDED - they only appear as logo icon in header (like Greek Theater)
        // Sort all events chronologically by start time
        const allDayEvents: (CalendarEvent | NewsletterCalendarEvent)[] = [
          ...dayEvents, 
          ...dayLaunchEvents, 
          ...dayCampusGroupsEvents,
          ...dayAcademicCalendarEvents,
          ...processedNewsletterEvents
        ].sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
        const isToday = isSameDay(day, new Date());
        const hasGreekEvent = hasGreekTheaterEventOnDate(day);
        const hasCalBearsEvent = showCalBears && dayCalBearsEvents.length > 0;
        const hasCampusGroupsEvent = showCampusGroups && dayCampusGroupsEvents.length > 0;
        const hasAcademicCalendarEvent = showAcademicCalendar && dayAcademicCalendarEvents.length > 0;
        const hasNewsletterEvent = showNewsletter && dayNewsletterEvents.length > 0;
        const hasSpanningEvent = spanningAcademicEvents.length > 0;
        const hasStartingMultiDayEvent = startingMultiDayAcademicEvents.length > 0;
        const hasStartingQuizWindow = startingQuizWindowEvents.length > 0;
        const hasSpanningQuizWindow = spanningQuizWindowEvents.length > 0;

        // Debug log for days with newsletter events
        if (hasNewsletterEvent) {
          console.log(`📰 [MonthGrid] Newsletter event on ${format(day, 'MMM d, yyyy')}:`, {
            count: dayNewsletterEvents.length,
            events: dayNewsletterEvents.map(e => e.title)
          });
        }

        // Function to parse event title and extract course name and assignment
        const parseEventTitle = (title: string) => {
          let courseName = '';
          let assignment = '';
          
          // Debug: log the title to see what we're working with
          console.log('Parsing title:', title);
          
          // Handle titles like "Part 1 - Interview Report  [EWMBA 205-LEC-01A & 02A FA25]"
          if (title.includes('EWMBA 205')) {
            courseName = 'Leading People (205)';
            
            // Extract assignment part before the [EWMBA...] bracket
            const assignmentMatch = title.match(/^(.+?)\s*\[EWMBA/);
            if (assignmentMatch) {
              assignment = assignmentMatch[1].trim();
            }
            
            console.log('Course:', courseName, 'Assignment:', assignment);
          } else if (title.match(/EWMBA \d+/)) {
            // Extract course number and convert to readable format
            const courseMatch = title.match(/EWMBA (\d+)/);
            if (courseMatch) {
              const courseNum = courseMatch[1];
              const courseMappings: { [key: string]: string } = {
                '201': 'Microeconomics',
                '201A': 'Microeconomics',
                '201B': 'Macroeconomics',
                '202': 'Financial Accounting',
                '204': 'Organizational Behavior',
                '205': 'Leading People',
                '206': 'Data & Decisions',
                '207': 'Corporate Finance',
                '208': 'Marketing',
                '209': 'Strategy',
                '210': 'Business Ethics',
              };
              const courseTitle = courseMappings[courseNum] || `EWMBA ${courseNum}`;
              courseName = `${courseTitle} (${courseNum})`;
              
              // Extract assignment from title - content before [EWMBA...]
              const assignmentMatch = title.match(/^(.+?)\s*\[EWMBA/);
              if (assignmentMatch) {
                assignment = assignmentMatch[1].trim();
              }
            }
          } else {
            // For other events, try to find assignment pattern
            const parts = title.split(' - ');
            if (parts.length > 1) {
              courseName = parts[0];
              assignment = parts[1];
            } else {
              courseName = title;
            }
          }
          
          return { courseName, assignment };
        };

        // Function to get course color based on ICS source file
        const getCourseColor = (event: CalendarEvent) => {
          const hoverGold = 'hover:border-[#FDB515]'; // Berkeley Gold
          const glassBase = 'backdrop-blur-sm bg-clip-padding saturate-50 shadow-sm';

          // Check for Haas Academic Calendar events - Amber/Gold styling
          if (event.source && event.source.includes('haas_academic_calendar')) {
            return `${glassBase} bg-amber-600/50 border-amber-500/50 text-white ${hoverGold}`;
          }

          // Check for UC Launch events FIRST - Orange styling
          if (event.source && event.source.includes('uc_launch_events')) {
            return `${glassBase} bg-orange-800/40 border-orange-700/40 text-white ${hoverGold}`;
          }

          // Check for Cal Bears events - Blue and Gold styling
          if (event.source && event.source.includes('cal_bears_home')) {
            return `${glassBase} bg-blue-800/40 border-yellow-500/40 text-white ${hoverGold}`;
          }

          // Check for Campus Groups events - Blue styling (matches dropdown icon)
          if (event.source && event.source.includes('campus_groups')) {
            return `${glassBase} bg-blue-600 border-blue-600text-white ${hoverGold}`;
          }

          // Check for Teams@Haas events FIRST (before source-based detection)
            // because Teams@Haas events are in the 205 ICS files but should have purple styling
          if (event.title.includes('Teams@Haas')) {
            return `${glassBase} bg-violet-800/40 border-violet-900/40 text-white ${hoverGold}`;
          }

          // Check the source filename to determine course type
          if (event.source) {
            // EWMBA 201A (Microeconomics) - Forest Green
            if (event.source.includes('201a_micro')) {
              return `${glassBase} bg-green-800/35 border-green-700/40 text-white ${hoverGold}`;
            }

            // EWMBA 201B (Macroeconomics) - Navy Blue
            if (event.source.includes('201b_macro')) {
              return `${glassBase} bg-blue-900/60 border-blue-700/50 text-white ${hoverGold}`;
            }

            // EWMBA 202 (Financial Accounting) - Teal
            if (event.source.includes('202_accounting') || event.source.includes('ewmba202_accounting')) {
              return `${glassBase} bg-teal-700/50 border-teal-600/50 text-white ${hoverGold}`;
            }

            // EWMBA 203 (Financial Management) - Amber
            if (event.source.includes('203_') || event.source.includes('financial_management')) {
              return `${glassBase} bg-amber-700/50 border-amber-600/50 text-white ${hoverGold}`;
            }

            // EWMBA 204 (Operations & Data Analytics) - Slate
            if (event.source.includes('204_') || event.source.includes('operations')) {
              return `${glassBase} bg-slate-700/50 border-slate-600/50 text-white ${hoverGold}`;
            }

            // EWMBA 205 (Leading People) - Crimson
            if (event.source.includes('205_') || event.source.includes('leadingpeople')) {
              return `${glassBase} bg-red-800/35 border-red-700/40 text-white ${hoverGold}`;
            }

            // EWMBA 206 (Data & Decisions) - Sky Blue
            if (event.source.includes('206_') || event.source.includes('DataDecisions')) {
              return `${glassBase} bg-sky-700/50 border-sky-600/50 text-white ${hoverGold}`;
            }

            // EWMBA 207 (Corporate Finance) - Indigo
            if (event.source.includes('207_') || event.source.includes('corporate_finance')) {
              return `${glassBase} bg-indigo-800/50 border-indigo-700/50 text-white ${hoverGold}`;
            }

            // EWMBA 208 (Marketing) - Orange
            if (event.source.includes('208_') || event.source.includes('Marketing')) {
              return `${glassBase} bg-orange-600/50 border-orange-500/50 text-white ${hoverGold}`;
            }

            // EWMBA 209 (Strategic Management) - Purple
            if (event.source.includes('209_') || event.source.includes('strategic')) {
              return `${glassBase} bg-purple-800/50 border-purple-700/50 text-white ${hoverGold}`;
            }

            // EWMBA 210 (Ethics) - Rose
            if (event.source.includes('210_') || event.source.includes('ethics')) {
              return `${glassBase} bg-rose-700/50 border-rose-600/50 text-white ${hoverGold}`;
            }

            // EWMBA 211 (Negotiations) - Emerald
            if (event.source.includes('211_') || event.source.includes('negotiations')) {
              return `${glassBase} bg-emerald-700/50 border-emerald-600/50 text-white ${hoverGold}`;
            }

            // EWMBA 212 (Entrepreneurship) - Fuchsia
            if (event.source.includes('212_') || event.source.includes('entrepreneurship')) {
              return `${glassBase} bg-fuchsia-800/50 border-fuchsia-700/50 text-white ${hoverGold}`;
            }

            // Spring B Term Classes - Cyan
            if (event.source.includes('springb')) {
              return `${glassBase} bg-cyan-700/50 border-cyan-600/50 text-white ${hoverGold}`;
            }
          }
          
          // Default styling - no title-based fallbacks to avoid misclassification
          return `bg-slate-600/40 border-transparent text-white ${hoverGold}`;
        };
        
        // Function to check if event has a quiz (for Data & Decisions classes)
        const hasQuiz = (event: CalendarEvent): boolean => {
          if (!event.description) return false;
          
          // Check if it's a Data & Decisions class
          const isDataDecisions = event.title.includes('Data & Decisions') || 
                                  (event.source && event.source.includes('DataDecisions'));
          
          if (!isDataDecisions) return false;
          
          // Look for "QUIZ: Quiz" pattern (not "QUIZ: No quiz")
          const quizMatch = event.description.match(/QUIZ:\s*Quiz\s+\d+/i);
          return !!quizMatch;
        };

        // Check if this day should have the violet glow effect
        const dayString = format(day, 'yyyy-MM-dd'); // Convert to YYYY-MM-DD format
        const shouldGlow = glowingDate === dayString;

        return (
            <div
              key={day.toISOString()}
              className={`relative h-28 lg:h-32 p-0 flex flex-col overflow-hidden rounded-md ${
                isSameMonth(day, currentMonth) ? 'bg-slate-600/10' : 'bg-transparent opacity-40'
              } ${isToday ? 'rounded-md border-1 border-yellow-300 ring-1 ring-yellow-300/60 shadow-[0_0_30px_rgba(253,181,21,0.3)]' : ''} ${
                shouldGlow ? 'newsletter-cell-glow' : ''
              }`}
            >
              <div className={`text-xs mb-0 lg:mb-1 flex-shrink-0 flex items-center gap-1 overflow-hidden ${
                isToday ? 'translate-x-[2px] text-yellow-500 font-black ' : 'text-white font-light'
              }`}>
                {format(day, 'd')}
                {showGreekTheater && hasGreekEvent && (
                <Image 
                  src="/greeklogo.png"
                  alt="Greek Theater Event"
                  width={40}
                  height={24}
                  className="flex-shrink-0 cursor-pointer opacity-80 hover:opacity-100 transition-opacity object-contain" 
                  title={`Greek Theater: ${getGreekTheaterEventsForDate(day).map(e => e.title).join(', ')}`}
                  onClick={(e) => {
                  e.stopPropagation();
                  const greekEvents = getGreekTheaterEventsForDate(day);
                  if (greekEvents.length > 0) {
                    // Convert the first Greek Theater event to calendar event format
                    const calendarEvent = greekTheaterToCalendarEvent(greekEvents[0]);
                    onEventClick(calendarEvent);
                  }
                  }}
                />
                )}
                {hasCalBearsEvent && (
                <Image 
                  src="/cal_logo.png"
                  alt="Cal Bears Event"
                  width={25}
                  height={20}
                  className="flex-shrink-0 cursor-pointer opacity-80 hover:opacity-100 transition-opacity object-containo hover-invert " 
                  title={`Cal Bears: ${dayCalBearsEvents.map(e => e.title).join(', ')}`}
                  onClick={(e) => {
                  e.stopPropagation();
                  if (dayCalBearsEvents.length > 0) {
                    onEventClick(dayCalBearsEvents[0]);
                  }
                  }}
                />
                )}
                {hasCampusGroupsEvent && (
                <div 
                  className="w-6 h-6 flex-shrink-0 cursor-pointer opacity-80 hover:opacity-100 transition-opacity bg-blue-600 rounded-lg flex items-center justify-center"
                  title={`Campus Groups: ${dayCampusGroupsEvents.map(e => e.title).join(', ')}`}
                  onClick={(e) => {
                  e.stopPropagation();
                  if (dayCampusGroupsEvents.length > 0) {
                    onEventClick(dayCampusGroupsEvents[0]);
                  }
                  }}
                >
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
                )}
                {hasAcademicCalendarEvent && (
                <div 
                  className="flex-shrink-0 cursor-pointer opacity-80 hover:opacity-100 transition-all duration-200 bg-amber-600 rounded-md flex items-center justify-center relative border border-transparent hover:border-white w-4 h-4 md:w-auto md:h-auto md:px-1.5 md:py-0"
                  title={`Academic Calendar: ${dayAcademicCalendarEvents.map(e => e.title).join(', ')}`}
                  onClick={(e) => {
                  e.stopPropagation();
                  if (dayAcademicCalendarEvents.length > 0) {
                    onEventClick(dayAcademicCalendarEvents[0]);
                  }
                  }}
                >
                  {/* Calendar icon for mobile, text for larger screens */}
                  <svg className="w-3 h-3 text-white md:hidden" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V10h14v10zm0-12H5V6h14v2z"/>
                  </svg>
                  <span className="hidden md:inline text-[10px] text-white font-medium leading-tight">📅</span>
                </div>
                )}
                {hasNewsletterEvent && (
                <div 
                  className="flex-shrink-0 cursor-pointer opacity-80 hover:opacity-100 transition-all duration-200 bg-purple-600 rounded-md flex items-center justify-center relative newsletter-icon-pulse border border-transparent hover:border-white w-4 h-4 md:w-auto md:h-auto md:px-1.5 md:py-0"
                  title={`Newsletter: ${dayNewsletterEvents.map(e => e.title).join(', ')}`}
                  onClick={(e) => {
                  e.stopPropagation();
                  if (dayNewsletterEvents.length > 0) {
                    // If multiple newsletter events on same day, create a combined event with all events attached
                    if (dayNewsletterEvents.length > 1) {
                      const combinedEvent = {
                        ...dayNewsletterEvents[0],
                        title: `${dayNewsletterEvents.length} Newsletter Events`,
                        description: dayNewsletterEvents.map(ev => ev.title).join('\n• '),
                        // Combine all HTML content
                        htmlContent: dayNewsletterEvents.map((ev, idx) => 
                          `<div class="newsletter-event-${idx}">
                            <h3 class="font-semibold text-lg mb-2">${ev.title}</h3>
                            ${ev.htmlContent || ''}
                          </div>`
                        ).join('<hr class="my-4 border-slate-300" />'),
                        // Add all individual events for modal to access
                        multipleEvents: dayNewsletterEvents
                      };
                      onEventClick(combinedEvent);
                    } else {
                      // Single event, show normally
                      onEventClick(dayNewsletterEvents[0]);
                    }
                  }
                  }}
                >
                  {/* Icon for mobile, text for larger screens */}
                  <svg className="w-3 h-3 text-white md:hidden" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M9 21c0 .5.4 1 1 1h4c.6 0 1-.5 1-1v-1H9v1zm3-19C8.1 2 5 5.1 5 9c0 2.4 1.2 4.5 3 5.7V17c0 .5.4 1 1 1h6c.6 0 1-.5 1-1v-2.3c1.8-1.3 3-3.4 3-5.7 0-3.9-3.1-7-7-7z"/>
                  </svg>
                  <span className="hidden md:inline text-[10px] text-white font-medium leading-tight">Event</span>
                </div>
                )}
              </div>
              <div className="flex-1 flex flex-col gap-px overflow-hidden">
                {allDayEvents.length > 0 ? (
                allDayEvents.map((ev) => {
                  // Check if this is a newsletter event
                  const isNewsletterEvent = ev.source === 'newsletter' || (ev.source && ev.source.includes('newsletter'));
                  
                  // Check if this is another non-cohort event (UC Launch, Campus Groups, Cal Bears)
                  const isOtherNonCohortEvent = !isNewsletterEvent && ev.source && 
                    (ev.source.includes('uc_launch_events') || 
                     ev.source.includes('campus_groups') || 
                     ev.source.includes('cal_bears_home') ||
                     ev.source.includes('haas_academic_calendar'));
                  
                  // Check if this is an academic calendar event
                  const isAcademicCalendarEvent = ev.source && ev.source.includes('haas_academic_calendar');
                  
                  // Check if this event is a multi-day event
                  const isMultiDayAcademicEvent = isAcademicCalendarEvent && isMultiDayEvent(ev);
                  const eventSpanDays = isMultiDayAcademicEvent && ev.end ? differenceInDays(startOfDay(new Date(ev.end)), startOfDay(new Date(ev.start))) + 1 : 0;
                  
                  if (isNewsletterEvent) {
                    // Newsletter event - show title with line-clamp-1 on mobile, line-clamp-3 on desktop
                    const newsletterEv = ev as NewsletterCalendarEvent;
                    const isMultiple = ev.title === 'Multiple Events';
                    
                    return (
                      <div
                        key={ev.uid ?? ev.title + ev.start}
                        className="flex-1 min-h-0 max-h-full text-[10px] px-0.5 rounded-sm cursor-pointer hover:opacity-80 transition-opacity backdrop-blur- bg-clip-padding saturate-50 shadow-sm bg-purple-600/60 text-white font-medium overflow-hidden"
                        title={isMultiple ? `${newsletterEv.multipleEvents?.length || 0} Newsletter Events` : `Newsletter: ${ev.title}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (allDayEvents.length > 1 && onMultiEventClick) {
                            onMultiEventClick(allDayEvents, day);
                          } else {
                            onEventClick(ev);
                          }
                        }}
                      >
                        <div className="line-clamp-1 md:line-clamp-3">{ev.title}</div>
                      </div>
                    );
                  } else if (isOtherNonCohortEvent) {
                    // Other non-cohort events (UC Launch, Campus Groups, Cal Bears, Academic Calendar)
                    const courseColor = getCourseColor(ev);
                    
                    // For multi-day academic events, show special styling
                    if (isMultiDayAcademicEvent) {
                      return (
                        <div
                          key={ev.uid ?? ev.title + ev.start}
                          className={`flex-1 min-h-0 max-h-full text-[10px] px-0.5 rounded-sm cursor-pointer hover:opacity-80 transition-opacity ${courseColor} font-medium overflow-hidden flex items-center gap-1`}
                          title={`${ev.title} (${eventSpanDays} days)`}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (allDayEvents.length > 1 && onMultiEventClick) {
                              onMultiEventClick(allDayEvents, day);
                            } else {
                              onEventClick(ev);
                            }
                          }}
                        >
                          <span className="truncate line-clamp-1 md:line-clamp-3">{ev.title}</span>
                          <span className="flex-shrink-0 text-[8px] bg-amber-700/60 px-1 rounded hidden md:inline">
                            {eventSpanDays}d
                          </span>
                        </div>
                      );
                    }
                    
                    return (
                      <div
                        key={ev.uid ?? ev.title + ev.start}
                        className={`flex-1 min-h-0 max-h-full text-[10px] px-0.5 rounded-sm cursor-pointer hover:opacity-80 transition-opacity ${courseColor} font-medium overflow-hidden`}
                        title={ev.title}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (allDayEvents.length > 1 && onMultiEventClick) {
                            onMultiEventClick(allDayEvents, day);
                          } else {
                            onEventClick(ev);
                          }
                        }}
                      >
                        <div className="line-clamp-1 md:line-clamp-3">{ev.title}</div>
                      </div>
                    );
                  } else {
                    // Regular cohort event - responsive height and truncation
                    const { courseName, assignment } = parseEventTitle(ev.title);
                    const courseColor = getCourseColor(ev);
                    const eventHasQuiz = hasQuiz(ev);
                    
                    // Build single text string for proper line clamping
                    const displayText = `${eventHasQuiz ? 'QUIZ: ' : ''}${courseName}${assignment ? ' — ' + assignment : ''}`;
                    
                    return (
                      <div
                        key={ev.uid ?? ev.title + ev.start}
                        className={`flex-1 min-h-0 max-h-full text-[10px] px-1 py-0.5 rounded-sm cursor-pointer hover:opacity-80 transition-opacity ${courseColor} ${eventHasQuiz ? 'font-bold' : 'font-medium'} overflow-hidden`}
                        title={`${assignment ? assignment + ' - ' : ''}${courseName} (${ev.title})${eventHasQuiz ? ' - QUIZ TODAY!' : ''}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (allDayEvents.length > 1 && onMultiEventClick) {
                            onMultiEventClick(allDayEvents, day);
                          } else {
                            onEventClick(ev);
                          }
                        }}
                      >
                        <div className="line-clamp-2 md:line-clamp-none">{displayText}</div>
                      </div>
                    );
                  }
                })
                ) : (
                <div className="flex-1" />
                )}
              </div>
              
              {/* Quiz window bar START (first day of quiz window) */}
              {hasStartingQuizWindow && (
                <div className="absolute bottom-0 left-0 right-0 h-3 z-10 overflow-hidden">
                  {startingQuizWindowEvents.slice(0, 1).map((ev, idx) => {
                    const eventStart = startOfDay(new Date(ev.start));
                    const eventEnd = getActualEndDate(ev);
                    const totalDays = differenceInDays(eventEnd, eventStart) + 1;
                    const isAlsoLastDay = isSameDay(eventStart, eventEnd);
                    
                    // Get course color based on source
                    const quizColor = ev.source?.includes('202_accounting') || ev.source?.includes('ewmba202') 
                      ? 'bg-teal-600/90 hover:bg-teal-500' 
                      : ev.source?.includes('DataDecisions') || ev.source?.includes('206_')
                      ? 'bg-sky-600/90 hover:bg-sky-500'
                      : 'bg-violet-600/90 hover:bg-violet-500';
                    
                    return (
                      <div
                        key={`quiz-start-${ev.uid || ev.title}-${idx}`}
                        className={`h-full ${quizColor} cursor-pointer transition-colors flex items-center justify-between px-1 border-l border-white/50 overflow-hidden ${isAlsoLastDay ? 'border-r' : ''}`}
                        title={`${ev.title} (Day 1 of ${totalDays})`}
                        onClick={(e) => {
                          e.stopPropagation();
                          onEventClick(ev);
                        }}
                      >
                        <span className="text-[8px] text-white font-medium truncate">
                          📝 {ev.title.replace(' Window', '').replace('(Take anytime ', '(')}
                        </span>
                        <span className="text-[7px] text-white/90 font-medium flex-shrink-0 ml-0.5">
                          1/{totalDays}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
              
              {/* Quiz window spanning bar (continuation days) */}
              {hasSpanningQuizWindow && !hasStartingQuizWindow && (
                <div className="absolute bottom-0 left-0 right-0 h-3 z-10 overflow-hidden">
                  {spanningQuizWindowEvents.slice(0, 1).map((ev, idx) => {
                    const eventStart = startOfDay(new Date(ev.start));
                    const eventEnd = getActualEndDate(ev);
                    const totalDays = differenceInDays(eventEnd, eventStart) + 1;
                    const currentDayNumber = differenceInDays(startOfDay(day), eventStart) + 1;
                    const isLastDay = isSameDay(day, eventEnd);
                    const dayOfWeek = day.getDay();
                    const isFirstOfWeek = dayOfWeek === 0;
                    
                    // Get course color based on source
                    const quizColor = ev.source?.includes('202_accounting') || ev.source?.includes('ewmba202') 
                      ? 'bg-teal-600/80 hover:bg-teal-500' 
                      : ev.source?.includes('DataDecisions') || ev.source?.includes('206_')
                      ? 'bg-sky-600/80 hover:bg-sky-500'
                      : 'bg-violet-600/80 hover:bg-violet-500';
                    
                    return (
                      <div
                        key={`quiz-span-${ev.uid || ev.title}-${idx}`}
                        className={`h-full ${quizColor} cursor-pointer transition-colors flex items-center justify-between px-1 border-l border-white/50 overflow-hidden ${
                          isLastDay ? 'border-r' : ''
                        }`}
                        title={`${ev.title} (Day ${currentDayNumber} of ${totalDays})`}
                        onClick={(e) => {
                          e.stopPropagation();
                          onEventClick(ev);
                        }}
                      >
                        {isFirstOfWeek && (
                          <span className="text-[8px] text-white font-medium truncate">
                            📝 {ev.title.replace(' Window', '').replace('(Take anytime ', '(')}
                          </span>
                        )}
                        <span className="text-[7px] text-white/90 font-medium flex-shrink-0 ml-auto">
                          {currentDayNumber}/{totalDays}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
              
              {/* Multi-day event bar START (first day of multi-day event) */}
              {hasStartingMultiDayEvent && (
                <div className="absolute bottom-0 left-0 right-0 h-3 z-10 overflow-hidden">
                  {startingMultiDayAcademicEvents.slice(0, 1).map((ev, idx) => {
                    const eventStart = startOfDay(new Date(ev.start));
                    const eventEnd = getActualEndDate(ev);
                    const totalDays = differenceInDays(eventEnd, eventStart) + 1;
                    const isAlsoLastDay = isSameDay(eventStart, eventEnd); // Single day event that spans midnight
                    
                    return (
                      <div
                        key={`start-${ev.uid || ev.title}-${idx}`}
                        className={`h-full bg-amber-500/80 cursor-pointer hover:bg-amber-600 transition-colors flex items-center justify-between px-1 border-l border-white/50 overflow-hidden ${isAlsoLastDay ? 'border-r' : ''}`}
                        title={`${ev.title} (Day 1 of ${totalDays})`}
                        onClick={(e) => {
                          e.stopPropagation();
                          onEventClick(ev);
                        }}
                      >
                        <span className="text-[8px] text-white font-medium truncate">
                          {ev.title}
                        </span>
                        <span className="text-[7px] text-white/90 font-medium flex-shrink-0 ml-0.5">
                          1/{totalDays}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
              
              {/* Multi-day spanning event bar (continuation days) */}
              {hasSpanningEvent && !hasStartingMultiDayEvent && (
                <div className="absolute bottom-0 left-0 right-0 h-3 z-10 overflow-hidden">
                  {spanningAcademicEvents.slice(0, 1).map((ev, idx) => {
                    const eventStart = startOfDay(new Date(ev.start));
                    const eventEnd = getActualEndDate(ev);
                    const totalDays = differenceInDays(eventEnd, eventStart) + 1;
                    const currentDayNumber = differenceInDays(startOfDay(day), eventStart) + 1;
                    const isLastDay = isSameDay(day, eventEnd);
                    const dayOfWeek = day.getDay();
                    const isFirstOfWeek = dayOfWeek === 0;
                    
                    return (
                      <div
                        key={`span-${ev.uid || ev.title}-${idx}`}
                        className={`h-full bg-amber-500/70 cursor-pointer hover:bg-amber-500/90 transition-colors flex items-center justify-between px-1 border-l border-white/50 overflow-hidden ${
                          isLastDay ? 'border-r' : ''
                        }`}
                        title={`${ev.title} (Day ${currentDayNumber} of ${totalDays})`}
                        onClick={(e) => {
                          e.stopPropagation();
                          onEventClick(ev);
                        }}
                      >
                        {isFirstOfWeek && (
                          <span className="text-[8px] text-white font-medium truncate">
                            {ev.title}
                          </span>
                        )}
                        <span className="text-[7px] text-white/90 font-medium flex-shrink-0 ml-auto">
                          {currentDayNumber}/{totalDays}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
        );
      })}
      </div>
    </div>
  );
}
