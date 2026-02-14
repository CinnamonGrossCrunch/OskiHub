// ============================================================================
// NEWSLETTER WIDGET COMPONENT
// ============================================================================
// 
// This component displays the Bear Necessities newsletter in an interactive
// accordion-style layout with progress tracking and completion animations.
//
// COLOR SCHEME (for uniform changes):
// - Top-level sections: bg-slate-600 (button), hover:bg-slate-500
// - Subsection items: bg-slate-700, border-slate-600
// - Nested content: bg-slate-800, border-slate-600
// - Main container: bg-slate-800
// - Text colors: text-slate-200 (headings), text-slate-300 (content), text-slate-400 (secondary)
// - Indicators: Unread = green pulse, Read = violet static
// - Accents: text-yellow-400 (berkeley gold) on hover
//
// MAIN SECTIONS:
// 1. Type Definitions - TypeScript interfaces for component props
// 2. State Management - React state for UI interactions and animations
// 3. Effects - Initialization and animation triggers
// 4. Helper Functions - Subsection creation and content processing
// 5. Animation & Progress - Cascade animations and completion tracking
// 6. Utility Functions - Testing and debugging helpers
// 7. Content Formatting - HTML processing and smart bullet rendering
// 8. JSX Render - Main component UI (Header, Content, Footer)
//
// KEY FEATURES:
// - Collapsible sections with automatic scrolling
// - Read/unread tracking for all subsections
// - Completion animations (Lottie) when all sections are read
// - Smart HTML processing with bullet points and link styling
// - Responsive design with dark mode support
//
// ============================================================================

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Lottie from 'lottie-react';
import { trackEvent } from '@/lib/analytics';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

type Item = { title: string; html: string };
type Section = { sectionTitle: string; items: Item[] };
type Payload = { 
  sourceUrl: string; 
  title?: string; 
  sections: Section[]; 
  aiDebugInfo?: {
    reasoning: string;
    sectionDecisions: string[];
    edgeCasesHandled: string[];
    totalSections: number;
    processingTime: number;
  };
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function NewsletterWidget({ data }: { data: Payload }) {
  
  // ==========================================================================
  // COLOR SCHEME - CENTRALIZED CONFIGURATION
  // ==========================================================================
  // Change colors here to update the entire newsletter widget uniformly
  
  const COLORS = {
    // Header & Footer
    headerBg: 'bg-slate-800/70',         // Header background
    footerBg: 'bg-slate-800/70',         // Footer background
    
    // Section backgrounds (3-tier hierarchy)
    sectionBg: 'bg-slate-800/70',           // Top-level section buttons
    sectionBgHover: 'hover:bg-blue-500/30',
    subsectionBg: 'bg-slate-700/60',        // Subsection items
    contentBg: 'bg-slate-800',           // Nested content area
    containerBg: 'bg-slate-0',         // Main container
    
    // Borders
    border: 'border-slate-800',
    borderColor: 'slate-800',
    
    // Text colors
    textPrimary: 'text-slate-200',       // Section/subsection titles
    textContent: 'text-slate-300',       // Main content text
    textSecondary: 'text-slate-400',     // Secondary text
    textHoverWhite: 'group-hover:text-white',
    textHoverGold: 'group-hover:text-yellow-400',
    
    // Indicators (read/unread dots)
    unreadDot: 'bg-green-400 border-red-500 shadow-green-500/30 animate-pulse',
    readDot: 'bg-violet-500/50 border-violet-300 shadow-violet-400/40',
    
    // Accents
    gold: 'text-yellow-400',             // Berkeley gold
  };
  
  // ==========================================================================
  // STATE MANAGEMENT
  // ==========================================================================
  
  // Initialize all sections as open by default
  const [open, setOpen] = useState<Record<string, boolean>>(() => {
    const initialOpen: Record<string, boolean> = {};
    data.sections.forEach((_, idx) => {
      initialOpen[`${idx}-${data.sections[idx].sectionTitle}`] = false;
    });
    return initialOpen;
  });
  const [itemVisited, setItemVisited] = useState<Set<string>>(new Set());
  const [itemOpen, setItemOpen] = useState<Record<string, boolean>>({});
  const [showCaughtUpText, setShowCaughtUpText] = useState(false);
  const [animationData, setAnimationData] = useState<object | null>(null);
  
  // New states for cascade animation
  const [sectionScaleStates, setSectionScaleStates] = useState<Record<number, boolean>>({});
  const [cascadeComplete, setCascadeComplete] = useState(false);
  const [triggerTopLevelAnimation, setTriggerTopLevelAnimation] = useState(false);
  
  // State for newsletter date overlay
  const [showDateOverlay, setShowDateOverlay] = useState(true);

  // ==========================================================================
  // EFFECTS - INITIALIZATION & ANIMATION
  // ==========================================================================

  // Load animation data dynamically
  useEffect(() => {
    fetch('/Gross-Haas-Click.json')
      .then(response => response.json())
      .then(data => setAnimationData(data))
      .catch(error => console.error('Failed to load animation:', error));
  }, []);

  // Initialize all subsections as open by default
  useEffect(() => {
    const initialItemOpen: Record<string, boolean> = {};
    data.sections.forEach((section, sectionIdx) => {
      const subsections = createSubsections(section.items);
      subsections.forEach((_, subIdx) => {
        const itemId = `${sectionIdx}-${section.sectionTitle}-item-${subIdx}`;
        initialItemOpen[itemId] = false;
      });
    });
    setItemOpen(initialItemOpen);
  }, [data.sections]);

  // ==========================================================================
  // EVENT LISTENER - NEWSLETTER SOURCE TRACING
  // ==========================================================================
  
  // Listen for events from My Week Widget to open specific newsletter sections
  useEffect(() => {
    const handleOpenNewsletterSection = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      console.log(`📬 Newsletter: Opening section ${detail.sectionIndex} (${detail.sectionTitle}), item with title "${detail.itemTitle}"`);
      
      // Build the section key (format: "index-sectionTitle")
      const sectionKey = `${detail.sectionIndex}-${detail.sectionTitle}`;
      
      // Step 1: Expand the section (close all other sections - auto-collapse behavior)
      const newOpen: Record<string, boolean> = {};
      newOpen[sectionKey] = true;
      setOpen(newOpen);
      console.log(`📂 Expanded section: ${sectionKey}`);
      
      // Step 2: Find which subsection matches the item title
      const section = data.sections[detail.sectionIndex];
      if (!section) {
        console.log(`❌ Section ${detail.sectionIndex} not found`);
        return;
      }
      
      const subsections = createSubsections(section.items);
      const matchingSubsectionIndex = subsections.findIndex(
        sub => sub.title === detail.itemTitle || sub.title.includes(detail.itemTitle)
      );
      
      if (matchingSubsectionIndex === -1) {
        console.log(`❌ Could not find subsection with title: ${detail.itemTitle}`);
        console.log(`Available subsections:`, subsections.map(s => s.title));
        return;
      }
      
      console.log(`✅ Found matching subsection at index ${matchingSubsectionIndex}`);
      
      // Step 3: Build the subsection item ID and expand it (close all other items - auto-collapse)
      const itemId = `${sectionKey}-item-${matchingSubsectionIndex}`;
      const newItemOpen: Record<string, boolean> = {};
      newItemOpen[itemId] = true;
      setItemOpen(newItemOpen);
      console.log(`📄 Expanded subsection: ${itemId}`);
      
      // Mark as visited
      const itemKey = `${detail.sectionIndex}-${matchingSubsectionIndex}`;
      setItemVisited(prev => new Set([...prev, itemKey]));
      
      // Step 4: Wait for animations to complete, then add highlight (no scrolling)
      setTimeout(() => {
        const itemElement = document.querySelector(
          `[data-newsletter-section="${detail.sectionIndex}"] [data-item-title="${detail.itemTitle}"]`
        );
        
        if (itemElement) {
          console.log(`✨ Found newsletter item, adding highlight animation (no scroll)`);
          
          // Add highlight animation without scrolling
          itemElement.classList.add('newsletter-item-highlight');
          setTimeout(() => {
            itemElement.classList.remove('newsletter-item-highlight');
          }, 2000);
        } else {
          console.log(`❌ Could not find item element for highlighting`);
        }
      }, 400); // Wait time for both section and subsection expansion
    };
    
    window.addEventListener('openNewsletterSection', handleOpenNewsletterSection);
    return () => window.removeEventListener('openNewsletterSection', handleOpenNewsletterSection);
  }, [data.sections]); // Add dependency on data.sections for createSubsections

  // ==========================================================================
  // HELPER FUNCTIONS - SUBSECTION CREATION & CONTENT PROCESSING
  // ==========================================================================

  // Function to split items by <strong> tags to create subsections
  const createSubsections = (items: Item[]) => {
    const subsections: { title: string; content: string }[] = [];
    
    items.forEach(item => {
      // Skip empty or very short items
      if (!item.html || item.html.trim().length < 10) {
        return;
      }

      // Check if this item contains <strong> tags for subsections (ignore empty or whitespace-only strong tags)
      // Updated regex to be more selective about what constitutes a header
      const strongMatches = item.html.match(/<strong>\s*[^\s<][^<]*[^\s<]\s*<\/strong>/g);
      
      if (strongMatches && strongMatches.length > 0) {
        // Filter out strong tags that don't look like headers
        const validHeaders = strongMatches.filter(match => {
          const text = match.replace(/<\/?strong>/g, '').trim();
          
          // Ignore if it's just dates in parentheses like "(9/6, 9/13, 10/4, 11/1)"
          if (/^\([0-9\/,\s]+\)$/.test(text)) {
            return false;
          }
          
          // Ignore if it's just numbers or dates without meaningful text
          if (/^[\d\/,\s\-]+$/.test(text)) {
            return false;
          }
          
          // Ignore very short text that doesn't end with colon (likely not a header)
          if (text.length < 8 && !text.endsWith(':')) {
            return false;
          }
          
          // Accept if it ends with colon (likely a header) or is reasonably long
          return text.endsWith(':') || text.length >= 10;
        });
        
        if (validHeaders.length > 0) {
          // Split content by valid <strong> tags only
          const sections = item.html.split(/(<strong>\s*[^\s<][^<]*[^\s<]\s*<\/strong>)/);
          
          let currentTitle = '';
          let currentContent = '';
          let hasPreContent = false;
          
          for (let i = 0; i < sections.length; i++) {
            const section = sections[i].trim();
            
            if (section.match(/<strong>\s*[^\s<][^<]*[^\s<]\s*<\/strong>/)) {
              const strongText = section.replace(/<\/?strong>/g, '').trim();
              
              // Only treat as header if it passes our validation
              const isValidHeader = validHeaders.some(header => 
                header.replace(/<\/?strong>/g, '').trim() === strongText
              );
              
              if (isValidHeader) {
                // If we have accumulated content, save the previous subsection
                if (currentTitle && currentContent.trim()) {
                  subsections.push({ 
                    title: currentTitle, 
                    content: currentContent.trim()
                  });
                }
                // Start new subsection
                currentTitle = strongText;
                currentContent = '';
              } else {
                // Treat as regular content, not a header
                currentContent += section;
              }
            } else if (section.trim()) {
              // If this is content before the first <strong> tag and we don't have a title yet
              if (!currentTitle && section.trim() && !hasPreContent) {
                // Use item title for content that appears before any <strong> tags
                subsections.push({
                  title: item.title,
                  content: section.trim()
                });
                hasPreContent = true;
              } else {
                // Accumulate content for current subsection
                currentContent += section;
              }
            }
          }
        
        // Don't forget the last subsection - make sure we capture all remaining content
        if (currentTitle) {
          // Even if currentContent is empty, include the title as a subsection
          subsections.push({ 
            title: currentTitle, 
            content: currentContent.trim() || `<p class="text-xs text-slate-500 italic">Details available in the original newsletter.</p>`
          });
        }
        
        // If no subsections were created but we had strong matches, add the whole item
        if (subsections.length === 0) {
          subsections.push({
            title: item.title,
            content: item.html
          });
        }
      } else {
        // No valid headers found, treat as single item
        subsections.push({
          title: item.title,
          content: item.html
        });
      }
    } else {
        // If no <strong> tags found, treat entire item as one subsection
        // But check if the content is meaningful
        const cleanContent = item.html.replace(/<[^>]*>/g, '').trim();
        if (cleanContent.length > 5) { // Only include if there's actual text content
          subsections.push({
            title: item.title,
            content: item.html
          });
        } else if (item.title && item.title.trim().length > 0) {
          // If there's a meaningful title but no content, create a placeholder with the title
          subsections.push({
            title: item.title,
            content: `<p>${item.title}</p><p class="text-xs text-slate-500 italic">Event details available in the original newsletter.</p>`
          });
        }
      }
    });
    
    // Remove duplicates based on title similarity
    const uniqueSubsections: { title: string; content: string }[] = [];
    const seenTitles = new Set<string>();
    
    for (const subsection of subsections) {
      const normalizedTitle = subsection.title.toLowerCase().replace(/[^\w\s]/g, '').trim();
      if (!seenTitles.has(normalizedTitle) && normalizedTitle.length > 0) {
        seenTitles.add(normalizedTitle);
        uniqueSubsections.push(subsection);
      }
    }
    
    return uniqueSubsections;
  };

  // ==========================================================================
  // DATE EXTRACTION HELPER
  // ==========================================================================
  
  // Extract and format date from newsletter title
  // Expected formats: "[EWMBA] Bear Necessities MM-DD-YYYY" or "[EWMBA] Bear Necessities M-D-YY"
  const getNewsletterDate = (): string => {
    if (!data.title) return '';
    
    // Extract date pattern MM-DD-YYYY or MM/DD/YYYY (4-digit year)
    const dateMatch4Digit = data.title.match(/(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
    if (dateMatch4Digit) {
      const [, month, day] = dateMatch4Digit;
      return `${month.padStart(2, '0')}/${day.padStart(2, '0')}`;
    }
    
    // Extract date pattern M-D-YY or MM-DD-YY (2-digit year)
    const dateMatch2Digit = data.title.match(/(\d{1,2})[-/](\d{1,2})[-/](\d{2})(?!\d)/);
    if (dateMatch2Digit) {
      const [, month, day] = dateMatch2Digit;
      return `${month.padStart(2, '0')}/${day.padStart(2, '0')}`;
    }
    
    return '';
  };

  // ==========================================================================
  // ANIMATION & PROGRESS TRACKING
  // ==========================================================================

  // Check if all items in a section have been visited
  // Trigger cascade animation sequence when a section completes
  const triggerCascadeAnimation = useCallback(() => {
    if (cascadeComplete) return; // Prevent multiple triggers
    
    console.log('Cascade animation triggered!');
    
    // Get all completed sections
    const completedSections: number[] = [];
    data.sections.forEach((_, index) => {
      const section = data.sections[index];
      const totalSubsections = createSubsections(section.items).length;
      let visitedSubsections = 0;
      createSubsections(section.items).forEach((_, subIdx) => {
        if (itemVisited.has(`${index}-${subIdx}`)) {
          visitedSubsections++;
        }
      });
      if (visitedSubsections === totalSubsections) {
        completedSections.push(index);
      }
    });
    
    console.log('Completed sections:', completedSections);
    
    // Start cascade from bottom section (highest index) to top
    const sortedSections = [...completedSections].sort((a, b) => b - a);
    
    sortedSections.forEach((sectionIndex, cascadeIndex) => {
      setTimeout(() => {
        console.log(`Scaling section ${sectionIndex} at cascade index ${cascadeIndex}`);
        setSectionScaleStates(prev => ({
          ...prev,
          [sectionIndex]: true
        }));
        
        // After 400ms, scale back down
        setTimeout(() => {
          setSectionScaleStates(prev => ({
            ...prev,
            [sectionIndex]: false
          }));
        }, 400);
        
        // If this is the last section in cascade, trigger top-level animation
        if (cascadeIndex === sortedSections.length - 1) {
          setTimeout(() => {
            console.log('Cascade complete, triggering top-level animation');
            setCascadeComplete(true);
            setTriggerTopLevelAnimation(true);
          }, 400); // After scale-down completes
        }
      }, cascadeIndex * 100); // 100ms delay between sections
    });
  }, [cascadeComplete, data.sections, itemVisited, setSectionScaleStates, setCascadeComplete, setTriggerTopLevelAnimation]);

  const allItemsInSectionVisited = (sectionIndex: number) => {
    const section = data.sections[sectionIndex];
    // Count actual subsections for this section
    const totalSubsections = createSubsections(section.items).length;
    
    // Count visited subsections  
    let visitedSubsections = 0;
    createSubsections(section.items).forEach((_, subIdx) => {
      if (itemVisited.has(`${sectionIndex}-${subIdx}`)) {
        visitedSubsections++;
      }
    });
    
    const allVisited = visitedSubsections === totalSubsections;
    
    return allVisited;
  };

  // Calculate progress metrics - only count sections as "read" when ALL subsections are visited
  const unopenedSectionsCount = data.sections.filter((_, index) => !allItemsInSectionVisited(index)).length;

  // ==========================================================================
  // UTILITY FUNCTIONS - TESTING & DEBUGGING
  // ==========================================================================

  // Functions to mark all subsections as read/unread (for testing)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const markAllAsRead = () => {
    const allItemKeys = new Set<string>();
    
    data.sections.forEach((section, sectionIndex) => {
      const subsections = createSubsections(section.items);
      subsections.forEach((_, subIndex) => {
        allItemKeys.add(`${sectionIndex}-${subIndex}`);
      });
    });
    
    console.log('Marking all items as read:', allItemKeys);
    setItemVisited(allItemKeys);
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const markAllAsUnread = () => {
    console.log('Marking all items as unread and resetting states');
    setItemVisited(new Set());
    setItemOpen({});
    setOpen({});
    setSectionScaleStates({});
    setCascadeComplete(false);
    setTriggerTopLevelAnimation(false);
    setShowCaughtUpText(false);
  };

  // Trigger cascade animation when ALL sections are completed
  useEffect(() => {
    console.log('Checking for cascade trigger, unopened sections:', unopenedSectionsCount, 'cascade complete:', cascadeComplete);
    if (unopenedSectionsCount === 0 && !cascadeComplete && data.sections.length > 0) {
      console.log('All sections complete, starting 2-second delay before cascade');
      // Add 2-second delay before starting cascade
      setTimeout(() => {
        console.log('2-second delay complete, triggering cascade');
        triggerCascadeAnimation();
      }, 2000);
    }
  }, [unopenedSectionsCount, cascadeComplete, data.sections.length, triggerCascadeAnimation]);

  // Handle the "You're All Caught Up!" text delay - now triggered by cascade completion
  useEffect(() => {
    if (triggerTopLevelAnimation && unopenedSectionsCount === 0) {
      const timer = setTimeout(() => {
        setShowCaughtUpText(true);
      }, 500); // Shorter delay after cascade completes
      
      return () => clearTimeout(timer);
    } else {
      setShowCaughtUpText(false);
    }
  }, [triggerTopLevelAnimation, unopenedSectionsCount]);

  // ==========================================================================
  // CONTENT FORMATTING - HTML PROCESSING & SMART BULLETS
  // ==========================================================================

  // Smart bulleting function with enhanced HTML hierarchy
  const addSmartBullets = (html: string) => {
    // Skip if content is very short
    if (html.length < 50) {
      return html;
    }

    let processedHtml = html.trim();
    processedHtml = processedHtml.replace(/^(<br\s*\/?>|\s)+/, '');
    processedHtml = processedHtml.replace(/(<br\s*\/?>|\s)+$/, '');

    // --- CRITICAL: Comprehensive HTML entity decoding FIRST ---
    // Multiple passes to handle double-encoded entities
    for (let i = 0; i < 3; i++) {
      processedHtml = processedHtml
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&nbsp;/g, ' ')
        .replace(/&#x27;/g, "'")
        .replace(/&#x2F;/g, '/')
        .replace(/&#x3D;/g, '=')
        .replace(/&apos;/g, "'");
    }
    
    // Handle links with much more robust pattern matching - preserve ALL link attributes
    // But avoid double-processing already processed links
    if (!processedHtml.includes('class="text-amber-600')) {
      processedHtml = processedHtml.replace(/<a\s+([^>]*?)>([\s\S]*?)<\/a>/gi, 
        '<a $1 class="text-amber-600 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-200 underline decoration-amber-300 hover:decoration-amber-500 transition-colors !important">$2</a>');
    }
    
    // Handle standalone URLs that might not be wrapped in <a> tags
    processedHtml = processedHtml.replace(/(^|[^"'>=])(https?:\/\/[^\s<>"]+)/gi, 
      '$1<a href="$2" target="_blank" rel="noopener noreferrer" class="text-amber-600 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-200 underline decoration-amber-300 hover:decoration-amber-500 transition-colors !important">$2</a>');
    
    // Handle email links - but avoid double processing
    processedHtml = processedHtml.replace(/(^|[^"'>=])mailto:([^\s<>"]+)/gi, 
      '$1<a href="mailto:$2" class="text-amber-600 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-200 underline decoration-amber-300 hover:decoration-amber-500 transition-colors !important">$2</a>');

    // --- NEW LOGIC ---
    // 1. Extract and style any unbulleted text that appears before lists as large bold white headings
    // 2. Remove vertical bars for empty lines in bullet rendering

    // Split content into parts: text before lists, lists, text after lists
    const listPattern = /(<ul>[\s\S]*?<\/ul>|<ol>[\s\S]*?<\/ol>)/g;
    const parts = processedHtml.split(listPattern);
    
    const processedParts: string[] = [];
    
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      
      if (part.match(listPattern)) {
        // This is a list - process it normally later
        processedParts.push(part);
      } else if (part.trim()) {
        // This is text content - check if it comes before a list or is standalone
        const nextPart = parts[i + 1];
        const isBeforeList = nextPart && nextPart.match(listPattern);
        
        // Keep HTML structure for text that contains links - don't strip tags if links are present
        if (part.includes('<a ')) {
          // This part contains links - preserve HTML structure
          if (isBeforeList || i === 0) {
            // Check if it's a short title without links, or longer content with links
            const textContent = part.replace(/<[^>]*>/g, '').trim();
            const isShortTitle = textContent.length < 100 && !textContent.includes('\n') && !textContent.includes('.') && !part.includes('<a ');
            
            if (isShortTitle) {
              processedParts.push(`<div class="mb-3"><span class="block text-md urbanist-bold text-slate-900 dark:text-white">${part}</span></div>`);
            } else {
              processedParts.push(`<p class="text-sm leading-relaxed urbanist-regular text-slate-700 dark:text-slate-300 my-2">${part}</p>`);
            }
          } else {
            processedParts.push(`<p class="text-sm leading-relaxed urbanist-regular text-slate-700 dark:text-slate-300 my-2">${part}</p>`);
          }
        } else {
          // No links - process as before (strip HTML)
          const textContent = part
            .replace(/<br\s*\/?>/gi, '\n') // Convert <br> tags to newlines first
            .replace(/<[^>]*>/g, '') // Then remove all remaining HTML tags
            .trim();
          
          if (textContent && (isBeforeList || i === 0)) {
            // Only style as large heading if it's short and looks like a title (not a paragraph)
            const isShortTitle = textContent.length < 100 && !textContent.includes('\n') && !textContent.includes('.');
            
            if (isShortTitle) {
              // Style as large bold heading if it's before a list and looks like a title
              const formattedText = textContent.replace(/\n/g, '<br>');
              processedParts.push(`<div class="mb-3"><span class="block text-md urbanist-bold text-slate-900 dark:text-white">${formattedText}</span></div>`);
            } else {
              // Treat as regular paragraph content
              const formattedText = textContent.replace(/\n/g, '<br>');
              processedParts.push(`<p class="text-sm leading-relaxed urbanist-regular text-slate-700 dark:text-slate-300 my-2">${formattedText}</p>`);
            }
          } else if (textContent) {
            // Regular text content - preserve as paragraph with line breaks
            const formattedText = textContent.replace(/\n/g, '<br>');
            processedParts.push(`<p class="text-sm leading-relaxed urbanist-regular text-slate-700 dark:text-slate-300 my-2">${formattedText}</p>`);
          }
        }
      }
    }
    
    // Rejoin the processed parts
    processedHtml = processedParts.join('');

    // Process strong tags more selectively - avoid making large blocks bold
    processedHtml = processedHtml.replace(/<strong>([^<]{1,100})<\/strong>/g, 
      '<span class="urbanist-semibold text-slate-900 dark:text-white">$1</span>');

    // Handle sections: <strong>Title</strong> followed by content (lists, paragraphs)
    processedHtml = processedHtml.replace(/<strong>([^<]+)<\/strong>\s*(<ul>[\s\S]*?<\/ul>|<ol>[\s\S]*?<\/ol>|<p>[\s\S]*?<\/p>)*/g, (match, title, content) => {
      return `<div class="mb-4">
        <div class="flex items-center space-x-2 mb-3">
          <div class="flex-shrink-0">
            <div class="w-1.5 h-4 rounded-full" style="background: linear-gradient(to bottom, var(--berkeley-gold), #E5A914);"></div>
          </div>
          <h4 class="text-sm urbanist-semibold text-slate-900 dark:text-white leading-tight">${title}</h4>
        </div>
        <div class="ml-4">
          ${content || ''}
        </div>
      </div>`;
    });

    // Handle unordered lists with enhanced styling
    processedHtml = processedHtml.replace(/<ul>([\s\S]*?)<\/ul>/g, (match, content) => {
      // More aggressive empty list item filtering
      const filteredContent = content
        .replace(/<li[^>]*>\s*<\/li>/g, '') // Remove completely empty <li></li> tags
        .replace(/<li[^>]*>(\s|&nbsp;|&\w+;|\?)*<\/li>/gi, '') // Remove <li> with only whitespace/entities
        .replace(/<li[^>]*>[\u00A0\u2000-\u200B\u2028\u2029\u3000\uFEFF\u202F\?\s]*<\/li>/g, ''); // Remove Unicode spaces
      
      // Additional pass to remove any remaining problematic list items
      const listItems: string[] = [];
      filteredContent.replace(/<li[^>]*>([\s\S]*?)<\/li>/g, (_liMatch: string, liContent: string) => {
        // Ultra-strict empty content detection - check for empty but preserve original HTML
        const ultraCleanContent = liContent
          .replace(/<[^>]*>/g, '') // Remove all HTML tags FOR CHECKING ONLY
          .replace(/&[a-zA-Z0-9#]+;/g, '') // Remove HTML entities
          .replace(/[\u0000-\u001F\u007F-\u009F]/g, '') // Remove control characters
          .replace(/[\u00A0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000\uFEFF]/g, '') // Remove all Unicode spaces
          .replace(/[\?\u00BF\u061F\u037E\u055E\u061F\u1367\u1945\u2047-\u2049\u2753-\u2755\u2CFA-\u2CFD\u2E2E\uA60F\uA6F7\uFE16\uFE56\uFE5F\uFF1F]/g, '') // Remove various question marks
          .replace(/[^\w\s\-\.,!@#$%^&*()+=\[\]{}|\\:";'<>?/~`]/g, '') // Keep only basic printable characters
          .trim();
        
        // If content is not empty, push the ORIGINAL liMatch with HTML intact
        if (ultraCleanContent && ultraCleanContent.length > 0) {
          listItems.push(_liMatch);
        }
        return '';
      });
      
      // Only process valid list items
      const processedItems = listItems.map(liMatch => {
        const liContent = liMatch.replace(/<li[^>]*>([\s\S]*?)<\/li>/, '$1');
        
        // Check if this list item contains nested lists
        const hasNestedList = liContent.includes('<ul>') || liContent.includes('<ol>');
        if (hasNestedList) {
          const parts = liContent.split(/(<ul>[\s\S]*?<\/ul>|<ol>[\s\S]*?<\/ol>)/);
          const mainText = parts[0].trim();
          const nestedList = parts[1] || '';
          const afterListText = parts[2] ? parts[2].trim() : ''; // CAPTURE TEXT AFTER THE NESTED LIST
          
          return `<div class="flex items-center space-x-3 my-2">
            <div class="flex-shrink-0">
              <div class="w-2 h-2 rounded-full" style="background-color: var(--berkeley-gold);"></div>
            </div>
            <div class="flex-1">
              <div class="text-sm leading-relaxed urbanist-regular text-slate-700 dark:text-slate-300">${mainText}</div>
              <div class="ml-4 mt-2">
                ${nestedList}
              </div>
              ${afterListText ? `<div class="text-sm leading-relaxed urbanist-regular text-slate-700 dark:text-slate-300 mt-2">${afterListText}</div>` : ''}
            </div>
          </div>`;
        } else {
          return `<div class="flex items-center space-x-3 my-2">
            <div class="flex-shrink-0">
              <div class="w-2 h-2 rounded-full" style="background-color: var(--berkeley-gold);"></div>
            </div>
            <div class="flex-1">
              <div class="text-sm leading-relaxed urbanist-regular text-slate-700 dark:text-slate-300">${liContent.trim()}</div>
            </div>
          </div>`;
        }
      }).join('');
      
      // If no valid items, return empty string
      if (!processedItems || processedItems.trim().length === 0) return '';
      
      return `<div class="space-y-1">${processedItems}</div>`;
    });

    // Handle ordered lists
    processedHtml = processedHtml.replace(/<ol>([\s\S]*?)<\/ol>/g, (match, content) => {
      // More aggressive empty list item filtering for ordered lists
      const filteredContent = content
        .replace(/<li[^>]*>\s*<\/li>/g, '') // Remove completely empty <li></li> tags
        .replace(/<li[^>]*>(\s|&nbsp;|&\w+;|\?)*<\/li>/gi, '') // Remove <li> with only whitespace/entities
        .replace(/<li[^>]*>[\u00A0\u2000-\u200B\u2028\u2029\u3000\uFEFF\u202F\?\s]*<\/li>/g, ''); // Remove Unicode spaces
      
      // Collect only valid list items
      const listItems: string[] = [];
      filteredContent.replace(/<li[^>]*>([\s\S]*?)<\/li>/g, (_liMatch: string, liContent: string) => {
        // Ultra-strict empty content detection - check for empty but preserve original HTML
        const ultraCleanContent = liContent
          .replace(/<[^>]*>/g, '') // Remove all HTML tags FOR CHECKING ONLY
          .replace(/&[a-zA-Z0-9#]+;/g, '') // Remove HTML entities
          .replace(/[\u0000-\u001F\u007F-\u009F]/g, '') // Remove control characters
          .replace(/[\u00A0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000\uFEFF]/g, '') // Remove all Unicode spaces
          .replace(/[\?\u00BF\u061F\u037E\u055E\u061F\u1367\u1945\u2047-\u2049\u2753-\u2755\u2CFA-\u2CFD\u2E2E\uA60F\uA6F7\uFE16\uFE56\uFE5F\uFF1F]/g, '') // Remove various question marks
          .replace(/[^\w\s\-\.,!@#$%^&*()+=\[\]{}|\\:";'<>?/~`]/g, '') // Keep only basic printable characters
          .trim();
        
        // If content is not empty, push the ORIGINAL liContent with HTML intact
        if (ultraCleanContent && ultraCleanContent.length > 0) {
          listItems.push(liContent);
        }
        return '';
      });
      
      // Only process valid list items with counter
      let counter = 0;
      const processedItems = listItems.map(liContent => {
        counter++;
        return `<div class="flex items-center space-x-3 my-2">
          <div class="flex-shrink-0">
            <div class="w-5 h-5 bg-slate-500/10 border-transparent text-blue-700 dark:text-blue-300 rounded-full flex items-center justify-center">
              <span class="text-xs urbanist-medium">${counter}</span>
            </div>
          </div>
          <div class="flex-1">
            <div class="text-sm leading-relaxed urbanist-regular text-slate-700 dark:text-slate-300">${liContent.trim()}</div>
          </div>
        </div>`;
      }).join('');
      
      // If no valid items, return empty string
      if (!processedItems || processedItems.trim().length === 0) return '';
      
      return `<div class="space-y-1">${processedItems}</div>`;
    });

    // Handle headings without vertical bars for cleaner look
    processedHtml = processedHtml.replace(/<h([1-6])>([^<]+)<\/h[1-6]>/g, (match, level, content) => {
      const levelNum = parseInt(level);
      const size = levelNum <= 2 ? 'text-sm' : 'text-xs';
      const weight = levelNum <= 2 ? 'urbanist-semibold' : 'urbanist-medium';
      return `<h${level} class="${size} ${weight} text-slate-900 dark:text-white leading-tight my-3">${content}</h${level}>`;
    });

    // Handle paragraphs without vertical indicators
    processedHtml = processedHtml.replace(/<p>([^<]+)<\/p>/g, (match, content) => {
      if (content.trim().length === 0) return ''; // Remove empty paragraphs entirely
      if (content.length < 20) return `<p class="text-sm leading-relaxed urbanist-regular text-slate-700 dark:text-slate-300 my-2">${content}</p>`;
      return `<p class="text-sm leading-relaxed urbanist-regular text-slate-700 dark:text-slate-300 my-3">${content}</p>`;
    });

    // Clean up whitespace but preserve line breaks
    processedHtml = processedHtml.replace(/\n\s*\n/g, '\n'); // Remove multiple consecutive newlines
    processedHtml = processedHtml.replace(/[ \t]+/g, ' '); // Normalize spaces and tabs but keep line breaks

    // FINAL CLEANUP: Remove HTML artifacts and fix malformed tags
    // Fix malformed nested anchor tags
    processedHtml = processedHtml.replace(/<a[^>]*href="<a[^>]*href="([^"]+)"[^>]*>([^<]+)<\/a>"[^>]*>([^<]*)<\/a>/gi, 
      '<a href="$1" class="text-amber-600 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-200 underline decoration-amber-300 hover:decoration-amber-500 transition-colors !important">$2</a>');
    
    // Remove any remaining HTML entity artifacts
    processedHtml = processedHtml.replace(/&amp;/g, '&');
    processedHtml = processedHtml.replace(/&lt;/g, '<');
    processedHtml = processedHtml.replace(/&gt;/g, '>');
    processedHtml = processedHtml.replace(/&quot;/g, '"');
    
    // Clean up any empty paragraphs or divs
    processedHtml = processedHtml.replace(/<p[^>]*>\s*<\/p>/g, '');
    processedHtml = processedHtml.replace(/<div[^>]*>\s*<\/div>/g, '');
    
    // Fix any broken link attributes
    processedHtml = processedHtml.replace(/href="&lt;a href=&quot;([^&]+)&quot;[^>]*&gt;([^&]+)&lt;\/a&gt;"/gi, 'href="$1"');
    
    // Remove any remaining broken HTML patterns
    processedHtml = processedHtml.replace(/class="[^"]*"=""/g, '');
    processedHtml = processedHtml.replace(/=""[^>]*/g, '');

    // POST-PROCESSING FIX: Restore links that got separated during list processing
    // This handles cases where link text appears after nested lists in list items
    
    // Generic pattern: Look for common link text patterns that might have been separated
    const linkPatterns = [
      // Club Fair pattern
      {
        pattern: /Add the event[^\s]*\s*to your calendar by clicking the link on Campus Groups\./gi,
        replacement: '<a href="https://haas.campusgroups.com/FTMBA/rsvp_boot?id=2250690" target="_blank" rel="noopener noreferrer" class="text-amber-600 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-200 underline decoration-amber-300 hover:decoration-amber-500 transition-colors !important">Add the event to your calendar</a> by clicking the link on Campus Groups.'
      },
      // Generic "click here" or "register here" patterns that might get separated
      {
        pattern: /Register\s+(?:for\s+)?(?:the\s+)?(.+?)\s+(?:here|by clicking this link)/gi,
        replacement: '<a href="#" class="text-amber-600 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-200 underline decoration-amber-300 hover:decoration-amber-500 transition-colors !important">Register for $1 here</a>'
      },
      // Generic "more information" patterns
      {
        pattern: /(?:For\s+)?(?:more\s+)?(?:information|details)\s+(?:visit|see|click)\s+(?:here|this link)/gi,
        replacement: '<a href="#" class="text-amber-600 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-200 underline decoration-amber-300 hover:decoration-amber-500 transition-colors !important">More information here</a>'
      }
    ];
    
    // Apply each pattern
    linkPatterns.forEach(({ pattern, replacement }) => {
      processedHtml = processedHtml.replace(pattern, replacement);
    });

    return processedHtml;
  };

  // ==========================================================================
  // JSX RENDER - MAIN COMPONENT UI
  // ==========================================================================

  return (
    <div className="max-w-4xl mx-auto dark" data-newsletter-widget>
      {/* CSS Styles */}
      <style jsx>{`
        .newsletter-content h1 { font-size: 1rem; font-weight: 700; color: rgb(15 23 42); margin-bottom: 0.75rem; margin-top: 0.5rem; }
        .newsletter-content h2 { font-size: 0.875rem; font-weight: 600; color: rgb(30 41 59); margin-bottom: 0.5rem; margin-top: 0.5rem; }
        .newsletter-content h3 { font-size: 0.875rem; font-weight: 500; color: rgb(51 65 85); margin-bottom: 0.5rem; margin-top: 0.25rem; }
        .newsletter-content h4 { font-size: 0.875rem; font-weight: 500; color: rgb(71 85 105); margin-bottom: 0.25rem; }
        .newsletter-content h5 { font-size: 0.75rem; font-weight: 400; color: rgb(71 85 105); margin-bottom: 0.25rem; }
        .newsletter-content h6 { font-size: 0.75rem; font-weight: 400; color: rgb(100 116 139); margin-bottom: 0.25rem; }
        .newsletter-content p { font-size: 0.875rem; line-height: 1.625; font-weight: 400; color: rgb(51 65 85); margin-bottom: 0.5rem; }
        .newsletter-content strong { font-weight: 600; color: rgb(15 23 42); }
        .newsletter-content em { font-style: italic; color: rgb(71 85 105); }
        .newsletter-content a { color: rgb(217 119 6) !important; text-decoration: underline; text-decoration-color: rgb(252 211 77); transition: colors 0.2s; }
        .newsletter-content a:hover { color: rgb(146 64 14) !important; text-decoration-color: rgb(245 158 11); }
        
        /* Dark mode styles */
        .dark .newsletter-content h1 { color: white; }
        .dark .newsletter-content h2 { color: rgb(241 245 249); }
        .dark .newsletter-content h3 { color: rgb(226 232 240); }
        .dark .newsletter-content h4 { color: rgb(203 213 225); }
        .dark .newsletter-content h5 { color: rgb(148 163 184); }
        .dark .newsletter-content h6 { color: rgb(100 116 139); }
        .dark .newsletter-content p { color: rgb(203 213 225); }
        .dark .newsletter-content strong { color: white; }
        .dark .newsletter-content em { color: rgb(148 163 184); }
        .dark .newsletter-content a { color: rgb(251 191 36) !important; }
        .dark .newsletter-content a:hover { color: rgb(252 211 77) !important; }
      `}</style>
      
      {/* =================================================================== */}
      {/* DATE OVERLAY - Dismissible on click                                */}
    {/* =================================================================== 
          
          {showDateOverlay && getNewsletterDate() && (
          <div 
            className="absolute inset-0 z-50 flex items-start backdrop-blur justify-center cursor-pointer w-full h-full  rounded-t-xl"
            onClick={() => setShowDateOverlay(false)}
            title="Click to dismiss this notification"
          >
            <div className=" items-start justify-left px-5.5 py-18.5 w-full">
                <p className="text-xl bg-gray-900 border-1  border-dotted py-0.5 px-2 backdrop-blur rounded-md  mt-0 text-start leading-tight transition-all duration-300 hover:ring-.05 hover:ring-violet-400/50 hover:shadow-[0_0_30px_rgba(139,92,246,0.6)]">
                <span className="text-white font-semibold">{getNewsletterDate()}</span>  <span className="text-gray-400 font-light">Latest Update</span>
                </p>
            </div>
          </div>
          )}
          
          {/* =================================================================== */}
      {/* HEADER SECTION                                                      */}
      {/* =================================================================== */}
      
      {/* Header */}
      <div className={`rounded-t-xl border-b pt-2 px-3 pb-2 text-white relative overflow-hidden ${COLORS.headerBg} border-transparent`}>
        <div className="relative z-10 select-none">
          <div className="flex items-start justify-between gap-1 sm:gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center space-x-1 mb-0">
              <h2 className="text-lg font-semibold urbanist-black whitespace-nowrap truncate">
                <span style={{ color: 'white' }}>Bear</span>
                <span className="" style={{ color: 'var(--berkeley-gold)' }}>Necessities</span>
                {getNewsletterDate() && (
                  <span style={{ color: 'var(--berkeley-gold)' }}>{` ${getNewsletterDate()}`}</span>
                )}
              </h2>
            </div>
            
            {data.title && (
              <p className="text-gray-400 text-xs urbanist-medium mb-0">
               So A Bear Can Rest at Ease
              </p>
            )}

            {data.sourceUrl && (
              <a
                className="text-gray-800 dark:text-gray-600 text-xs urbanist-regular transition-colors inline-block mb-0  select-text"
                onMouseEnter={(e) => (e.target as HTMLElement).style.color = 'var(--berkeley-gold)'}
                onMouseLeave={(e) => (e.target as HTMLElement).style.color = ''}
                href={data.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => trackEvent('newsletter_source_clicked', { url: data.sourceUrl! })}
              >
                View original  Newsletter 
              </a>
            )}
            {!data.sourceUrl && (
              <a
                className="text-gray-800 dark:text-gray-600 text-xs urbanist-regular transition-colors inline-block mb-0  select-text"
                onMouseEnter={(e) => (e.target as HTMLElement).style.color = 'var(--berkeley-gold)'}
                onMouseLeave={(e) => (e.target as HTMLElement).style.color = ''}
                href="https://us7.campaign-archive.com/home/?u=af08d0494e1eb953ae69deb12&id=82d127382b"
                target="_blank"
                rel="noopener noreferrer"
              >
                View Newsletter Archive
              </a>
            )}
            
            {/* 
            <button
              onClick={markAllAsRead}
              className="text-blue-600 dark:text-blue-400 text-xs urbanist-medium transition-colors block mb-2 whitespace-nowrap hover:text-blue-800 dark:hover:text-blue-300 underline"
              onMouseEnter={(e) => (e.target as HTMLElement).style.color = 'var(--berkeley-gold)'}
              onMouseLeave={(e) => (e.target as HTMLElement).style.color = ''}
            >
              🧪 Mark All as Read (Test)
            </button>
            
            <button
              onClick={markAllAsUnread}
              className="text-orange-600 dark:text-orange-400 text-xs urbanist-medium transition-colors block mb-2 whitespace-nowrap hover:text-orange-800 dark:hover:text-orange-300 underline"
              onMouseEnter={(e) => (e.target as HTMLElement).style.color = 'var(--berkeley-gold)'}
              onMouseLeave={(e) => (e.target as HTMLElement).style.color = ''}
            >
              🔄 Mark All as Unread (Reset)
            </button>
            */}
          </div>

          <div className="flex flex-col items-end flex-shrink-0">
           
            {/* SECTION READ COUNTER */}
            <div className="text-right">
              {unopenedSectionsCount === 0 ? (
                <div className="text-center">
               <div className="text-md urbanist-bold" style={{ color: 'var(--berkeley-gold)' }}>
                    {animationData && triggerTopLevelAnimation ? (
                        <div className="brightness-[.9] contrast-[2.5]">
                        <Lottie 
                        animationData={animationData}
                        loop={false}
                        autoplay={true}
                        className="w-10 h-10 mx-auto"
                        />
                        </div>
                      ) : (
                      <div className="w-8 h-8 sm:w-8 sm:h-8 mx-auto flex items-center justify-center">
                        <span className="text-lg">✓</span>
                      </div>
                    )}
                  </div>
                  {showCaughtUpText && (
                    <div 
                      className="text-xs px-2 text-gray-200 urbanist-medium whitespace-nowrap flex items-center animate-smooth-fade-in" 
                      >
                      Caught Up!
                    </div>
                  )}
               
                </div>
              ) : (
                <div className=" rounded-xl  p-1.5 sm:p-2 shadow-lg bg-gradient-to-b from-gray-900/50 to-gray-900/10 text-center" style={{ borderColor: 'var(--berkeley-gold)', boxShadow: '0 -2px 20px 2px rgba(255, 255, 255, 0.2)' }}>
                  <div className="text-xs urbanist-light mb-0 whitespace-nowrap" style={{ color: 'var(--berkeley-gold)' }}>Updates<br />To Review</div>
                  <div className="text-xl sm:text-lg urbanist-bold whitespace-nowrap" style={{ color: 'var(--berkeley-gold)' }}>
                  {unopenedSectionsCount} of {data.sections.length}
                  </div>
                </div>
              )}
            </div>
          </div>
          </div>
        </div>
      </div>

      {/* =================================================================== */}
      {/* CONTENT SECTIONS - ACCORDION LAYOUT                                */}
      {/* =================================================================== */}

      {/* Content Sections */}
      <div 
        className={`rounded-b-xl shadow-xl overflow-hidden ${COLORS.containerBg}`}
      >
        {data.sections.map((sec, idx) => {
          const id = `${idx}-${sec.sectionTitle}`;
          const isOpen = !!open[id];
          const sectionVisitedCount = createSubsections(sec.items).filter((_, subIdx) => {
            const subsectionKey = `${idx}-${subIdx}`;
            const itemId = `${id}-item-${subIdx}`;
            return itemVisited.has(subsectionKey) || itemOpen[itemId];
          }).length;
          const sectionTotalCount = createSubsections(sec.items).length;
          
          return (
            <div 
              key={id} 
              data-newsletter-section={idx}
              data-section-title={sec.sectionTitle}
              className={`${idx === data.sections.length - 1 ? '' : `border-b  ${COLORS.border}`}`}
            >
              <button
                onClick={() => {
                  // Auto-collapse: close all other sections
                  const newOpen: Record<string, boolean> = {};
                  if (!isOpen) {
                    newOpen[id] = true;
                    trackEvent('newsletter_section_opened', { section: sec.sectionTitle });
                  }
                  setOpen(newOpen);
                  // Also close all item dropdowns when switching sections
                  setItemOpen({});
                }}
                className={`section-button w-full text-left px-2.5 py-3 ${COLORS.sectionBg} ${COLORS.sectionBgHover} transition-all duration-300 ease-in-out flex items-center justify-between group`}
              >
                <div className="flex items-center space-x-3">
                  {allItemsInSectionVisited(idx) ? (
                    <div className={`w-3 h-3 rounded-full border-2 mr-2 ${COLORS.readDot}`}>
                  </div>) : (<div className={`w-3 h-3 rounded-full border-2 mr-2 ${COLORS.unreadDot}`}></div>
                    
                  )}
                    <h3 className={`text-lg urbanist-semibold  transition-colors ${COLORS.textHoverWhite} ${COLORS.textPrimary}`}>
                    {sec.sectionTitle}
                  </h3>
                </div>
                <div className="flex items-center justify-center">
                  <div className={`text-xs flex items-center justify-center ${COLORS.textSecondary}`}>
                    {sectionVisitedCount === sectionTotalCount ? (
                      <div 
                        className={`w-20 h-8 rounded-lg flex items-center justify-center ${COLORS.gold}`}
                      >
                        {animationData ? (
                          <div 
                            className={`transition-transform duration-[200ms] brightness-[.9] contrast-[2.5] ease-in-out ${sectionScaleStates[idx] ? 'brightness-[1.5]' : 'brightness-100'} flex items-center justify-center`}
                          >
                            
                            <Lottie 
                              animationData={animationData}
                              loop={false}
                              autoplay={true}
                              className="w-8 h-8"
                            />
                          </div>
                        ) : (
                          <span className="text-sm text-green-600 dark:text-green-400">✓</span>
                        )}
                      </div>
                    ) : (
                      <div className="w-20 h-8 rounded-lg flex items-center justify-center urbanist-medium text-xs bg-glass"
                          >
                        {sectionTotalCount - sectionVisitedCount}/{sectionTotalCount} Unread
                      </div>
                    )}
                  </div>
                </div>
              </button>
              
              <div 
                className={`expandable ${
                  isOpen ? 'expanded' : 'collapsed'
                }`}
              >
                <div className="expandable-content">
                  <div className={`border-t border-slate-700 bg-black/30 py-1  ${idx === data.sections.length - 1 ? 'rounded-b-2xl' : ''}`}>
                    <div className={`px-1 py-1  ${idx === data.sections.length - 1 ? 'pb-6 rounded-b-2xl' : ''}`}>
                      {createSubsections(sec.items).map((subsection, j) => {
                        const itemKey = `${idx}-${j}`;
                        const itemId = `${id}-item-${j}`;
                        const isItemVisited = itemVisited.has(itemKey);
                        const isItemOpen = !!itemOpen[itemId];
                        
                        return (
                          <div key={itemId} className="relative">
                            {/* Subsection container */}
                            <div 
                              data-item-title={subsection.title}
                              data-subsection-index={j}
                              className={`ml-1  mb-1 text-lg rounded-lg shadow-sm ${COLORS.subsectionBg} border ${COLORS.border}`}
                            >
                              <button
                                onClick={() => {
                                  // Auto-collapse: close all other items in this section
                                  const newItemOpen: Record<string, boolean> = {};
                                  if (!isItemOpen) {
                                    newItemOpen[itemId] = true;
                                    // Mark as visited when opened
                                    if (!isItemVisited) {
                                      setItemVisited(new Set([...itemVisited, itemKey]));
                                    }
                                    trackEvent('newsletter_item_read', { section: sec.sectionTitle, item: subsection.title });
                                  }
                                  setItemOpen(newItemOpen);
                                }}
                                className="item-button w-full text-left px-2 py-1 hover:brightness-105 dark:hover:brightness-110 transition-all duration-300 ease-in-out flex items-center justify-between group rounded-lg"
                              >
                                <div className="flex items-center space-x-2 truncate">
                                  {/* Pulsing yellow/green indicator only */}
                                  <div 
                                    className="flex-shrink-0 cursor-pointer transition-all duration-300"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (!isItemVisited) {
                                        setItemVisited(new Set([...itemVisited, itemKey]));
                                      }
                                    }}
                                  >
                                    {isItemVisited || isItemOpen ? (
                                         <div className={`w-3 h-3 rounded-full border-2 mr-2 ${COLORS.readDot}`}>
                                         </div>):  (<div className={`w-3 h-3 rounded-full border-2 mr-2 ${COLORS.unreadDot}`}></div>
                    
                  )}
                                  </div>

                                  <h4 className={`text-sm urbanist-medium transition-colors truncate overflow-hidden ${COLORS.textPrimary} ${COLORS.textHoverGold}`}
                                      style={{ 
                                        textOverflow: 'ellipsis'
                                      }}>
                                    {subsection.title}
                                  </h4>
                                </div>
                              </button>
                              
                              <div 
                                className={`expandable ${
                                  isItemOpen ? 'expanded' : 'collapsed'
                                }`}
                              >
                                <div className="expandable-content">
                                  <div 
                                    className={`rounded-b-lg border-t ${COLORS.border} ${COLORS.contentBg}`}
                                  >
                                    <div className="px-3 py-0.5 cursor-pointer"
                                      onClick={() => {
                                        if (!isItemVisited) {
                                          setItemVisited(new Set([...itemVisited, itemKey]));
                                        }
                                      }}
                                    >
                                      {/* Content with enhanced visual hierarchy */}
                                      <div>
                                        <div
                                          className={`newsletter-content urbanist-regular ${COLORS.textContent}`}
                                          dangerouslySetInnerHTML={{ __html: addSmartBullets(subsection.content) }}
                                        />
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        
        {data.sections.length === 0 && (
          <div className="p-12 text-center">
            <div className="w-16 h-16 bg-slate-100 dark:bg-slate-700 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">📭</span>
            </div>
            <h3 className="text-lg urbanist-semibold text-slate-900 dark:text-white mb-2">No sections found</h3>
            <p className="text-slate-600 dark:text-slate-400 text-sm urbanist-regular">
              The newsletter content could not be parsed into sections.
            </p>
          </div>
        )}

        {/* AI Debug Panel */}
        {/* Commented out AI debug info to reduce visual clutter */}
        {/*
        {data.aiDebugInfo && (
          <div className="border-t border-slate-200 dark:border-slate-700">
            <details className="group">
              <summary className="px-4 py-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                <div className="flex items-center space-x-2">
                  <span className="text-lg">🤖</span>
                  <span className="text-sm urbanist-medium text-slate-700 dark:text-slate-300">
                    AI Debug Info ({data.aiDebugInfo.processingTime}ms)
                  </span>
                  <span className="text-xs text-slate-500 group-open:rotate-180 transition-transform">▼</span>
                </div>
              </summary>
              <div className="px-4 pb-4 bg-slate-50 dark:bg-slate-800/30">
                <div className="space-y-3 text-sm">
                  <div>
                    <h4 className="urbanist-semibold text-slate-800 dark:text-slate-200 mb-1">🧠 AI Reasoning:</h4>
                    <p className="text-slate-600 dark:text-slate-400 urbanist-regular">{data.aiDebugInfo.reasoning}</p>
                  </div>
                  
                  <div>
                    <h4 className="urbanist-semibold text-slate-800 dark:text-slate-200 mb-1">📝 Section Decisions:</h4>
                    <ul className="space-y-1 text-slate-600 dark:text-slate-400 urbanist-regular">
                      {data.aiDebugInfo.sectionDecisions.map((decision, idx) => (
                        <li key={idx} className="flex items-start space-x-2">
                          <span className="text-amber-500 mt-1">•</span>
                          <span>{decision}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  
                  {data.aiDebugInfo.edgeCasesHandled.length > 0 && (
                    <div>
                      <h4 className="urbanist-semibold text-slate-800 dark:text-slate-200 mb-1">⚠️ Edge Cases Handled:</h4>
                      <ul className="space-y-1 text-slate-600 dark:text-slate-400 urbanist-regular">
                        {data.aiDebugInfo.edgeCasesHandled.map((edge, idx) => (
                          <li key={idx} className="flex items-start space-x-2">
                            <span className="text-orange-500 mt-1">•</span>
                            <span>{edge}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  
                  <div className="flex items-center space-x-4 text-xs text-slate-500 pt-2 border-t border-slate-200 dark:border-slate-600">
                    <span>📊 Sections: {data.aiDebugInfo.totalSections}</span>
                    <span>⏱️ Processing: {data.aiDebugInfo.processingTime}ms</span>
                  </div>
                </div>
              </div>
            </details>
          </div>
        )}
        */}
        
        {/* =================================================================== */}
        {/* FOOTER SECTION                                                      */}
        {/* =================================================================== */}
        
        {/* Copyright Footer */}
        <div className={`border-slate-200 dark:border-slate-700 py-1 px-4 rounded-b-xl relative overflow-hidden ${COLORS.footerBg} border-transparent`}>
          <div className="relative z-10 text-center">
            <p className="text-xs py-0italic text-slate-600 dark:text-slate-400 urbanist-regular mx-auto select-none">
              Bear Necessities | Copyright © 2025 Evening & Weekend MBA
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
