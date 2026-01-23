'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import MainDashboardTabs from "./MainDashboardTabs";
import DashboardTabs2 from "./DashboardTabs2";
import MyWeekWidget from "./MyWeekWidget";
import WeatherWidget from "./WeatherWidget";
import TravelTimeWidget from "./TravelTimeWidget";
import HaasResourcesWidget from "./HaasResourcesWidget";
import HaasJourneyWidget from "./HaasJourneyWidget";
import CohortToggleWidget from "./CohortToggleWidget";
import AnimatedLogo from "./AnimatedLogo";
import GmailNewsletterModalHost from "./GmailNewsletterModalHost";
import { usePerformance, getPerformanceClasses } from "./PerformanceProvider";
import type { UnifiedDashboardData } from '@/app/api/unified-dashboard/route';

type CohortType = 'blue' | 'gold';

interface ClientDashboardProps {
  initialData: UnifiedDashboardData | null;
}

export default function ClientDashboard({ initialData }: ClientDashboardProps) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { glassEffectClass, capabilities, shouldUseReducedMotion } = usePerformance();
  const [selectedCohort, setSelectedCohort] = useState<CohortType>('blue');
  const [dashboardData, setDashboardData] = useState<UnifiedDashboardData | null>(initialData);
  const [loading, setLoading] = useState(!initialData);
  
  // Header animation states
  const [showLogo, setShowLogo] = useState(false);
  const [overlayOpacity, setOverlayOpacity] = useState(100);
  
  // Dynamic layout state - track if DashboardTabs2 is taller than MainDashboardTabs
  const [isDash2Taller, setIsDash2Taller] = useState(false);

  // Fetch data if not provided (client-side fetching)
  useEffect(() => {
    if (!initialData) {
      console.log('🔄 Fetching unified dashboard data...');
      const controller = new AbortController();

      fetch('/api/unified-dashboard', {
        signal: controller.signal,
        headers: {
          'Cache-Control': 'no-cache',
        }
      })
        .then(res => {
          if (!res.ok) {
            throw new Error(`HTTP ${res.status}: ${res.statusText}`);
          }
          return res.json();
        })
        .then(data => {
          console.log('✅ Dashboard data loaded:', {
            hasNewsletter: !!data.newsletterData,
            hasMyWeek: !!data.myWeekData,
            hasCalendar: !!data.cohortEvents,
            newsletterSections: data.newsletterData?.sections?.length || 0,
            blueEvents: data.cohortEvents?.blue?.length || 0,
            goldEvents: data.cohortEvents?.gold?.length || 0,
          });
          setDashboardData(data);
          setLoading(false);
        })
        .catch(error => {
          // Ignore AbortError - this is expected when component unmounts during fetch
          if (error.name === 'AbortError') {
            return;
          }
          console.error('❌ Error fetching dashboard data:', error);
          setLoading(false);
          // Don't set dashboardData to null - leave it as is so components can handle undefined
        });

      return () => {
        controller.abort();
      };
    }
  }, [initialData]);

  // Load cohort preference from localStorage on mount, but default to blue
  useEffect(() => {
    const saved = localStorage.getItem('global-cohort-preference');
    // Always default to blue, only change if explicitly saved as gold
    if (saved === 'gold') {
      setSelectedCohort('gold');
    } else {
      setSelectedCohort('blue');
    }
  }, []);

  // Header animation sequence
  useEffect(() => {
    // Wait 1 second, then show logo to trigger animation
    const logoTimer = setTimeout(() => {
      setShowLogo(true);
    }, 1000);

    // Quick fade-out of black overlay after logo appears (300ms)
    const overlayTimer = setTimeout(() => {
      setOverlayOpacity(0);
    }, 1800); // 1.8s delay

    return () => {
      clearTimeout(logoTimer);
      clearTimeout(overlayTimer);
    };
  }, []);

  // Save cohort preference to localStorage
  useEffect(() => {
    localStorage.setItem('global-cohort-preference', selectedCohort);
  }, [selectedCohort]);

  const handleCohortChange = (cohort: CohortType) => {
    setSelectedCohort(cohort);
  };
  
  // Check heights after data loads and on resize
  useEffect(() => {
    const checkHeights = () => {
      const mainDash = document.getElementById('main-dashboard-tabs');
      const dash2 = document.getElementById('dashboard-tabs-2');
      
      if (mainDash && dash2) {
        const mainHeight = mainDash.offsetHeight;
        const dash2Height = dash2.offsetHeight;
        // Only consider Dash2 "taller" if it exceeds MainDash by more than 10px (buffer for rounding)
        setIsDash2Taller(dash2Height > mainHeight + 10);
      }
    };
    
    // Check on mount and when data changes
    // Multiple delays to catch content as it renders
    setTimeout(checkHeights, 100);
    setTimeout(checkHeights, 500);
    setTimeout(checkHeights, 1000);
    setTimeout(checkHeights, 2000);
    
    // Check on window resize
    window.addEventListener('resize', checkHeights);
    return () => window.removeEventListener('resize', checkHeights);
  }, [initialData]);
  
  return (
    <div className="relative z-0 min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Background Image Layer */}
      <div className="fixed inset-0 -z-10 pointer-events-none bg-[url('/haas_bkg_2.png')] bg-cover bg-center bg-no-repeat bg-fixed"></div>
      
      {/* Dark Overlay - Fallback for browsers without mix-blend support */}
      <div className="fixed inset-0 -z-10 pointer-events-none bg-black/50 supports-[mix-blend-mode:multiply]:hidden"></div>
      
      {/* Dark Overlay - Gradient blend for browsers with support */}
      <div className="fixed inset-0 -z-10 pointer-events-none bg-gradient-to-b from-black/60 to-black/20 mix-blend-multiply hidden supports-[mix-blend-mode:multiply]:block"></div>
      
      {/* Animated logo - z-index 100 (highest layer) - anchored to top with max-w-[90rem] alignment */}
      <div className="fixed top-0 left-0 right-0 z-[100] pointer-events-none">
        <div className="max-w-[90rem] mx-auto px-3 sm:px-4 lg:px-6 py-3.5  md:py-4.5">
          <div className="h-9 w-auto flex items-center">
            {showLogo && (
              <div className="pointer-events-auto">
                <AnimatedLogo
                  videoSrc="/oskihub_anim.mp4"
                  fallbackImageSrc="/oskihub_anim_still.png"
                  alt="OskiHub Logo"
                  width={80}
                  height={36}
                  className="h-full w-auto object-contain"
                  playOnce={true}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Content Overlay */}
      <div
          className="fixed inset-0 z-50 overflow-auto max-w-100 scrollbar-hide"
          style={{ 
            scrollbarGutter: 'stable both-edges',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none'
          }}>
        {/* Header */}
        <div className={getPerformanceClasses(
          `w-full sticky top-0 z-30 bg-black/10 border-b border-red-600 backdrop-blur-lg relative overflow-hidden py-1 mb-0`,
          capabilities
        )}>
          {/* Animated black overlay - z-index 20 (middle layer) */}
          <div 
            className="absolute inset-0 bg-black transition-opacity duration-300 ease-out pointer-events-none z-20"
            style={{ opacity: overlayOpacity / 100 }}
          />

          <div className="pointer-events-none absolute flex justify-left inset-0" style={{ maskImage: 'radial-gradient(circle at 30% 25%, rgba(0,0,0,.7), transparent 70%)', WebkitMaskImage: 'radial-gradient(circle at 30% 25%, rgba(0,0,0,.7), transparent 70%)', filter: 'url(#glassDistort)' }} />

        <div className="max-w-[90rem] mx-auto px-3 sm:px-4 lg:px-6 py-2 relative z-10">
          <div className="flex items-center h-10 sm:h-12 md:h-12">
            {/* Left section - Logos */}
            <div className="flex-1 flex items-center gap-1 sm:gap-2 h-full px-1">
          
              {/* Spacer to reserve space for absolutely positioned logo */}
              <div className="min-w-[80px] h-9 flex items-center"></div>
            
            {/* Center section */}
            
            </div> {/* Close Left section */}
            
            {/* Right section - Cohort Toggle */}
            <div className="flex-1 flex items-center justify-end h-full px-1 relative z-50">
              <CohortToggleWidget 
          selectedCohort={selectedCohort}
          onCohortChange={handleCohortChange}
          className=""
              />
            </div>
          </div>
        </div>
        </div> {/* Close Header */}
        
      {/* Main Content */}
      <main className="max-w-[90rem] mx-auto px-3  sm:px-0 lg:px-4 py-0 relative">
        {/* Animated black overlay - z-index 20 (middle layer) */}
          <div 
            className="fixed inset-0 bg-black transition-opacity duration-300 ease-out pointer-events-none z-45"
            style={{ opacity: overlayOpacity / 100 }}
          />
        {/* Section A: Haas Journey (Full Width Row) */}
        <div className="mb-0 border-b border-slate-700">
          <HaasJourneyWidget />
        </div>
      
  
        {/* Section B: My Week Widget and Weather Widget */}
        <div className="flex flex-col lg:flex-row mt-2 lg:py-2 mb-0 gap-0 items-start -mx-3 sm:mx-0 lg:mx-0 transition-all duration-500 ease-in-out">
          {/* Weather Widget - Side by side on small/medium, right-aligned, above My Week */}
          <div className="flex-shrink-0 flex items-start justify-end w-full lg:w-auto lg:order-2 lg:min-w-0 mb-0 px-3 sm:px-0 transition-all duration-500 ease-in-out">
            <div className="w-full lg:w-auto flex flex-row lg:flex-col gap-0 min-w-0 justify-end">
              {/* Weather and Travel - side by side on small/medium, stacked on large */}
              <WeatherWidget />
              <TravelTimeWidget />
            </div>
          </div>
          
          {/* My Week Widget - Grows to fill available space, below weather on small/medium */}
          <div className="flex-grow flex items-center min-w-0 w-full lg:order-1 transition-all duration-500 ease-in-out">
            {!loading && dashboardData && (
              <MyWeekWidget 
                data={dashboardData.myWeekData}
                selectedCohort={selectedCohort}
              />
            )}
            {loading && (
              <div className="text-center w-full py-5">
                <div className="page-loading-spinner mx-auto"></div>
                <p className="mt-4 text-sm text-white">Loading dashboard...</p>
              </div>
            )}
          </div>
        </div>
        
        {/* Section C: Dashboard Tabs */}
        <div className="grid grid-cols-1 lg:grid-cols-8 lg:auto-rows-min gap-1 mt-4 mb-6 -mx-3 sm:mx-0 lg:mx-0 transition-[margin-top,transform] duration-1200 ease-in-out will-change-transform">
          {/* Left Column: MainDashboardTabs - Always 6 columns on large screens */}
          <div className="lg:col-span-6 lg:row-span-1">
            <div id="main-dashboard-tabs" className="transition-all duration-700 ease-in-out">{/* Removed px-3 sm:px-0 lg:px-0 - let parent grid handle spacing */}
              {!loading && dashboardData && (
                <MainDashboardTabs 
                  cohortEvents={{
                    blue: dashboardData.cohortEvents?.blue || [],
                    gold: dashboardData.cohortEvents?.gold || [],
                    original: dashboardData.cohortEvents?.original || [],
                    launch: dashboardData.cohortEvents?.launch || [],
                    calBears: dashboardData.cohortEvents?.calBears || [],
                    campusGroups: dashboardData.cohortEvents?.campusGroups || [],
                    academicCalendar: dashboardData.cohortEvents?.academicCalendar || []
                  }}
                  selectedCohort={selectedCohort}
                  dashboardData={dashboardData}
                />
              )}
            </div>
          </div>
          
          {/* Right Column: DashboardTabs2 - Hidden on small screens, spans 2 rows conditionally */}
          <div className={`hidden lg:block lg:col-span-2 ${isDash2Taller ? 'lg:row-span-2' : 'lg:row-span-1'}`}>
            <div id="dashboard-tabs-2" className="lg:min-h-full transition-all duration-700 ease-in-out">
              {!loading && dashboardData && (
                <DashboardTabs2 dashboardData={dashboardData} selectedCohort={selectedCohort} />
              )}
            </div>
          </div>
          
          {/* Haas Resources Widget - Dynamic width: 6 cols if Dash2 is taller, otherwise full 8 cols in new row */}
          {isDash2Taller ? (
            <div className="lg:col-span-6 lg:row-span-1 mt-1 lg:mt-0 transition-all duration-700 ease-in-out">
              <HaasResourcesWidget />
            </div>
          ) : (
            <div className="lg:col-span-8 lg:row-span-1 mt-1 lg:mt-0 transition-all duration-700 ease-in-out">
              <HaasResourcesWidget />
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="mt-8 pb-6">
        <div className="max-w-[90rem] mx-auto px-3 sm:px-4 lg:px-6">
            <p className="text-center text-xs text-slate-400 mb-4">
              Oski.app created and maintained by <a href="https://www.linkedin.com/in/designrefinerepeat/" target="_blank" rel="noopener noreferrer" className="text-slate-300 hover:text-slate-300 transition-colors duration-200">Matt Gross</a>. &nbsp;|  &nbsp; Not an officially endorsed UC Berkeley website.
            </p>
          <div className="flex justify-end">
            <Link 
              href="/admin/cache-refresh"
              className="text-xs text-slate-500 hover:text-slate-300 transition-colors duration-200"
            >
              Admin Console
            </Link>
          </div>
        </div>
      </footer>

      <GmailNewsletterModalHost />
    </div>
  </div>
  );
}
