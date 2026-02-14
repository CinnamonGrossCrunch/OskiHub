// Vercel Cron Job: Refresh cache at midnight
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 300 seconds (5 minutes) - Allow time for calendar processing

import { NextResponse } from 'next/server';
import { analyzeCohortMyWeekWithAI } from '@/lib/my-week-analyzer';
import { getCohortEvents } from '@/lib/icsUtils';
import { setCachedData, CACHE_KEYS } from '@/lib/cache';
import { sendCronNotification } from '@/lib/notifications';
import { trackServerEvent } from '@/lib/analytics-server';

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
    
    // Pre-generate AI summaries for both cohorts (no newsletter data needed for midnight refresh)
    const myWeekData = await analyzeCohortMyWeekWithAI({
      blue: cohortEvents.blue || [],
      gold: cohortEvents.gold || []
    }, { sections: [] }); // Empty newsletter data
    
    // 🚀 WRITE TO CACHE (KV + static fallback)
    console.log('💾 Cron: Writing to cache...');
    await setCachedData(CACHE_KEYS.COHORT_EVENTS, cohortEvents);
    await setCachedData(CACHE_KEYS.MY_WEEK_DATA, myWeekData);
    
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
        myWeekData: true
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
