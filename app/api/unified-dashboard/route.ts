// Node runtime required for OpenAI and cheerio
export const runtime = 'nodejs';
// Force dynamic to prevent ANY prerendering during build - absolutely critical for Vercel
export const dynamic = 'force-dynamic';
// Revalidate doesn't work with force-dynamic, but we'll use Cache-Control headers instead
export const fetchCache = 'force-no-store';
// Set maximum function duration to 200 seconds for Vercel (AI processing takes ~72s, need buffer)
export const maxDuration = 200;

import { NextResponse } from 'next/server';
import { getLatestNewsletterUrl, scrapeNewsletter } from '@/lib/scrape';
import { organizeNewsletterWithAI, type OrganizedNewsletter } from '@/lib/openai-organizer';
import { analyzeCohortMyWeekWithAI, type CohortMyWeekAnalysis } from '@/lib/my-week-analyzer';
import { getCohortEvents, type CalendarEvent } from '@/lib/icsUtils';
import { getCachedData, setCachedData, CACHE_KEYS } from '@/lib/cache';

const safeError = (...args: unknown[]) => {
  // Always log errors, but ensure they don't leak into response
  if (process.env.NODE_ENV === 'development') {
    console.error(...args);
  }
};

export interface UnifiedDashboardData {
  // Newsletter data for NewsletterWidget
  newsletterData: {
    sourceUrl: string;
    title?: string;
    sections: {
      sectionTitle: string;
      items: {
        title: string;
        html: string;
        timeSensitive?: {
          dates: string[];
          deadline?: string;
          eventType: 'deadline' | 'event' | 'announcement' | 'reminder';
          priority: 'high' | 'medium' | 'low';
        };
      }[];
    }[];
    aiDebugInfo?: {
      reasoning: string;
      sectionDecisions: string[];
      edgeCasesHandled: string[];
      totalSections: number;
  processingTime: number;
  model?: string;
  modelsTried?: string[];
  modelLatency?: number;
    };
  };
  
  // My Week data for MyWeekWidget - now supports both cohorts with enhanced categorization
  myWeekData: {
    weekStart: string;
    weekEnd: string;
    blueEvents: {
      date: string;
      time?: string;
      title: string;
      type: 'assignment' | 'class' | 'exam' | 'administrative' | 'social' | 'newsletter' | 'other';
      priority?: 'high' | 'medium' | 'low';
      description?: string;
      location?: string;
      url?: string;
    }[];
    goldEvents: {
      date: string;
      time?: string;
      title: string;
      type: 'assignment' | 'class' | 'exam' | 'administrative' | 'social' | 'newsletter' | 'other';
      priority?: 'high' | 'medium' | 'low';
      description?: string;
      location?: string;
      url?: string;
    }[];
    blueSummary: string;
    goldSummary: string;
    processingTime: number;
  };
  
  // Calendar data for any components that need raw calendar events
  cohortEvents: {
    blue?: CalendarEvent[];
    gold?: CalendarEvent[];
    original?: CalendarEvent[];
    launch?: CalendarEvent[];
    calBears?: CalendarEvent[];
    campusGroups?: CalendarEvent[];
    academicCalendar?: CalendarEvent[];
  };
  
  // Processing metadata
  processingInfo: {
    totalTime: number;
    newsletterTime: number;
    calendarTime: number;
    myWeekTime: number;
    timestamp: string;
  };
}

export async function GET(request: Request) {
  // CRITICAL: Prevent execution during Vercel build ONLY (not local development)
  // During Vercel build: CI=true and NEXT_PHASE='phase-production-build'
  // During local dev: Neither CI nor NEXT_PHASE are set
  // During runtime: VERCEL_ENV is set (development/preview/production)
  const isVercelBuild = process.env.CI === 'true' && !process.env.VERCEL_ENV;
  
  if (isVercelBuild) {
    return NextResponse.json(
      { error: 'Build-time execution prevented' },
      { 
        status: 503,
        headers: {
          'Cache-Control': 'no-store, must-revalidate',
        }
      }
    );
  }

  const startTime = Date.now();
  
  // Check for force-refresh query parameter to bypass cache
  const url = new URL(request.url);
  const forceRefresh = url.searchParams.get('refresh') === 'true';
  
  // 🚀 TRY CACHE FIRST (INSTANT LOADS ~50-200ms!) - unless force refresh requested
  if (!forceRefresh) {
    console.log('🔍 [API] Checking cache for pre-rendered dashboard data...');
    const cachedDashboard = await getCachedData<UnifiedDashboardData>(CACHE_KEYS.DASHBOARD_DATA);
    
    if (cachedDashboard) {
      console.log(`✅ [API] CACHE HIT from ${cachedDashboard.source}! Returning pre-rendered data (${Date.now() - startTime}ms)`);
      return NextResponse.json(cachedDashboard.data, {
        headers: {
          'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200',
          'X-Cache-Source': cachedDashboard.source, // Debug header showing cache source
          'X-Response-Time': `${Date.now() - startTime}ms`
        }
      });
    }
  } else {
    console.log('🔄 [API] Force refresh requested - bypassing cache and regenerating data...');
  }
  
  console.log('⚠️ [API] Cache miss - generating fresh data (this may take 8-20 seconds)...');
  
  const INTERNAL_TIMEOUT = 200000; // 200 seconds - allow newsletter AI processing (up to 180s) + calendar/weather
  
  // Create overall timeout promise
  const timeoutPromise = new Promise<never>((_, reject) => 
    setTimeout(() => reject(new Error('Internal timeout - processing took too long')), INTERNAL_TIMEOUT)
  );
  
  try {
    // Race the main processing against the overall timeout
    const result = await Promise.race([
      (async () => {
        // Start all data fetching operations in parallel with individual timeouts
        const [newsletterResult, calendarResult] = await Promise.allSettled([
          // Newsletter data fetch and AI organization with 180s timeout (AI can take 2+ minutes)
          Promise.race([
            (async () => {
              const newsletterStart = Date.now();
              console.log('📰 [API] Starting newsletter fetch pipeline...');
              
              console.log('📰 [API] Step 1/4: Getting latest newsletter URL...');
              const latest = await getLatestNewsletterUrl();
              console.log('📰 [API] Step 1/4 completed:', Date.now() - newsletterStart, 'ms');
              
              console.log('📰 [API] Step 2/4: Scraping newsletter content...');
              const scrapeStart = Date.now();
              const rawData = await scrapeNewsletter(latest);
              console.log('📰 [API] Step 2/4 completed:', Date.now() - scrapeStart, 'ms');
              
              console.log('📰 [API] Step 3/4: Organizing with AI (gpt-4o-mini)...');
              const organizeStart = Date.now();
              // First: Organize content with fast model
              const organizedData = await organizeNewsletterWithAI(
                rawData.sections, 
                rawData.sourceUrl, 
                rawData.title
              );
              console.log('📰 [API] Step 3/4 completed:', Date.now() - organizeStart, 'ms');
              
              console.log('📰 [API] Step 4/4: Extracting time-sensitive data (hybrid approach)...');
              const extractStart = Date.now();
              // Second: Extract dates with focused prompt
              const { extractTimeSensitiveData } = await import('@/lib/openai-organizer-fixed');
              const enrichedData = await extractTimeSensitiveData(organizedData);
              console.log('📰 [API] Step 4/4 completed:', Date.now() - extractStart, 'ms');
              console.log('✅ [API] Newsletter pipeline completed:', Date.now() - newsletterStart, 'ms total');
              
              return {
                data: enrichedData,
                processingTime: Date.now() - newsletterStart
              };
            })(),
            new Promise<never>((_, reject) => 
              setTimeout(() => {
                console.error('❌ [API] Newsletter timeout after 300 seconds!');
                reject(new Error('Newsletter timeout (300s)'));
              }, 300000)
            )
          ]),
          
          // Calendar data fetch with 10s timeout
          Promise.race([
            (async () => {
              const calendarStart = Date.now();
              
              const cohortEvents = await getCohortEvents(150, 150); // Extended to 150 days ahead to show December events
              
              return {
                data: cohortEvents,
                processingTime: Date.now() - calendarStart
              };
            })(),
            new Promise<never>((_, reject) => 
              setTimeout(() => reject(new Error('Calendar timeout (10s)')), 10000)
            )
          ])
        ]);
        
        // Handle newsletter result with fallback
        let newsletterData: OrganizedNewsletter;
        let newsletterTime = 0;
        
        if (newsletterResult.status === 'fulfilled') {
          newsletterData = newsletterResult.value.data;
          newsletterTime = newsletterResult.value.processingTime;
        } else {
          safeError('⚠️ Newsletter timeout, using fallback:', newsletterResult.reason);
          newsletterData = {
            sourceUrl: '',
            title: 'Newsletter Temporarily Unavailable',
            sections: [{
              sectionTitle: 'System Message',
              items: [{
                title: 'Loading',
                html: '<p>Newsletter is taking longer than expected. Please refresh or try again in a moment.</p>'
              }]
            }],
            aiDebugInfo: {
              reasoning: 'timeout',
              sectionDecisions: [],
              edgeCasesHandled: [],
              totalSections: 0,
              processingTime: 0,
              model: 'fallback',
              modelsTried: [],
              modelLatency: 0
            }
          };
        }
        
        // Handle calendar result with fallback
        let cohortEvents;
        let calendarTime = 0;
        
        if (calendarResult.status === 'fulfilled') {
          cohortEvents = calendarResult.value.data;
          calendarTime = calendarResult.value.processingTime;
        } else {
          safeError('⚠️ Calendar timeout, using fallback:', calendarResult.reason);
          cohortEvents = {
            blue: [],
            gold: [],
            original: [],
            launch: [],
            calBears: [],
            campusGroups: [],
            academicCalendar: []
          };
        }
        
        // Now run My Week AI analysis with the fetched data (15s timeout)
        const myWeekStart = Date.now();
        
        let myWeekData: CohortMyWeekAnalysis;
        let myWeekTime = 0;
        
        try {
          myWeekData = await Promise.race([
            analyzeCohortMyWeekWithAI(cohortEvents, newsletterData),
            new Promise<never>((_, reject) => 
              setTimeout(() => reject(new Error('My Week timeout (60s)')), 60000)
            )
          ]);
          myWeekTime = Date.now() - myWeekStart;
        } catch (error) {
          safeError('⚠️ My Week timeout, using fallback:', error);
          // Provide fallback data with correct structure
          const now = new Date();
          const weekStart = new Date(now.setDate(now.getDate() - now.getDay()));
          const weekEnd = new Date(weekStart.getTime() + 6 * 24 * 60 * 60 * 1000);
          
          myWeekData = {
            weekStart: weekStart.toISOString(),
            weekEnd: weekEnd.toISOString(),
            blueEvents: [],
            goldEvents: [],
            blueSummary: 'My Week analysis temporarily unavailable. Calendar events still accessible in Calendar tab.',
            goldSummary: 'My Week analysis temporarily unavailable. Calendar events still accessible in Calendar tab.',
            processingTime: 0
          };
          myWeekTime = Date.now() - myWeekStart;
        }
        
        const totalTime = Date.now() - startTime;
        
        const response: UnifiedDashboardData = {
          newsletterData: {
            ...newsletterData,
            // Ensure aiDebugInfo matches expected type
            aiDebugInfo: newsletterData.aiDebugInfo ? {
              reasoning: newsletterData.aiDebugInfo.reasoning || 'AI processing completed',
              sectionDecisions: newsletterData.aiDebugInfo.sectionDecisions || [],
              edgeCasesHandled: newsletterData.aiDebugInfo.edgeCasesHandled || [],
              totalSections: newsletterData.aiDebugInfo.totalSections,
              processingTime: newsletterData.aiDebugInfo.processingTime || 0
            } : undefined
          },
          myWeekData,
          cohortEvents,
          processingInfo: {
            totalTime,
            newsletterTime,
            calendarTime,
            myWeekTime,
            timestamp: new Date().toISOString()
          }
        };
        // Attach aiMeta if present
        // @ts-expect-error augment for debug
        response.newsletterData.aiMeta = {
          model: response.newsletterData.aiDebugInfo?.model,
          modelsTried: response.newsletterData.aiDebugInfo?.modelsTried,
          ms: response.newsletterData.aiDebugInfo?.modelLatency
        };
        // @ts-expect-error augment for debug
        response.myWeekData.aiMeta = (myWeekData as CohortMyWeekAnalysis).aiMeta;
        
        // 🚀 CRITICAL FIX: Write fresh data back to cache for next request!
        // This ensures that even on cache miss, subsequent requests will be instant
        console.log('💾 [API] Writing fresh data to cache (KV + static JSON)...');
        try {
          await setCachedData(CACHE_KEYS.DASHBOARD_DATA, response, { writeStatic: true });
          console.log('✅ [API] Cache write successful - next request will be instant!');
        } catch (cacheError) {
          console.error('⚠️ [API] Cache write failed (non-fatal):', cacheError);
          // Don't fail the request if cache write fails
        }
        
        return NextResponse.json(response, { 
          status: 200,
          headers: {
            'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
            'X-Cache-Source': forceRefresh ? 'force-refresh' : 'fresh-computed', // Debug header showing source
            'X-Response-Time': `${totalTime}ms`,
            'X-Force-Refresh': forceRefresh ? 'true' : 'false'
          }
        });
      })(),
      timeoutPromise
    ]);
    
    return result as Response;
    
  } catch (error) {
    const totalTime = Date.now() - startTime;
    safeError('💥 Unified Dashboard timeout or error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    // Return 200 with degraded data instead of 500/504 to prevent hard failures
    const now = new Date();
    const weekStart = new Date(now.setDate(now.getDate() - now.getDay()));
    const weekEnd = new Date(weekStart.getTime() + 6 * 24 * 60 * 60 * 1000);
    
    return NextResponse.json(
      { 
        error: 'Dashboard data loading slower than expected', 
        details: errorMessage,
        newsletterData: {
          sourceUrl: '',
          title: 'Loading...',
          sections: [{
            sectionTitle: 'System Message',
            items: [{
              title: 'Still Loading',
              html: '<p>Dashboard taking longer than expected. Please refresh the page.</p>'
            }]
          }],
          aiDebugInfo: {
            reasoning: 'timeout',
            sectionDecisions: [],
            edgeCasesHandled: [],
            totalSections: 0,
            processingTime: 0,
            model: 'error',
            modelsTried: [],
            modelLatency: 0
          }
        },
        myWeekData: {
          weekStart: weekStart.toISOString(),
          weekEnd: weekEnd.toISOString(),
          blueEvents: [],
          goldEvents: [],
          blueSummary: 'My Week data still loading...',
          goldSummary: 'My Week data still loading...',
          processingTime: 0
        },
        cohortEvents: {
          blue: [],
          gold: [],
          original: [],
          launch: [],
          calBears: [],
          campusGroups: [],
          academicCalendar: []
        },
        processingInfo: {
          totalTime,
          newsletterTime: 0,
          calendarTime: 0,
          myWeekTime: 0,
          timestamp: new Date().toISOString()
        }
      },
      { 
        status: 200, // Return 200 with degraded data instead of 500/504
        headers: {
          // Shorter cache for error responses (5 min vs 1 hour)
          'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=3600',
        }
      }
    );
  }
}
