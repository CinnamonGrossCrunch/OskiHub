'use client';

import { useState, useEffect } from 'react';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import Image from 'next/image';
import { formatConsistentDate } from '@/lib/date-utils';
import { trackEvent } from '@/lib/analytics';

type WeeklyEvent = {
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
};

type MyWeekData = {
  weekStart: string;
  weekEnd: string;
  blueEvents: WeeklyEvent[];
  goldEvents: WeeklyEvent[];
  blueSummary?: string;
  goldSummary?: string;
  processingTime?: number;
};

type CohortType = 'blue' | 'gold';

interface MyWeekWidgetProps {
  // Direct data from unified API
  data?: MyWeekData;
  selectedCohort?: CohortType;
  isExpanded?: boolean;
  onExpandChange?: (isExpanded: boolean) => void;
}

export default function MyWeekWidget({ data, selectedCohort = 'blue', isExpanded = false, onExpandChange }: MyWeekWidgetProps) {
  const [weekData, setWeekData] = useState<MyWeekData | null>(data || null);
  const [loading, setLoading] = useState(!data); // If data provided, don't start loading

  // Use controlled state from parent
  const setIsExpanded = (value: boolean) => {
    onExpandChange?.(value);
  };

  // Function to handle MyWeek event clicks
  const handleEventClick = (event: React.MouseEvent, eventData: WeeklyEvent) => {
    event.preventDefault();
    event.stopPropagation();
    
    console.log(`🖱️ MyWeek event clicked: ${eventData.title}`);
    console.log(`🔍 Event source type:`, eventData.sourceType);
    trackEvent('my_week_event_clicked', { title: eventData.title, source: eventData.sourceType || 'unknown' });
    
    // Check if this is a newsletter-sourced event
    if (eventData.sourceType === 'newsletter' && eventData.newsletterSource) {
      console.log(`📰 Newsletter item clicked - opening newsletter section`);
      console.log(`Section: ${eventData.newsletterSource.sectionTitle} (index ${eventData.newsletterSource.sectionIndex})`);
      console.log(`Item: ${eventData.newsletterSource.itemTitle} (index ${eventData.newsletterSource.itemIndex})`);
      
      // HIERARCHY CHECK: Is newsletter widget visible?
      const newsletterWidget = document.querySelector('[data-newsletter-widget]') as HTMLElement | null;
      const isNewsletterVisible = newsletterWidget && 
        newsletterWidget.offsetParent !== null && // Element is not display:none
        newsletterWidget.getBoundingClientRect().height > 0; // Element has height
      
      console.log(`👀 Newsletter visibility check: ${isNewsletterVisible ? 'VISIBLE' : 'HIDDEN (inactive tab)'}`);
      
      if (!isNewsletterVisible) {
        // CASE 1: Newsletter is hidden (mobile/small screen with inactive tab)
        console.log(`🔄 Step 1: Switching to Updates tab...`);
        
        // Switch to Updates tab first
        const switchTabEvent = new CustomEvent('switchToTab', {
          detail: {
            tabName: 'Updates',
            timestamp: Date.now()
          }
        });
        window.dispatchEvent(switchTabEvent);
        
        // Wait for tab switch, then expand/highlight
        setTimeout(() => {
          console.log(`📬 Step 2: Tab active - now opening newsletter section`);
          const openNewsletterEvent = new CustomEvent('openNewsletterSection', {
            detail: {
              sectionIndex: eventData.newsletterSource!.sectionIndex,
              itemIndex: eventData.newsletterSource!.itemIndex,
              sectionTitle: eventData.newsletterSource!.sectionTitle,
              itemTitle: eventData.newsletterSource!.itemTitle,
              timestamp: Date.now()
            }
          });
          window.dispatchEvent(openNewsletterEvent);
        }, 150); // Wait for tab switch animation
      } else {
        // CASE 2: Newsletter already visible - proceed directly
        console.log(`✅ Newsletter visible - opening section directly`);
        
        const openNewsletterEvent = new CustomEvent('openNewsletterSection', {
          detail: {
            sectionIndex: eventData.newsletterSource.sectionIndex,
            itemIndex: eventData.newsletterSource.itemIndex,
            sectionTitle: eventData.newsletterSource.sectionTitle,
            itemTitle: eventData.newsletterSource.itemTitle,
            timestamp: Date.now()
          }
        });
        window.dispatchEvent(openNewsletterEvent);
      }
      
      // Note: No scrolling - just expands section/subsection and adds highlight animation
    } else {
      // Calendar-sourced event - check if calendar is visible
      console.log(`📅 Calendar event clicked - checking calendar visibility`);
      
      // Check if calendar widget is visible
      const calendarElement = document.querySelector('[data-calendar-list-view]') as HTMLElement | null;
      const isCalendarVisible = calendarElement && 
        calendarElement.offsetParent !== null && 
        calendarElement.getBoundingClientRect().height > 0;
      
      console.log(`👀 Calendar visibility check: ${isCalendarVisible ? 'VISIBLE' : 'HIDDEN (inactive tab)'}`);
      
      if (!isCalendarVisible) {
        // CASE 1: Calendar is hidden (on different tab like Updates or Slack)
        console.log(`� Step 1: Switching to OskiHub Cal tab...`);
        
        // Switch to Calendar tab first
        const switchTabEvent = new CustomEvent('switchToTab', {
          detail: {
            tabName: 'OskiHub Cal',
            timestamp: Date.now()
          }
        });
        window.dispatchEvent(switchTabEvent);
        
        // Wait for tab switch, then trigger glow and scroll
        setTimeout(() => {
          console.log(`📅 Step 2: Tab active - now triggering calendar glow`);
          
          // Trigger glow animation
          const glowEvent = new CustomEvent('triggerCalendarGlow', { 
            detail: { eventTitle: eventData.title, timestamp: Date.now() }
          });
          window.dispatchEvent(glowEvent);
          
          // Scroll to calendar
          const calendarEl = document.querySelector('[data-calendar-list-view]');
          if (calendarEl) {
            calendarEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, 150); // Wait for tab switch animation
      } else {
        // CASE 2: Calendar already visible - proceed directly
        console.log(`✅ Calendar visible - triggering glow directly`);
        
        // Trigger glow animation on calendar list view via custom event
        const glowEvent = new CustomEvent('triggerCalendarGlow', { 
          detail: { eventTitle: eventData.title, timestamp: Date.now() }
        });
        
        window.dispatchEvent(glowEvent);
        
        // Scroll to calendar
        setTimeout(() => {
          const calendarEl = document.querySelector('[data-calendar-list-view]');
          if (calendarEl) {
            calendarEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, 100);
      }
      
      console.log(`📅 Directing attention to calendar for: ${eventData.title}`);
    }
  };

  // Temporary debug to understand the data issue
  useEffect(() => {
    console.log('🔍 MyWeekWidget received data:', {
      hasData: !!data,
      weekStart: data?.weekStart,
      weekEnd: data?.weekEnd,
      blueEvents: data?.blueEvents?.length || 0,
      goldEvents: data?.goldEvents?.length || 0,
      blueSummary: data?.blueSummary ? 'Present' : 'Missing',
      goldSummary: data?.goldSummary ? 'Present' : 'Missing',
      selectedCohort,
      actualBlueEvents: data?.blueEvents,
      actualGoldEvents: data?.goldEvents
    });
  }, [data, selectedCohort]);

  useEffect(() => {
    // If direct data is provided, use it
    if (data) {
      setWeekData(data);
      setLoading(false);
      return;
    }
    
    // No data provided - component requires data prop from parent
    setLoading(false);
  }, [data]);

  const formatDate = (dateString: string) => {
    // Use the consistent date formatting utility
    return formatConsistentDate(dateString);
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const getEventIcon = (type: WeeklyEvent['type']) => {
      switch (type) {
        case 'assignment': return '📝';
        case 'class': return '🎓';
        case 'exam': return '📊';
        case 'administrative': return '📋';
        case 'social': return '🎉';
        case 'newsletter': return '📰';
        case 'other': return '📌';
        default: return '📅';
      }
    };

  const getEventColor = (type: WeeklyEvent['type'], priority?: WeeklyEvent['priority']) => {
    // High priority items get stronger colors
    if (priority === 'high') {
      switch (type) {
      case 'assignment': return 'bg-red-900/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-red-300/50';
      case 'exam': return 'bg-orange-900/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-orange-300/50';
      default: return 'bg-red-900/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-red-300/50';
      }
    }
    
    // Regular colors for medium/low priority
    switch (type) {
      case 'assignment': return 'bg-amber-900/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-amber-300/50';
      case 'class': return 'bg-blue-900/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-300/50';
      case 'exam': return 'bg-orange-900/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-orange-300/50';
      case 'administrative': return 'bg-purple-900/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-purple-300/50';
      case 'social': return 'bg-green-900/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-green-300/50';
      case 'newsletter': return 'bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-slate-300/50';
      case 'other': return 'bg-gray-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-gray-300/50';
      default: return 'bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-slate-300/50';
    }
  };

  // const getPriorityIndicator = (priority?: WeeklyEvent['priority']) => {
  //   switch (priority) {
  //     case 'high': return '🔴';
  //     case 'medium': return '🟡';
  //     case 'low': return '🟢';
  //     default: return '';
  //   }
  // };

  if (loading) {
    return (
      <div className="p-6 ">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">My Week</h3>
          <div className="berkeley-spinner"></div>
        </div>
        <p className="text-sm text-slate-400">Analyzing your week...</p>
      </div>
    );
  }

  // Get cohort-specific events and summary
  const currentEvents = selectedCohort === 'blue' ? weekData?.blueEvents : weekData?.goldEvents;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const currentSummary = selectedCohort === 'blue' ? weekData?.blueSummary : weekData?.goldSummary;



  if (!weekData || !currentEvents?.length) {
    return (
      <div className="p-6 ">
        <div className="w-12 h-12 bg-slate-700 rounded-full flex items-center justify-center mx-auto mb-3">
          <span className="text-lg">📅</span>
        </div>
        <h3 className="text-base font-semibold text-white mb-2 text-center">My Week - {selectedCohort.charAt(0).toUpperCase() + selectedCohort.slice(1)} Cohort</h3>
        <p className="text-sm text-slate-400 text-center">No events found for the {selectedCohort} cohort this week.</p>
      </div>
    );
  }

  // Group events by date
  const eventsByDate = currentEvents.reduce((acc: Record<string, WeeklyEvent[]>, event: WeeklyEvent) => {
    const date = event.date;
    if (!acc[date]) {
      acc[date] = [];
    }
    acc[date].push(event);
    return acc;
  }, {} as Record<string, WeeklyEvent[]>);

  return (
    <div className={`flex w-full lg:mr-35 items-end transition-all duration-300 ${!isExpanded ? 'mb-0' : ''}`}>
      {/* Main Layout: Mobile vertical, Desktop horizontal */}
      <div className="w-full flex flex-col md:flex-row md:items-start gap-0 md:gap-6 md:rounded-2xl overflow-visible">
        {/* Header Section: "My Week" and Today's Date */}
        <div className="text-start mt-0 shrink-0 min-w-0 mb-0 md:mb-0 px-3 sm:px-0 relative">
          <div className="flex items-center gap-3 relative">
            <div className=" text-xl md:text-2xl font-extralight text-slate-400 mt-0 px-0 mb-0">
              My Week
            </div>
          </div>
            <div className="hidden md:block text-4xl md:text-5xl font-medium text-white">
            {new Date().toLocaleDateString('en-US', { month: 'short' })}{' '}
            <span className="text-white/60 ">{new Date().toLocaleDateString('en-US', { day: 'numeric' })}</span>
          </div>
          {/* Toggle button for all screens - centered at bottom on small screens, positioned near "My Week" on md+ */}
              <button
              onClick={() => { trackEvent('my_week_expanded', { expanded: !isExpanded }); setIsExpanded(!isExpanded); }}
              className={`flex items-center justify-center w-6 h-6 rounded-full bg-transparent border border-violet-400/40 hover:bg-slate-800 hover:border-violet-300/60 transition-all duration-500 ease-in-out absolute bottom-2 left-[90px] translate-y-[5px] scale-100 md:scale-100 md:bottom-auto md:top-0 translate-x-[10px] transition-transform ${
                !isExpanded ? 'animate-[rotating-violet-glow_1.5s_ease-in-out_infinite] hover:animate-[rotating-violet-glow-hover_4s_ease-in-out_infinite]' : ''
              }`}
              aria-label={isExpanded ? 'Collapse events' : 'Expand events'}
              >
              <svg
                className={`w-5 h-5 bg-none text-white/50 md:scale-80 transition-transform duration-1000 ease-in-out ${isExpanded ? '  md:scale-80 rotate-[225deg]' : 'rotate-0'}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                strokeWidth={2.0}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              </button>
        </div>

          {/* Events Section */}
          <div className={`flex-1 md:ml-10 -mr-20 min-w-0 space-y-0 w-full px-0 transition-all duration-500 overflow-hidden ${!isExpanded ? 'w-0 min-w-0 opacity-0 p-0' : 'p-1'}`}>
          {/* AI Summary */}
          {/* {currentSummary && (
            <div className="flex items-start backdrop-blur-md bg-turbulence gap-3 rounded-2xl p-1 mb-1">
              <div className="w-1 h-full rounded-full min-h-[60px] mt-0"></div>
              <div className=" rounded-2xl">
                <p className="text-md font-medium text-slate-300 leading-loose">
                  {currentSummary}
                </p>
              </div>
            </div>
          )} */}

          {/* Events List - Collapsible on all screens, vertical stack on desktop */}
            <div className={`flex flex-col gap-0 space-y-1 w-full overflow-hidden transition-all duration-500 ${isExpanded ? 'max-h-[800px] opacity-100' : 'max-h-0 opacity-0'}`}>
            {/* Show days with events */}
            {Object.entries(eventsByDate)
              .sort(([a], [b]) => new Date(a).getTime() - new Date(b).getTime())
              .map(([date, events], dateIndex) => (
                <div 
                  key={date} 
                  className={`flex flex-row ml-5 rounded-md bg-gradient-to-r from-violet-900/30 to-blue-900/10 items-center gap-1 mb-1 transition-all duration-500 ease-in-out ${
                    isExpanded 
                      ? 'opacity-100 translate-y-0 scale-100' 
                      : 'opacity-0 -translate-y-2 scale-95'
                  }`}
                  style={{
                    transitionDelay: isExpanded ? `${dateIndex * 100}ms` : `${(Object.entries(eventsByDate).length - dateIndex - 1) * 60}ms`
                  }}
                >
                  {/* Date Header - Fixed width on desktop */}
                  <div className="text-center w-24 text-sm font-semibold text-slate-100 px-2 py-0 shrink-0">
                    {formatDate(date)}
                  </div>
                  
                  {/* Events for this date - Stack vertically */}
                    <div className="flex-0 overflow-hidden rounded-sm border-l-2 border-white gap-1 flex-1 flex flex-col">
                    {events.map((event, index) => (
                      <div 
                        key={index} 
                        className={`flex-0 items-center space-x-2 rounded-sm px-3 py-0.5 group cursor-pointer hover:brightness-150 transition-all ${getEventColor(event.type, event.priority)}`}
                        onClick={(e) => handleEventClick(e, event)}
                      >
                        {/* Event Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-baseline space-x-2">
                            <h4 className={`text-sm font-medium text-white group-hover:opacity-80 transition-opacity truncate`}>
                              {event.title}
                            </h4>

                            {/* Time and Location */}
                            {/* <div className="flex items-baseline space-x-2 text-xs text-slate-400">
                              {event.time && (
                                <span>{event.time}</span>
                              )}
                              {event.location && (
                                <>
                                  <Image src="/images/location-icon.png" alt="location" width={14} height={14} className="w-3.5 h-3.5" />
                                  <span>{event.location}</span>
                                </>
                              )}
                            </div> */}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
          </div>
        </div>

       
      </div>
    </div>
  );
}