// Vercel Cron Job: Refresh cache at midnight
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 300 seconds (5 minutes) - Allow time for calendar processing

import { NextResponse } from 'next/server';
import { analyzeCohortMyWeekWithAI } from '@/lib/my-week-analyzer';
import { getCohortEvents } from '@/lib/icsUtils';
import { getCachedData, pipelineSet, CACHE_KEYS } from '@/lib/cache';
import { sendCronNotification } from '@/lib/notifications';
import { trackServerEvent } from '@/lib/analytics-server';
import type { UnifiedDashboardData } from '@/app/api/unified-dashboard/route';

export async function GET(request: Request) {
  // Verify this is a cron job request from Vercel
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const startTime = Date.now();

  try {
    console.log('🌙 Cron: Midnight cache refresh started...');
    
    // Fetch calendar events
    const cohortEvents = await getCohortEvents();
    
    // Try to reuse existing newsletter data from KV for richer My Week summaries
    let newsletterSections: { sections: { sectionTitle: string; items: { title: string; html: string }[] }[] } = { sections: [] };
    try {
      const cachedNewsletter = await getCachedData<UnifiedDashboardData['newsletterData']>(CACHE_KEYS.NEWSLETTER_DATA);
      if (cachedNewsletter?.data?.sections) {
        newsletterSections = { sections: cachedNewsletter.data.sections };
        console.log(`📰 Cron: Reusing ${cachedNewsletter.data.sections.length} cached newsletter sections for My Week`);
      }
    } catch (err) {
      console.warn('⚠️ Cron: Could not read cached newsletter, using empty:', err);
    }

    // Pre-generate AI summaries for both cohorts
    const myWeekData = await analyzeCohortMyWeekWithAI({
      blue: cohortEvents.blue || [],
      gold: cohortEvents.gold || []
    }, newsletterSections);
    
    // 🚀 WRITE TO CACHE — atomic pipeline write
    console.log('💾 Cron: Writing to cache (atomic pipeline)...');
    
    // Also write composite dashboard-data so unified-dashboard gets a cache hit
    // Reuse existing newsletter or provide a placeholder
    const existingDashboard = await getCachedData<UnifiedDashboardData>(CACHE_KEYS.DASHBOARD_DATA);
    const compositeData: UnifiedDashboardData = {
      newsletterData: existingDashboard?.data?.newsletterData || {
        sourceUrl: '',
        title: 'Newsletter data from morning refresh',
        sections: newsletterSections.sections.length > 0 ? newsletterSections.sections : []
      },
      myWeekData,
      cohortEvents,
      processingInfo: {
        totalTime: Date.now() - startTime,
        newsletterTime: 0,
        calendarTime: Date.now() - startTime,
        myWeekTime: 0,
        timestamp: new Date().toISOString()
      }
    };
    
    await pipelineSet([
      { key: CACHE_KEYS.COHORT_EVENTS, data: cohortEvents },
      { key: CACHE_KEYS.MY_WEEK_DATA, data: myWeekData },
      { key: CACHE_KEYS.DASHBOARD_DATA, data: compositeData },
    ], { source: 'cron' });
    
    const duration = Date.now() - startTime;
    console.log('✅ Cron: Midnight cache refresh completed (data written to KV)');
    const eventCount = (cohortEvents.blue?.length || 0) + (cohortEvents.gold?.length || 0);
    await trackServerEvent('cache_cron_completed', { success: true, durationMs: duration, eventCount });
    
    // 📧 Send success notification email
    await sendCronNotification({
      jobName: 'Midnight Cache Refresh',
      success: true,
      durationMs: duration,
      timestamp: new Date().toISOString(),
      details: {
        sectionsProcessed: eventCount,
      }
    });
    
    return NextResponse.json({
      success: true,
      message: 'Cache refreshed at midnight',
      timestamp: new Date().toISOString(),
      durationMs: duration,
      cached: {
        cohortEvents: true,
        myWeekData: true,
        dashboardData: true
      }
    });
  } catch (error) {
    console.error('❌ Cron error:', error);
    await trackServerEvent('cache_fetch_failed', { error: String(error).slice(0, 255) });
    
    // 📧 Send failure notification email
    await sendCronNotification({
      jobName: 'Midnight Cache Refresh',
      success: false,
      durationMs: Date.now() - startTime,
      timestamp: new Date().toISOString(),
      details: {
        error: String(error),
      }
    });
    
    return NextResponse.json(
      { error: 'Cache refresh failed', details: String(error) },
      { status: 500 }
    );
  }
}
