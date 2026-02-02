'use client';

import { useEffect, useRef } from 'react';
import { format } from 'date-fns';
import type { CalendarEvent } from '@/lib/icsUtils';

// Newsletter event type (same as in CohortCalendarTabs.tsx)
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

type Props = {
  event: CalendarEvent | null;
  originalEvent?: CalendarEvent | null; // Rich content from original calendar.ics when matched
  onClose: () => void;
  onNext?: () => void; // Navigate to next event
  onPrevious?: () => void; // Navigate to previous event
  hasNext?: boolean; // Whether there's a next event
  hasPrevious?: boolean; // Whether there's a previous event
  onTriggerGlow?: (eventDate: Date) => void; // Callback to trigger violet glow on date cell
};

export default function EventDetailModal({ event, originalEvent, onClose, onNext, onPrevious, hasNext, hasPrevious, onTriggerGlow }: Props) {
  const modalRef = useRef<HTMLDivElement>(null);

  // Check if event is from newsletter
  const isNewsletterEvent = event?.source === 'newsletter';
  const newsletterEvent = isNewsletterEvent ? (event as NewsletterCalendarEvent) : null;
  
  // Check if this is a Gmail newsletter (newsletter source but no sourceMetadata)
  const isGmailNewsletter = isNewsletterEvent && !newsletterEvent?.sourceMetadata;
  
  // Function to clean Gmail newsletter HTML - basic cleaning only
  // Newsletter-specific cleaning (like EW Wire footer removal) happens in Google Apps Script
  const cleanGmailNewsletterHTML = (html: string): string => {
    if (!isGmailNewsletter) return html;
    
    let cleaned = html;
    
    // Remove Gmail-specific wrappers
    cleaned = cleaned.replace(/<div class="gmail_quote[^"]*"[^>]*>/gi, '');
    cleaned = cleaned.replace(/<div[^>]*class="gmail_attr"[^>]*>[\s\S]*?<\/div>/gi, '');
    
    // Remove Gmail attachment notices
    cleaned = cleaned.replace(/<div[^>]*class="[^"]*gmail_att[^"]*"[^>]*>[\s\S]*?<\/div>/gi, '');
    
    // Remove email metadata headers
    cleaned = cleaned.replace(/<div[^>]*>\s*(Subject|From|To|Date|Cc|Bcc):\s*[^<]*<\/div>/gi, '');
    cleaned = cleaned.replace(/<br>\s*(Subject|From|To|Date|Cc|Bcc):\s*[^<]*<br>/gi, '');
    
    // Remove broken inline images (cid: references)
    cleaned = cleaned.replace(/<img[^>]*src="cid:[^"]*"[^>]*>/gi, '');
    
    // Remove fixed-width col elements entirely (they break responsive layout)
    cleaned = cleaned.replace(/<colgroup>[\s\S]*?<\/colgroup>/gi, '');
    cleaned = cleaned.replace(/<col[^>]*>/gi, '');
    
    // Remove fixed-width inline styles from elements
    // Remove width:XXXpx patterns from style attributes
    cleaned = cleaned.replace(/width:\s*\d+px\s*;?/gi, '');
    cleaned = cleaned.replace(/height:\s*\d+px\s*;?/gi, '');
    
    // Remove decorative sidebar cells (gold background cells that are empty or just contain <br>)
    // These are the narrow colored columns on left/right that squeeze content
    cleaned = cleaned.replace(/<td[^>]*background-color:\s*rgb\(253,\s*181,\s*21\)[^>]*>(\s*<br>\s*|\s*)<\/td>/gi, '');
    
    // Also remove rowspan decorative cells
    cleaned = cleaned.replace(/<td[^>]*rowspan[^>]*background-color:\s*rgb\(253,\s*181,\s*21\)[^>]*>(\s*<br>\s*|\s*)<\/td>/gi, '');
    
    // Remove empty spans that were image placeholders (spans with only width/height in style)
    cleaned = cleaned.replace(/<span[^>]*style="[^"]*"[^>]*>\s*<\/span>/gi, '');
    
    // Fix external image URLs - add responsive classes
    cleaned = cleaned.replace(
      /<img([^>]*)>/gi,
      (match, attrs) => {
        // Skip if already has class or is a cid: reference
        if (attrs.includes('class=') || attrs.includes('cid:')) {
          return match;
        }
        return `<img${attrs} class="max-w-full h-auto rounded-lg my-4" loading="lazy">`;
      }
    );
    
    // Remove empty divs and centers at start/end
    cleaned = cleaned.replace(/^(<div[^>]*>\s*<\/div>\s*)+/, '');
    cleaned = cleaned.replace(/(<div[^>]*>\s*<\/div>\s*)+$/, '');
    cleaned = cleaned.replace(/^(<center[^>]*>\s*<\/center>\s*)+/, '');
    cleaned = cleaned.replace(/(<center[^>]*>\s*<\/center>\s*)+$/, '');
    
    return cleaned.trim();
  };
  
  // Function to get a clean title for Gmail newsletters
  const getCleanTitle = (): string => {
    if (!isGmailNewsletter) return safeStringify(displayEvent.title);
    
    // For Gmail newsletters, extract the actual newsletter name from the subject
    // e.g., "Fwd: 11.16.25 BLUE CREW REVIEW" -> "Blue Crew Review"
    const title = safeStringify(displayEvent.title);
    
    // Remove "Fwd:" prefix
    let cleaned = title.replace(/^fwd:\s*/i, '');
    
    // Remove date patterns (e.g., "11.16.25", "11-16-25", "2025-11-16")
    cleaned = cleaned.replace(/\d{1,4}[.\-\/]\d{1,2}[.\-\/]\d{1,4}\s*/gi, '');
    
    // Capitalize each word nicely
    cleaned = cleaned.split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
    
    return cleaned.trim() || 'Newsletter';
  };
  
  // Check if this is a combined event with multiple newsletter events
  const hasMultipleEvents = newsletterEvent?.multipleEvents && newsletterEvent.multipleEvents.length > 1;

  // Handle "View in Newsletter" button click for individual events
  const handleViewInNewsletterForEvent = (eventToView: NewsletterCalendarEvent) => {
    if (!eventToView?.sourceMetadata) return;

    console.log(`📰 [EventDetailModal] View in Newsletter clicked for individual event`);
    console.log(`Section: ${eventToView.sourceMetadata.sectionTitle} (index ${eventToView.sourceMetadata.sectionIndex})`);
    console.log(`Item: ${eventToView.sourceMetadata.itemTitle} (index ${eventToView.sourceMetadata.itemIndex})`);

    // Check if newsletter widget is visible
    const newsletterWidget = document.querySelector('[data-newsletter-widget]') as HTMLElement | null;
    const isNewsletterVisible = newsletterWidget && 
      newsletterWidget.offsetParent !== null && 
      newsletterWidget.getBoundingClientRect().height > 0;

    console.log(`👀 Newsletter visibility: ${isNewsletterVisible ? 'VISIBLE' : 'HIDDEN'}`);

    if (!isNewsletterVisible) {
      // Switch to Updates tab first
      console.log(`🔄 Switching to Updates tab...`);
      const switchTabEvent = new CustomEvent('switchToTab', {
        detail: { tabName: 'Updates', timestamp: Date.now() }
      });
      window.dispatchEvent(switchTabEvent);

      // Wait for tab switch, then open newsletter section
      setTimeout(() => {
        console.log(`📬 Opening newsletter section`);
        const openNewsletterEvent = new CustomEvent('openNewsletterSection', {
          detail: {
            sectionIndex: eventToView.sourceMetadata!.sectionIndex,
            itemIndex: eventToView.sourceMetadata!.itemIndex,
            sectionTitle: eventToView.sourceMetadata!.sectionTitle,
            itemTitle: eventToView.sourceMetadata!.itemTitle,
            timestamp: Date.now()
          }
        });
        window.dispatchEvent(openNewsletterEvent);
      }, 150);
    } else {
      // Newsletter already visible
      console.log(`✅ Opening newsletter section directly`);
      const openNewsletterEvent = new CustomEvent('openNewsletterSection', {
        detail: {
          sectionIndex: eventToView.sourceMetadata.sectionIndex,
          itemIndex: eventToView.sourceMetadata.itemIndex,
          sectionTitle: eventToView.sourceMetadata.sectionTitle,
          itemTitle: eventToView.sourceMetadata.itemTitle,
          timestamp: Date.now()
        }
      });
      window.dispatchEvent(openNewsletterEvent);
    }

    // Trigger glow effect on the date cell
    if (onTriggerGlow) {
      onTriggerGlow(new Date(eventToView.start));
    }

    // Close the modal after triggering navigation
    onClose();
  };

  // Handle "View in Newsletter" button click (for single events or combined fallback)
  const handleViewInNewsletter = () => {
    if (!newsletterEvent?.sourceMetadata) return;

    console.log(`📰 [EventDetailModal] View in Newsletter clicked`);
    console.log(`Section: ${newsletterEvent.sourceMetadata.sectionTitle} (index ${newsletterEvent.sourceMetadata.sectionIndex})`);
    console.log(`Item: ${newsletterEvent.sourceMetadata.itemTitle} (index ${newsletterEvent.sourceMetadata.itemIndex})`);

    // Check if newsletter widget is visible
    const newsletterWidget = document.querySelector('[data-newsletter-widget]') as HTMLElement | null;
    const isNewsletterVisible = newsletterWidget && 
      newsletterWidget.offsetParent !== null && 
      newsletterWidget.getBoundingClientRect().height > 0;

    console.log(`👀 Newsletter visibility: ${isNewsletterVisible ? 'VISIBLE' : 'HIDDEN'}`);

    if (!isNewsletterVisible) {
      // Switch to Updates tab first
      console.log(`🔄 Switching to Updates tab...`);
      const switchTabEvent = new CustomEvent('switchToTab', {
        detail: { tabName: 'Updates', timestamp: Date.now() }
      });
      window.dispatchEvent(switchTabEvent);

      // Wait for tab switch, then open newsletter section
      setTimeout(() => {
        console.log(`📬 Opening newsletter section`);
        const openNewsletterEvent = new CustomEvent('openNewsletterSection', {
          detail: {
            sectionIndex: newsletterEvent.sourceMetadata!.sectionIndex,
            itemIndex: newsletterEvent.sourceMetadata!.itemIndex,
            sectionTitle: newsletterEvent.sourceMetadata!.sectionTitle,
            itemTitle: newsletterEvent.sourceMetadata!.itemTitle,
            timestamp: Date.now()
          }
        });
        window.dispatchEvent(openNewsletterEvent);
      }, 150);
    } else {
      // Newsletter already visible
      console.log(`✅ Opening newsletter section directly`);
      const openNewsletterEvent = new CustomEvent('openNewsletterSection', {
        detail: {
          sectionIndex: newsletterEvent.sourceMetadata.sectionIndex,
          itemIndex: newsletterEvent.sourceMetadata.itemIndex,
          sectionTitle: newsletterEvent.sourceMetadata.sectionTitle,
          itemTitle: newsletterEvent.sourceMetadata.itemTitle,
          timestamp: Date.now()
        }
      });
      window.dispatchEvent(openNewsletterEvent);
    }

    // Trigger glow effect on the date cell
    if (onTriggerGlow) {
      onTriggerGlow(new Date(newsletterEvent.start));
    }

    // Close the modal after triggering navigation
    onClose();
  };

  // Close modal on escape key, navigate with arrow keys
  useEffect(() => {
    const handleKeyboard = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowRight' && hasNext && onNext) {
        onNext();
      } else if (e.key === 'ArrowLeft' && hasPrevious && onPrevious) {
        onPrevious();
      }
    };

    if (event) {
      document.addEventListener('keydown', handleKeyboard);
      // Prevent body scroll when modal is open
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleKeyboard);
      document.body.style.overflow = 'unset';
    };
  }, [event, onClose, hasNext, hasPrevious, onNext, onPrevious]);

  // Auto-focus modal when opened (no scrollIntoView needed - modal is fixed position and centered via flexbox)
  useEffect(() => {
    if (event && modalRef.current) {
      // Focus the modal for accessibility and keyboard navigation
      modalRef.current.focus();
      
      // Scroll page to top to ensure modal appears centered (optional, remove if not desired)
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [event]);

  // Close modal when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    if (event) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [event, onClose]);

  if (!event) return null;

  // Prioritize showing the actual event data from ICS files
  // Only use originalEvent if it has more content than the base event
  // IMPORTANT: Prefer the URL from ICS file (originalEvent.url) as it's authoritative
  // The ICS files contain verified course URLs, generated URLs may be stale
  let displayEvent: CalendarEvent;
  
  if (originalEvent && originalEvent.description && originalEvent.description.length > (event.description?.length || 0)) {
    // Use rich ICS content and PREFER the ICS URL (originalEvent.url) as authoritative
    displayEvent = {
      ...originalEvent,
      url: originalEvent.url || event.url, // Prefer ICS URL over generated URL
    };
  } else {
    // Use the event, but prefer ICS URL if available
    displayEvent = {
      ...event,
      url: originalEvent?.url || event.url, // Prefer ICS URL if originalEvent exists
    };
  }
  
  const start = new Date(displayEvent.start);
  const end = displayEvent.end ? new Date(displayEvent.end) : undefined;

  const formatDateTime = () => {
    if (displayEvent.allDay) {
      return format(start, 'EEEE, MMMM d, yyyy');
    } else {
      return end
        ? `${format(start, 'EEEE, MMMM d, yyyy · h:mma')} – ${format(end, 'h:mma')}`
        : format(start, 'EEEE, MMMM d, yyyy · h:mma');
    }
  };

  // Function to safely convert any value to string for rendering
  const safeStringify = (value: unknown): string => {
    if (value === null || value === undefined) return '';
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    if (typeof value === 'object') {
      // For objects, try to extract meaningful text or stringify
      if (value && typeof value === 'object' && 'val' in value && typeof value.val === 'string') return value.val;
      if (value && typeof value === 'object' && 'toString' in value && typeof value.toString === 'function') {
        const str = value.toString();
        if (str !== '[object Object]') return str;
      }
      return JSON.stringify(value);
    }
    return String(value);
  };

  // Function to parse URLs from text and make them clickable
  const renderTextWithLinks = (text: unknown) => {
    const safeText = safeStringify(text);
    if (!safeText) return null;
    
    // Regular expression to find URLs
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const parts = safeText.split(urlRegex);
    
    return (
      <div className="space-y-3">
        {parts.map((part, index) => {
          if (urlRegex.test(part)) {
            return (
              <a
                key={index}
                href={part}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#FDB515] hover:text-[#FFD700] break-all inline-block"
              >
                {part}
              </a>
            );
          }
          
          // Format structured content with better styling
          const formattedPart = part.split('\n').map((line, lineIndex) => {
            // Check if line is a section header (READING:, QUIZ:, etc.)
            if (/^(READING|QUIZ|IN-CLASS EXERCISE|PREPARATION|Topic \d+):/i.test(line)) {
              // Special handling for QUIZ lines
              if (line.startsWith('QUIZ:')) {
                // Check if it's an actual quiz (not "No quiz")
                const hasActualQuiz = /QUIZ:\s*Quiz\s+\d+/i.test(line);
                if (hasActualQuiz) {
                  return (
                    <div key={`line-${index}-${lineIndex}`} className="font-bold bg-white text-red-500 mt-3 first:mt-0">
                      {line}
                    </div>
                  );
                }
                // "No quiz" - use normal styling
                return (
                  <div key={`line-${index}-${lineIndex}`} className="font-semibold text-white mt-3 first:mt-0">
                    {line}
                  </div>
                );
              }
              // Other section headers (READING, PREPARATION, etc.)
              return (
                <div key={`line-${index}-${lineIndex}`} className="font-semibold text-white mt-3 first:mt-0">
                  {line}
                </div>
              );
            }
            // Check if line is a bullet point
            if (line.trim().startsWith('•')) {
              return (
                <div key={`line-${index}-${lineIndex}`} className="ml-4 text-slate-300">
                  {line}
                </div>
              );
            }
            // Regular line
            return line.trim() ? (
              <div key={`line-${index}-${lineIndex}`} className="text-slate-300">
                {line}
              </div>
            ) : (
              <div key={`line-${index}-${lineIndex}`} className="h-2" />
            );
          });
          
          return <div key={index}>{formattedPart}</div>;
        })}
      </div>
    );
  };

  // Unified modal height for all event types
  const eventModalHeight = 'max-h-[70vh] md:max-h-[80vh]';

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4">
      <div
        ref={modalRef}
        tabIndex={-1}
        className={`backdrop-blur-3xl rounded-2xl shadow-2xl h-xl w-xl max-w-3xl md:max-w-md lg:max-w-lg overflow-hidden flex flex-col outline-none ${eventModalHeight} [&]:relative [&]:shadow-[0_0_0_1px_rgba(139,92,246,0.3),0_0_18px_4px_rgba(139,92,246,0.25)] [&]:transition-shadow ${
          isGmailNewsletter 
            ? 'bg-gradient-to-br from-violet-950/20 to-slate-950/20' 
            : 'bg-slate-900/60'
        }`}
      >
        {/* Navigation and Close Buttons - Top Row */}
        <div className="flex items-center justify-end px-4 pt-2 pb-1 flex-shrink-0">
          <div className="flex items-center gap-1">
            {/* Previous Button */}
            <button
              onClick={onPrevious}
              disabled={!hasPrevious}
              className={`p-1.5 rounded-lg transition-colors ${
                hasPrevious 
                  ? isGmailNewsletter 
                    ? 'hover:bg-violet-700/30 text-slate-200' 
                    : 'hover:bg-slate-700 text-slate-300'
                  : isGmailNewsletter
                    ? 'text-slate-500 cursor-not-allowed'
                    : 'text-slate-600 cursor-not-allowed'
              }`}
              aria-label="Previous event"
              title="Previous event (←)"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            
            {/* Next Button */}
            <button
              onClick={onNext}
              disabled={!hasNext}
              className={`p-1.5 rounded-lg transition-colors ${
                hasNext 
                  ? isGmailNewsletter 
                    ? 'hover:bg-violet-700/30 text-slate-200' 
                    : 'hover:bg-slate-700 text-slate-300'
                  : isGmailNewsletter
                    ? 'text-slate-500 cursor-not-allowed'
                    : 'text-slate-600 cursor-not-allowed'
              }`}
              aria-label="Next event"
              title="Next event (→)"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
            
            {/* Close Button */}
            <button
              onClick={onClose}
              className={`p-1.5 rounded-lg transition-colors ml-1 ${
                isGmailNewsletter 
                  ? 'hover:bg-violet-700/30' 
                  : 'hover:bg-slate-700'
              }`}
              aria-label="Close"
              title="Close (Esc)"
            >
              <svg className={`w-5 h-5 ${
                isGmailNewsletter ? 'text-slate-200' : 'text-slate-400'
              }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Header - Title and Date */}
        {!isGmailNewsletter && (
          <div className="px-6 pb-4 flex-shrink-0">
            <h2 className="text-xl font-semibold leading-tight text-white">
              {getCleanTitle()}
            </h2>
            <p className="text-sm mt-1 text-slate-200">
              {formatDateTime()}
            </p>
          </div>
        )}

        {/* Content */}
        <div className="px-6 overflow-y-auto flex-1 scrollbar-thin scrollbar-thumb-slate-600 scrollbar-track-transparent hover:scrollbar-thumb-slate-500"
          style={{
            scrollbarWidth: 'thin',
            scrollbarColor: 'rgb(148 163 184) transparent'
          }}
        >
          {/* Multiple Newsletter Events - Single Column Layout */}
          {hasMultipleEvents && newsletterEvent?.multipleEvents ? (
            <div className="space-y-2 mb-10">
              
              
              <div className="flex flex-col gap-4">
                {newsletterEvent.multipleEvents.slice(0, 2).map((individualEvent: NewsletterCalendarEvent, index: number) => (
                  <div key={index} className="bg-slate-900/40 backdrop-blur-sm rounded-lg p-4 border border-violet-500/30 shadow-[0_0_12px_2px_rgba(139,92,246,0.15)]">
                    {/* Individual Event Header */}
                    <div className="mb-3">
                      <h4 className="text-md font-semibold text-white leading-tight mb-2">
                        {safeStringify(individualEvent.title)}
                      </h4>
                      <div className="text-xs text-violet-300/80 mb-3">
                        From: {individualEvent.sourceMetadata?.sectionTitle || 'Newsletter'}
                      </div>
                    </div>

                    {/* Individual Event Content */}
                    <div className="space-y-3 mb-4">
                      
                      {individualEvent.htmlContent && (
                        <div className="text-sm text-slate-300 leading-relaxed line-clamp-5">
                          <div dangerouslySetInnerHTML={{ __html: individualEvent.htmlContent }} />
                        </div>
                      )}
                    </div>

                    {/* Individual Event Button */}
                    {individualEvent.sourceMetadata && (
                      <button
                        onClick={() => handleViewInNewsletterForEvent(individualEvent)}
                        className="w-full bg-purple-600/20 backdrop-blur-xl hover:bg-purple-500/40 text-white text-xs font-medium py-2 px-3 rounded-md transition-all duration-300 text-center flex items-center justify-center gap-2 shadow-[0_0_0_1px_rgba(168,85,247,0.3),0_0_18px_4px_rgba(168,85,247,0.25)] hover:shadow-[0_0_0_1px_rgba(168,85,247,0.6),0_0_25px_8px_rgba(168,85,247,0.4)] hover:scale-[1.02]"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
                        </svg>
                        View in Newsletter
                      </button>
                    )}
                  </div>
                ))}
              </div>
              
              {/* Show overflow events in additional rows if more than 2 */}
              {newsletterEvent.multipleEvents.length > 2 && (
                <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${Math.min(newsletterEvent.multipleEvents.length - 2, 2)}, 1fr)` }}>
                  {newsletterEvent.multipleEvents.slice(2).map((individualEvent: NewsletterCalendarEvent, index: number) => (
                    <div key={index + 2} className="bg-slate-900/40 backdrop-blur-sm rounded-lg p-4 border border-violet-500/30 shadow-[0_0_12px_2px_rgba(139,92,246,0.15)]">
                      {/* Individual Event Header */}
                      <div className="mb-3">
                        <h4 className="text-md font-semibold text-white leading-tight mb-2">
                          {safeStringify(individualEvent.title)}
                        </h4>
                        <div className="text-xs text-violet-300/80 mb-1">
                          From: {individualEvent.sourceMetadata?.sectionTitle || 'Newsletter'}
                        </div>
                      </div>

                      {/* Individual Event Content */}
                      <div className="space-y-3 mb-4">
                        {individualEvent.description && (
                          <div className="text-sm text-slate-300 leading-relaxed">
                            {renderTextWithLinks(individualEvent.description)}
                          </div>
                        )}
                        
                        {individualEvent.htmlContent && (
                          <div className={`text-sm leading-relaxed prose max-w-none ${
                            isGmailNewsletter 
                              ? 'prose-slate' 
                              : 'prose-invert text-slate-300'
                          }`}>
                            <div dangerouslySetInnerHTML={{ __html: individualEvent.htmlContent }} />
                          </div>
                        )}
                      </div>

                      {/* Individual Event Button */}
                      {individualEvent.sourceMetadata && (
                        <button
                          onClick={() => handleViewInNewsletterForEvent(individualEvent)}
                          className="w-full bg-purple-600/20 backdrop-blur-xl hover:bg-purple-500/40 text-white text-xs font-medium py-2 px-3 rounded-md transition-all duration-300 text-center flex items-center justify-center gap-2 shadow-[0_0_0_1px_rgba(168,85,247,0.3),0_0_18px_4px_rgba(168,85,247,0.25)] hover:shadow-[0_0_0_1px_rgba(168,85,247,0.6),0_0_25px_8px_rgba(168,85,247,0.4)] hover:scale-[1.02]"
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
                          </svg>
                          View in Newsletter
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            /* Single Event - Original Layout */
            <div className="space-y-4">
              {/* Newsletter htmlContent - Show full content for newsletter events */}
              {isNewsletterEvent && newsletterEvent?.htmlContent ? (
                <div>
                  <div className={`gmail-newsletter-content ${
                    isGmailNewsletter 
                      ? '' 
                      : 'text-slate-300'
                  }`}>
                    <div dangerouslySetInnerHTML={{ __html: cleanGmailNewsletterHTML(newsletterEvent.htmlContent) }} />
                  </div>
                </div>
              ) : (
                <>
                  {/* Description for non-newsletter events */}
                  {displayEvent.description && (
                    <div>
                      <h3 className={`text-xl font-medium mb-2 ${
                        isGmailNewsletter ? 'text-slate-900' : 'text-white'
                      }`}></h3>
                      <div className={`text-md whitespace-pre-wrap leading-relaxed ${
                        isGmailNewsletter ? 'text-slate-700' : 'text-slate-300'
                      }`}>
                        {renderTextWithLinks(displayEvent.description)}
                      </div>
                    </div>
                  )}

                  {/* Location */}
                  {displayEvent.location && (
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <div className={`text-sm font-medium ${
                          isGmailNewsletter ? 'text-slate-900' : 'text-white'
                        }`}>📍 Location:</div>
                        <div className={`text-sm ${
                          isGmailNewsletter ? 'text-slate-700' : 'text-slate-300'
                        }`}>{safeStringify(displayEvent.location)}</div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {/* Footer with action buttons - hidden for multiple newsletter events */}
        {!hasMultipleEvents && (
          <div className="flex gap-2 p-4  border-slate-700 flex-shrink-0">
            {/* Newsletter Event: View in Newsletter Button */}
            {isNewsletterEvent && newsletterEvent?.sourceMetadata && (
              <button
                onClick={handleViewInNewsletter}
                className="flex-1 bg-purple-600/20 backdrop-blur-xl hover:bg-purple-500/40 text-white text-sm font-medium py-2 px-4 rounded-lg transition-all duration-300 text-center flex items-center justify-center gap-2 shadow-[0_0_0_1px_rgba(168,85,247,0.3),0_0_18px_4px_rgba(168,85,247,0.25)] hover:shadow-[0_0_0_1px_rgba(168,85,247,0.6),0_0_25px_8px_rgba(168,85,247,0.4)] hover:scale-[1.02]"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
                </svg>
                View in Newsletter
              </button>
            )}
            
            {/* Regular Event: Open Class Page Button */}
            {!isNewsletterEvent && displayEvent.url && (
              <a
                href={displayEvent.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 bg-[#003262]/10 backdrop-blur-xl hover:bg-[#CC9500]/60 text-white text-sm font-medium py-2 px-4 rounded-lg transition-all duration-300 text-center flex items-center justify-center gap-2 shadow-[0_0_0_1px_rgba(255,255,255,0.2),0_0_18px_4px_rgba(255,255,255,0.25)] hover:shadow-[0_0_0_1px_rgba(255,255,255,0.6),0_0_25px_8px_rgba(255,255,255,0.4)] hover:scale-[1.02]"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
                Open Class Page
              </a>
            )}
            
            
          </div>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// MULTI-EVENT MODAL - Shows list of events when clicking a day with 2+ events
// =============================================================================

type MultiEventModalProps = {
  isOpen: boolean;
  events: CalendarEvent[];
  date: Date | null;
  onClose: () => void;
  onSelectEvent: (event: CalendarEvent) => void;
};

export function MultiEventModal({ isOpen, events, date, onClose, onSelectEvent }: MultiEventModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);

  // Close modal on escape key
  useEffect(() => {
    const handleKeyboard = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyboard);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleKeyboard);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  // Close modal when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  if (!isOpen || !date) return null;

  // Determine event color based on source
  const getEventColor = (event: CalendarEvent) => {
    if (event.source?.includes('newsletter')) return 'bg-purple-600/30 hover:bg-purple-600/50';
    if (event.source?.includes('uc_launch')) return 'bg-orange-600/30 hover:bg-orange-600/50';
    if (event.source?.includes('campus_groups')) return 'bg-blue-600/30 hover:bg-blue-600/50';
    if (event.source?.includes('cal_bears')) return 'bg-blue-800/30 hover:bg-blue-800/50';
    if (event.source?.includes('haas_academic')) return 'bg-amber-600/30 hover:bg-amber-600/50';
    if (event.source?.includes('201a_micro')) return 'bg-green-800/30 hover:bg-green-800/50';
    if (event.source?.includes('201b_macro')) return 'bg-blue-900/30 hover:bg-blue-900/50';
    if (event.source?.includes('202_')) return 'bg-teal-700/30 hover:bg-teal-700/50';
    if (event.source?.includes('205_')) return 'bg-red-800/30 hover:bg-red-800/50';
    if (event.source?.includes('206_')) return 'bg-sky-700/30 hover:bg-sky-700/50';
    return 'bg-slate-700/30 hover:bg-slate-700/50';
  };

  // Get event type label
  const getEventType = (event: CalendarEvent) => {
    if (event.source?.includes('newsletter')) return '📰 Newsletter';
    if (event.source?.includes('uc_launch')) return '🚀 UC Launch';
    if (event.source?.includes('campus_groups')) return '👥 Campus Groups';
    if (event.source?.includes('cal_bears')) return '🐻 Cal Bears';
    if (event.source?.includes('haas_academic')) return '📅 Academic';
    return '📚 Course';
  };

  // Unified modal sizing (same as EventDetailModal)
  const eventModalHeight = 'max-h-[70vh] md:max-h-[80vh]';

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4">
      <div
        ref={modalRef}
        className={`backdrop-blur-3xl bg-slate-900/60 rounded-2xl shadow-[0_0_0_1px_rgba(139,92,246,0.3),0_0_18px_4px_rgba(139,92,246,0.25)] h-xl w-xl max-w-3xl md:max-w-md lg:max-w-lg ${eventModalHeight} overflow-hidden flex flex-col`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-white">
              Events on {format(date, 'EEEE, MMMM d, yyyy')}
            </h2>
            <p className="text-sm text-slate-400 mt-0.5">
              {events.length} events • Click to view details
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-slate-700 transition-colors"
            aria-label="Close"
          >
            <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Event List */}
        <div className="px-6 py-4 overflow-y-auto flex-1">
          <div className="flex flex-col gap-3">
            {events.map((event, index) => (
              <button
                key={event.uid || `${event.title}-${index}`}
                onClick={() => onSelectEvent(event)}
                className={`text-left p-4 rounded-xl ${getEventColor(event)} transition-all duration-200 cursor-pointer hover:scale-[1.02] hover:shadow-lg`}
              >
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-slate-400 mb-1">{getEventType(event)}</div>
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
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
