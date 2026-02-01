'use client';

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
  container: "w-full",
  dropdownHeader: "flex items-center justify-end p-2 rounded-xl hover:bg-turbulence transition-all duration-500 cursor-pointer group",
  dropdownTitle: "text-md font-semibold text-white transition-all duration-600 overflow-hidden text-center leading-tight",
  dropdownIcon: "text-white material-icons transition-all duration-600 ease-in-out",
  dropdownIconOpen: "translate-x-3 translate-y-0",
  dropdownContent: "transition-all duration-600 w-full",
  // Grid styles - mobile (6-col horizontal) vs desktop expanded (3x2) vs desktop compact (1x6)
  gridMobile: "grid grid-cols-6 gap-x-1 w-full",
  gridExpanded: "grid grid-cols-3 gap-x-6 gap-y-0 w-full",
  gridCompact: "grid grid-cols-1 gap-y-0 w-full",
  resourceContainer: "border-white/30 rounded-md relative",
  resourceLink: "flex flex-row items-center justify-start gap-2 px-4 py-1.5 rounded-xl hover:bg-turbulence transition-all duration-100 group",
  resourceLinkMobile: "flex flex-col items-center justify-start gap-0.5 p-1 rounded-lg hover:bg-turbulence transition-all duration-100 group text-center",
  resourceLinkCompact: "flex flex-row items-center justify-start gap-1 p-1 rounded-lg hover:bg-turbulence transition-all duration-100 group",
  iconContainer: "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 border border-white/20",
  iconContainerMobile: "w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 border border-white/20",
  iconContainerCompact: "w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 border border-white/20",
  icon: "text-white/80 material-icons !text-[24px]",
  iconMobile: "text-white/80 material-icons !text-[16px]",
  iconCompact: "text-white/80 material-icons !text-[14px]",
  textContainer: "text-left leading-tight flex flex-col",
  textContainerMobile: "text-center leading-tight flex flex-col",
  resourceTitle: "text-xs font-light text-white/40 truncate leading-tight",
  resourceTitleMobile: "hidden", // Hide subtitle on mobile
  resourceCta: "text-sm font-light text-white/80 group-hover:text-blue-200 transition-colors whitespace-nowrap leading-tight",
  resourceCtaMobile: "text-[10px] font-light text-white/70 group-hover:text-blue-200 transition-colors leading-tight",
  resourceCtaCompact: "text-xs font-light text-gray-400 group-hover:text-blue-200 transition-colors whitespace-nowrap leading-tight",
  cascadeItem: "transform transition-all duration-500 ease-out"
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
  // Reverse the index for right-to-left animation
  const reverseIndex = totalItems - 1 - index;
  
  return (
    <div 
      className={`select-none ${STYLES.resourceContainer} ${STYLES.cascadeItem}`}
      style={{
        transitionDelay: isOpen ? `${300 + reverseIndex * 50}ms` : '0ms',
        opacity: isOpen ? 1 : 0,
        transform: isOpen ? 'translateY(0)' : 'translateY(-10px)'
      }}
    >
      <a 
        href={resource.url} 
        target="_blank" 
        rel="noopener noreferrer"
        className={STYLES.resourceLink}
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
    <div className={`select-none ${STYLES.container} ${className}`}>
      {/* Mobile Layout - Always visible compact 6-icon horizontal row */}
      <div className="lg:hidden">
        <div className={STYLES.gridMobile}>
          {HAAS_RESOURCES.map((resource) => (
            <MobileResourceCard key={resource.id} resource={resource} />
          ))}
        </div>
      </div>
      
      {/* Desktop Layout - Expandable with toggle button */}
      <div className="hidden lg:flex items-start justify-end w-full z-10">
        {/* Dropdown Content - Same Row, Left Side */}
        <div 
          className={`${STYLES.dropdownContent} ${!isOpen ? 'pointer-events-none' : ''}`}
          style={{
            maxWidth: isOpen ? '2000px' : '0',
            maxHeight: isOpen ? '500px' : '0',
            opacity: isOpen ? 1 : 0,
            transitionDelay: isOpen ? '300ms' : '0ms'
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
        <div className="flex items-start gap-5">
          <button 
            className={`flex items-center justify-center w-6 h-6 rounded-full bg-transparent border border-violet-400/40 hover:bg-slate-800 hover:border-violet-300/60 transition-all duration-500 ease-in-out animate-[rotating-violet-glow_1.5s_ease-in-out_infinite] hover:animate-[rotating-violet-glow-hover_4s_ease-in-out_infinite] ${
              isOpen ? '-translate-x-0 translate-y-5 w-5 h-5' : 'translate-x-10 translate-y-0'
            }`}
            onClick={() => setIsOpen(!isOpen)}
            title={isOpen ? 'Collapse' : 'Expand'}
            aria-label={isOpen ? 'Collapse resources' : 'Expand resources'}
          >
            <svg
              className={`w-5 h-5 text-white/50 scale-80 transition-transform duration-600 ease-in-out ${isOpen ? 'rotate-[225deg]' : 'rotate-0'}`}
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
            className="flex flex-col items-end whitespace-nowrap transition-all duration-500 ease-in-out"
          >
            <span className="text-xl md:text-xl font-extralight text-slate-400">
              Haas Official
            </span>
            <span className="text-3xl md:text-3xl font-medium text-white">
              Critical <span className="text-white/60">Links</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
