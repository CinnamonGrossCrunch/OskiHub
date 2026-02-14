'use client';

import { useState, useEffect, useMemo } from 'react';
import Image from "next/image";
import CalendarListView from "./CalendarListView";
import CohortCalendarWidget from "./CohortCalendarWidget";
import NewsletterWidget from "./NewsletterWidget";
import GmailNewsletterWidget, { GMAIL_NEWSLETTER_VARIANTS } from "./GmailNewsletterWidget";
import SlackWidget from "./SlackWidget";
import type { CohortEvents } from '@/lib/icsUtils';
import type { UnifiedDashboardData } from '@/app/api/unified-dashboard/route';
import { trackEvent } from '@/lib/analytics';

type CohortType = 'blue' | 'gold';

interface MainDashboardTabsProps {
  cohortEvents: CohortEvents;
  selectedCohort: CohortType;
  dashboardData?: UnifiedDashboardData | null;
}

export default function MainDashboardTabs({ 
  cohortEvents, 
  selectedCohort,
  dashboardData
}: MainDashboardTabsProps) {
  const [activeTab, setActiveTab] = useState('OskiHub Cal');
  const [calendarTabGlowing, setCalendarTabGlowing] = useState(false);
  const cohortTabs = useMemo(() => ['OskiHub Cal', 'Book A Space @ Haas'], []);
  const dashboardTabs = useMemo(() => ['Slack', 'Updates'], []);

  // Reset to first cohort tab when screen size changes and active tab is not available
  useEffect(() => {
    const checkScreenSize = () => {
      const isLargeScreen = window.matchMedia('(min-width: 1024px)').matches;
      
      // If we're on a large screen and the active tab is one of the dashboard tabs (Slack/Updates)
      // that are hidden on large screens, switch back to the first cohort tab
      if (isLargeScreen && dashboardTabs.includes(activeTab)) {
        setActiveTab('OskiHub Cal');
      }
    };
    
    // Check on mount
    checkScreenSize();
    
    // Listen for window resize
    window.addEventListener('resize', checkScreenSize);
    return () => window.removeEventListener('resize', checkScreenSize);
  }, [activeTab, dashboardTabs]);

  // Listen for tab switch requests from My Week Widget
  useEffect(() => {
    const handleSwitchTab = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      console.log(`🔄 Tab switch requested: ${detail.tabName}`);
      
      // If switching to Updates tab from Calendar, trigger the calendar tab glow
      if (detail.tabName === 'Updates' && activeTab === 'OskiHub Cal') {
        console.log(`✨ [MainDashboardTabs] Triggering violet glow on Calendar tab`);
        setCalendarTabGlowing(true);
        
        // Auto-remove glow after 7 seconds
        setTimeout(() => {
          setCalendarTabGlowing(false);
          console.log(`🌅 [MainDashboardTabs] Violet glow faded out from Calendar tab`);
        }, 7000);
      }
      
      // Switch to the requested tab
      setActiveTab(detail.tabName);
      trackEvent('tab_switched', { tab: detail.tabName, source: 'cross_widget' });
      console.log(`✅ Switched to tab: ${detail.tabName}`);
    };
    
    window.addEventListener('switchToTab', handleSwitchTab);
    return () => window.removeEventListener('switchToTab', handleSwitchTab);
  }, [activeTab]);

  // Helper function to get icon for each tab
  const getTabIcon = (tab: string) => {
    switch (tab) {
      case 'OskiHub Cal':
        return 'event';
      case 'Book A Space @ Haas':
        return 'meeting_room';
      case 'Slack':
        return 'forum';
      case 'Updates':
        return 'campaign';
      default:
        return 'tab';
    }
  };

  return (
    <div className="relative">
      {/* Tab Navigation */}
      <div className="flex items-end relative">
        {/* Cohort Tabs (left side) */}
        {cohortTabs.map((tab, index) => (
          <button
            key={index}
            onClick={() => { setActiveTab(tab); trackEvent('tab_switched', { tab, source: 'click' }); }}
            className={`relative  transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 overflow-hidden
              ${activeTab === tab
                ? ' text-center text-md px-10 py-3 lg:px-8 bg-violet-100/10 -mb-0 backdrop-blur-lg text-white shadow-[0_2px_8px_-2px_rgba(0,0,0,0.08)] z-0 rounded-t-3xl saturate-[80%] font-light'
                : ' text-center text-sm ml-3 mr-4 mb-2 px-5 lg:px-10 py-2 tab-inactive backdrop-blur-md text-white shadow-[0_2px_8px_-2px_rgba(0,0,0,0.08)] z-20 rounded-full font-normal'
              }
              ${tab === 'OskiHub Cal' && calendarTabGlowing && activeTab !== tab ? 'newsletter-tab-glow' : ''}
            `}
            style={{
              ...(activeTab === tab && {
                clipPath: index === 0 
                  ? 'polygon(0% 100%, 0% 0%, calc(100% - 30px) 0%, 100% 100%)'
                  : 'polygon(0% 100%, 30px 0%, calc(100% - 30px) 0%, 100% 100%)',
                marginRight: index === cohortTabs.length - 1 ? '0' : '-16px',
              }),
              position: 'relative'
            }}
          >
            {/* Icon only on small screens */}
            <span className="lg:hidden flex items-end justify-center relative z-10 h-full pb-1">
              <i className={`material-icons ${activeTab === tab ? 'text-xl' : 'text-base'}`}>{getTabIcon(tab)}</i>
            </span>
            {/* Text only on large screens */}
            <span className="hidden lg:block relative z-10 truncate">{tab || ' '}</span>
          </button>
        ))}
        
        {/* Spacer grows in the middle */}
        <div className="flex-grow h-px mt-3"></div>
        
        {/* Dashboard Tabs (right side) - only on small screens */}
        <div className="lg:hidden flex items-end">
          {dashboardTabs.map((tab, index) => (
            <button
              key={index}
              onClick={() => { setActiveTab(tab); trackEvent('tab_switched', { tab, source: 'click' }); }}
              className={`relative transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 overflow-hidden
                ${activeTab === tab
                  ? 'text-center px-10 text-md py-3 bg-violet-100/10 backdrop-blur-lg text-white shadow-[0_2px_8px_-2px_rgba(0,0,0,0.08)] z-20 rounded-t-3xl saturate-[80%] font-light'
                  : ' text-center ml-4 text-sm mr-3 mb-2 px-5 py-2 tab-inactive backdrop-blur-md text-white shadow-[0_2px_8px_-2px_rgba(0,0,0,0.08)] z-20 rounded-full font-normal'
                }
              `}
              style={{
                ...(activeTab === tab && {
                  clipPath: index === dashboardTabs.length - 1 
                    ? 'polygon(30px 0%, 100% 0%, 100% 100%, 0% 100%)'  // Rightmost - angled left edge
                  : 'polygon(0% 100%, 30px 0%, calc(100% - 30px) 0%, 100% 100%)',
                  marginLeft: index === dashboardTabs.length - 1 ? '-16px' : '0',
                  marginRight: index === dashboardTabs.length - 1 ? '0' : '-16px',
                }),
                position: 'relative'
              }}
            >
              {/* Icon only (always on small screens) */}
              <span className="flex items-end justify-center relative z-10 h-full pb-1">
                <i className={`material-icons ${activeTab === tab ? 'text-xl' : 'text-base'}`}>{getTabIcon(tab)}</i>
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Content Pane */}
      <div className={`bg-violet-100/10 backdrop-blur-lg rounded-b-3xl  shadow-[0_2px_8px_-2px_rgba(0,0,0,0.08)] saturate-[80%] flex-1 min-h-[600px] overflow-y-auto ${
        activeTab === 'OskiHub Cal' ? 'p-0 sm:p-6' : 'p-4 sm:p-6'
      }
        ${activeTab === 'OskiHub Cal' ? 'rounded-tr-3xl lg:rounded-r-3xl' : ''}
        ${activeTab === 'Updates' ? 'rounded-tl-3xl lg:rounded-r-3xl' : ''}
        ${activeTab === 'Book A Space @ Haas' || activeTab === 'Slack' ? 'rounded-t-3xl lg:rounded-r-3xl' : ''}
      `}>
        {activeTab === 'OskiHub Cal' && (
          <div>
            {/* What's Next Widget - Horizontal Layout (PRESERVED) */}
            <div className="mb-2 lg:px-0 px-0 sm:px-6 lg:px-0">
              <CalendarListView 
                cohortEvents={cohortEvents}
                defaultCohort={selectedCohort}
                maxEvents={6}
                className="rounded-4xl"
              />
            </div>

            {/* Calendar Widget - Full Width */}
            <div className="w-full">
              <CohortCalendarWidget 
                title="Cohort Calendar" 
                daysAhead={45} 
                max={150}
                cohortEvents={cohortEvents}
                selectedCohort={selectedCohort}
                newsletterData={dashboardData?.newsletterData}
              />
            </div>
          </div>
        )}
        
        {activeTab === 'Book A Space @ Haas' && (
          <div className="text-center py-6 px-3 max-w-none">
            <h2 className="text-xl font-semibold">Reserve Space @ Haas</h2>
            <p className="text-slate-500 mb-8">Reserve study rooms, meeting spaces, and other facilities at Haas.</p>
            <div className="flex justify-center mb-8">
              <a 
                href="https://ems.haas.berkeley.edu/emswebapp/Default.aspx?_gl=1*12r8rhf*_gcl_au*MTAxMDg4Nzk5Ni4xNzU2OTMyMjU1*_ga*MTQ2MTA4MDQ1Ni4xNzQ4ODUxNTI5*_ga_EW2RSBHHX6*czE3NTcxMTg0MjUkbzU3JGcxJHQxNzU3MTE4NTU2JGo1MiRsMCRoMA.."
                target="_blank"
                rel="noopener noreferrer"
                className="relative group cursor-pointer"
                onClick={() => trackEvent('book_a_space_clicked')}
              >
                <Image 
                  src="/EMS-CAP.png" 
                  alt="EMS Space Booking System" 
                  width={900}
                  height={600}
                  className="opacity-80 max-w-xl w-full h-auto rounded-2xl shadow-lg transition-all duration-300 group-hover:opacity-80"
                  style={{
                    border: '1px dashed #ffffffff',
                    boxShadow: '0 0 20px rgba(255, 255, 255, 0.3), 0 0 40px rgba(255, 255, 255, 0.2), 0 0 60px rgba(255, 255, 255, 0.1)'
                  }}
                />
                {/* Hover overlay - positioned above image */}
                <div className="absolute inset-0 bg-blue-800/80 opacity-0 group-hover:opacity-100 transition-all duration-150 rounded-2xl flex items-center justify-center z-10">
                  <div className="text-white text-center px-6">
                    <p className="text-4xl font-light urbanist-light drop-shadow-lg">
                            <i className="material-icons w-8 align-middle ml-2">open_in_new</i> <br></br>
                      Login to<br />Haas EMS<br />through CalNet
                  
                    </p>
                  </div>
                </div>
                {/* Hover border effect overlay */}
                <div 
                  className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-all duration-300 rounded-xl pointer-events-none z-20"
                  style={{
                    border: '4px dashed #003262',
                    boxShadow: '0 0 20px rgba(255, 255, 255, 0.5), 0 0 40px rgba(255, 255, 255, 0.3), 0 0 60px rgba(255, 255, 255, 0.2)'
                  }}
                />
              </a>
            </div>
           
          </div>
        )}
        
        {activeTab === 'Updates' && (
          <div className="w-full">
            {dashboardData?.newsletterData ? (
              <>
                <NewsletterWidget data={dashboardData.newsletterData} />
                
                {/* Gmail Newsletter Widgets - latest EW Wire & Blue Crew */}
                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {GMAIL_NEWSLETTER_VARIANTS.map((variant) => (
                    <div key={variant} className="relative w-full aspect-square overflow-hidden">
                      <GmailNewsletterWidget variant={variant} selectedCohort={selectedCohort} />
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="bg-slate-800/60 backdrop-blur-sm p-6 rounded-4xl border border-slate-700 text-center">
                <div className="w-12 h-12 bg-blue-900/30 rounded-full flex items-center justify-center mx-auto mb-3 animate-pulse">
                  <span className="text-lg">🔄</span>
                </div>
                <h3 className="text-base font-semibold text-white mb-2">Loading Newsletter</h3>
                <p className="text-sm text-slate-400">
                  Fetching latest updates...
                </p>
              </div>
            )}
          </div>
        )}
        
        {activeTab === 'Slack' && (
          <div className="w-full">
            <SlackWidget />
          </div>
        )}
      </div>
    </div>
  );
}
