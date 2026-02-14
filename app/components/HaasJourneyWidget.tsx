'use client';

import { trackEvent } from '@/lib/analytics';

interface ResourceItem {
  id: string;
  title: string;
  cta: string;
  url: string;
  icon: string;
}

interface HaasJourneyWidgetProps {
  className?: string;
  isExpanded?: boolean;
  onExpandChange?: (expanded: boolean) => void;
}

const HAAS_RESOURCES: ResourceItem[] = [

  {
    id: 'academic-advisor',
    title: 'Connect',
    cta: 'Academic Advisor',
    url: 'http://haas.berkeley.edu/EWMBA/contacts/',
    icon: 'support_agent'
  },
  {
    id: 'university-finances',
    title: 'My University Finances',
    cta: 'Check Financials',
    url: 'https://calcentral.berkeley.edu/finances',
    icon: 'currency_exchange'
  },
  {
    id: 'calcentral',
    title: 'UC Berkeley Student Portal',
    cta: 'CalCentral',
    url: 'https://calcentral.berkeley.edu/dashboard',
    icon: 'school'
  },
  {
    id: 'career-mgmt',
    title: 'Career Mgmt Group',
    cta: 'Career Advisor',
    url: 'https://haas.berkeley.edu/cmg/cmg-resources/cmg-career-coaching-programs-team/',
    icon: 'rocket_launch'
  },
  {
    id: 'campus-groups',
    title: 'Haas Campus Groups',
    cta: 'Campus Clubs',
    url: 'https://haas.campusgroups.com/web_app?id=23784&menu_id=63384&if=0&',
    icon: 'groups'
  },
  {
    id: 'mental-health',
    title: 'Berkeley Student Mental Health',
    cta: 'Mental Wellness',
    url: 'https://uhs.berkeley.edu/student-mental-health',
    icon: 'psychology'
  }
,
];

// Centralized styling constants for easy maintenance
const STYLES = {
  container: "ml-auto",
  dropdownHeader: "flex items-center justify-end p-2 rounded-full hover:bg-white/10 transition-all duration-500 cursor-pointer group",
  dropdownTitle: "text-md font-semibold text-white transition-all duration-600 overflow-hidden text-center leading-tight",
  dropdownIcon: "text-white material-icons transition-all duration-600 ease-in-out",
  dropdownIconOpen: "translate-x-3 translate-y-0",
  dropdownContent: "transition-all duration-400 ease-[cubic-bezier(0.4,0,0.2,1)] w-full",
  // Grid styles - mobile (6-col horizontal) vs desktop expanded (3x2) vs desktop compact (1x6)
  gridMobile: "grid grid-cols-6 gap-x-1 w-full",
  gridExpanded: "grid grid-cols-3 gap-x-0 -my-2 gap-y-0 p-1 w-full",
  gridCompact: "grid grid-cols-1 gap-y-0 w-full",
  resourceContainer: "border-white hover:rounded-3xl  relative",
  resourceLink: "flex flex-row items-center justify-start gap-2 px-4 py-1.5 mx-2 hover:py-1 hover:mx-4 rounded-full hover:bg-white/70 hover:-translate-y-0.5 hover:scale-110 hover-border-2 hover-borer-violet-200 hover:shadow-[0_0_30px_rgba(109,40,217,0.9)] transition-all duration-500 group hover:overflow-hidden",
  resourceLinkMobile: "flex flex-col items-center justify- gap-0.5 p-1 rounded-lg hover:bg-white/50 hover:-translate-y-1 hover:scale-110 hover:shadow-[0_0_20px_rgba(109,40,217,0.2)] transition-all duration-200 group text-center overflow-hidden",
  resourceLinkCompact: "flex flex-row items-center justify-start gap-1 p-1 mx-2 hover:mx-4 rounded-lg hover:bg-white/80 hover:-translate-y-1 hover:scale-105 hover:shadow-[0_0_20px_rgba(109,40,217,0.2)]  group hover:overflow-hidden",
  iconContainer: "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 border border-white/20 ",
  iconContainerMobile: "w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 border border-white/20",
  iconContainerCompact: "w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 border border-white/20",
  icon: "text-white/80 group-hover:text-violet-500 material-icons !text-[24px] transition-colors duration-200",
  iconMobile: "text-white/80 group-hover:text-black material-icons !text-[16px] transition-colors duration-200",
  iconCompact: "text-white/80 group-hover:text-black material-icons !text-[14px] transition-colors duration-200",
  textContainer: "text-left leading-tight flex flex-col hover:overflow-hidden",
  textContainerMobile: "text-center leading-tight flex flex-col overflow-hidden",
  resourceTitle: "text-xs font-light text-white/40 group-hover:text-black/60 group-hover:font-medium truncate leading-tight overflow-hidden text-ellipsis",
  resourceTitleMobile: "hidden", // Hide subtitle on mobile
  resourceCta: "text-sm font-light text-white/80 group-hover:text-black group-hover:font-semibold transition-all duration-200 whitespace-nowrap leading-tight",
  resourceCtaMobile: "text-[10px] font-light text-white/70 group-hover:text-black group-hover:font-semibold transition-all duration-200 leading-tight",
  resourceCtaCompact: "text-xs font-light text-gray-400 group-hover:text-black group-hover:font-semibold transition-all duration-200 whitespace-nowrap leading-tight",
  cascadeItem: "transform transition-all duration-400 ease-[cubic-bezier(0.4,0,0.2,1)]"
} as const

// Mobile compact card - horizontal 6-icon row
function MobileResourceCard({ resource }: { resource: ResourceItem }) {
  return (
    <div className={`select-none ${STYLES.resourceContainer}`}>
      <a 
        href={resource.url} 
        target="_blank" 
        rel="noopener noreferrer"
        className={STYLES.resourceLinkMobile}
        onClick={() => trackEvent('haas_journey_link_clicked', { resource: resource.id, title: resource.cta })}
      >
        <div className={STYLES.iconContainerMobile}>
          <span className={STYLES.iconMobile}>{resource.icon}</span>
        </div>
        <div className={STYLES.textContainerMobile}>
          <div className={STYLES.resourceCtaMobile}>{resource.cta}</div>
        </div>
      </a>
    </div>
  );
}

// Desktop card with animation
function ResourceCard({ resource, index, isOpen, totalItems }: { resource: ResourceItem; index: number; isOpen: boolean; totalItems: number }) {
  // Reverse the index for right-to-left animation on expand
  const reverseIndex = totalItems - 1 - index;
  // On expand: right-to-left (reverseIndex), on collapse: right-to-left (reverseIndex) - same direction
  const expandDelay = 100 + reverseIndex * 60;
  const collapseDelay = 50 + reverseIndex * 60;
  
  return (
    <div 
      className={`select-none ${STYLES.resourceContainer} ${STYLES.cascadeItem}`}
      style={{
        transitionDelay: isOpen ? `${expandDelay}ms` : `${collapseDelay}ms`,
        opacity: isOpen ? 1 : 0,
        transform: isOpen ? 'translateY(0) scale(1)' : 'translateY(-8px) scale(0.95)'
      }}
    >
      <a 
        href={resource.url} 
        target="_blank" 
        rel="noopener noreferrer"
        className={STYLES.resourceLink}
        onClick={() => trackEvent('haas_journey_link_clicked', { resource: resource.id, title: resource.cta })}
      >
        <div className={STYLES.iconContainer}>
          <span className={STYLES.icon}>{resource.icon}</span>
        </div>
        <div className={STYLES.textContainer}>
          <div className={STYLES.resourceCta}>{resource.cta}</div>
          <div className={STYLES.resourceTitle}>{resource.title}</div>
        </div>
      </a>
    </div>
  );
}

export default function HaasJourneyWidget({ className = "", isExpanded = true, onExpandChange }: HaasJourneyWidgetProps) {
  // Use controlled state from parent
  const isOpen = isExpanded;
  const setIsOpen = (value: boolean) => {
    onExpandChange?.(value);
  };

  return (
    <div className={`select-none rounded-none lg:rounded-l-3xl lg:rounded-r-md py-0 lg:py-2 mr-1 bg-none lg:bg-violet-100/10 min-h-[80px] lg:min-w-[160px] ${!isOpen ? 'lg:-ml-8' : ''} ${STYLES.container} ${className}`}>
      {/* Mobile Layout - Always visible compact 6-icon horizontal row */}
      <div className="lg:hidden">
        <div className={STYLES.gridMobile}>
          {HAAS_RESOURCES.map((resource) => (
            <MobileResourceCard key={resource.id} resource={resource} />
          ))}
        </div>
      </div>
      
      {/* Desktop Layout - Expandable with toggle button */}
      <div className="hidden lg:flex items-center justify-end w-full h-full min-h-[80px] z-10 relative">
        {/* Dropdown Content - Same Row, Left Side */}
        <div 
          className={`${STYLES.dropdownContent} ${!isOpen ? 'pointer-events-none' : ''}`}
          style={{
            maxWidth: isOpen ? '2000px' : '0',
            maxHeight: isOpen ? '500px' : '0',
            opacity: isOpen ? 1 : 0,
            transitionDelay: isOpen ? '150ms' : '180ms'
          }}
        >
          <div className={STYLES.gridExpanded}>
            {HAAS_RESOURCES.map((resource, index) => (
              <ResourceCard 
                key={resource.id} 
                resource={resource} 
                index={index} 
                isOpen={isOpen} 
                totalItems={HAAS_RESOURCES.length}
              />
            ))}
          </div>
        </div>
        
        {/* Dropdown Header - Right Side */}
        <div className="flex items-start gap-5 ">
          <button 
            className={`flex items-center justify-center w-6 h-6 rounded-full bg-transparent border border-violet-400/40 hover:bg-slate-800 hover:border-violet-300/60 transition-all duration-500 ease-in-out  ${
              isOpen ? 'translate-x-8 translate-y-0 w-5 h-5' : 'translate-x-8 translate-y-0 animate-[rotating-violet-glow_1.5s_ease-in-out_infinite] hover:animate-[rotating-violet-glow-hover_4s_ease-in-out_infinite'
            }`}
            onClick={() => { trackEvent('haas_journey_toggled', { expanded: !isOpen }); setIsOpen(!isOpen); }}
            title={isOpen ? 'Collapse' : 'Expand'}
            aria-label={isOpen ? 'Collapse resources' : 'Expand resources'}
          >
            <svg
              className={`w-5 h-5 text-white/50 scale-80 transition-transform duration-1000 ease-in-out ${isOpen ? 'rotate-[225deg] ' : 'rotate-0'}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              strokeWidth={2.0}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
          </button>
          {/* "Haas Official" and "Critical Links" text - styled like MyWeekWidget, always visible */}
          <div 
            className="flex flex-col items-end justify-center whitespace-nowrap transition-all duration-1000 ease-in-out h-full mr-3"
          >
            <span className="text-lg md:text-lg font-extralight text-slate-400">
              Haas Official
            </span>
            <span className="text-xl md:text- xl font-medium text-white">
              Campus <span className="text-white/60">Links</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
