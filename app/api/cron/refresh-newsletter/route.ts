// Vercel Cron Job: Refresh newsletter at 8:10 AM Pacific
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 300 seconds (5 minutes) - AI processing takes ~76s

import { NextResponse } from 'next/server';
import { getLatestNewsletterUrl, scrapeNewsletter } from '@/lib/scrape';
import { organizeNewsletterWithAI } from '@/lib/openai-organizer';
import { extractTimeSensitiveData } from '@/lib/openai-organizer-fixed';
import { analyzeCohortMyWeekWithAI } from '@/lib/my-week-analyzer';
import { getCohortEvents } from '@/lib/icsUtils';
import { setCachedData, CACHE_KEYS } from '@/lib/cache';
import { sendCronNotification } from '@/lib/notifications';
import { trackServerEvent } from '@/lib/analytics-server';
import type { UnifiedDashboardData } from '@/app/api/unified-dashboard/route';

// Track warnings during execution for email notification
const warnings: string[] = [];

export async function GET(request: Request) {
  // Verify this is a cron job request from Vercel
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    console.log('📰 Cron: 8:10 AM newsletter refresh started...');
    const startTime = Date.now();
    
    // Fetch and process newsletter (this warms the cache!)
    console.log('🔍 Cron: Fetching latest newsletter URL...');
    const latestUrl = await getLatestNewsletterUrl();
    
    // 🛡️ FAILSAFE: Validate URL before proceeding
    if (!latestUrl || latestUrl.length < 10) {
      throw new Error('FAILSAFE: Newsletter URL is empty or invalid');
    }
    console.log('✅ Cron: URL validation passed:', latestUrl);
    
    console.log('📄 Cron: Scraping newsletter content...');
    const rawNewsletter = await scrapeNewsletter(latestUrl);
    
    // 🛡️ FAILSAFE: Validate newsletter title contains expected patterns
    const title = rawNewsletter.title || '';
    const titleLower = title.toLowerCase();
    const hasExpectedPattern = 
      titleLower.includes('bear') || 
      titleLower.includes('ewmba') || 
      titleLower.includes('haas') ||
      titleLower.includes('berkeley');
    
    if (!hasExpectedPattern) {
      console.error('⚠️ Cron FAILSAFE: Newsletter title does not match expected patterns!');
      console.error('⚠️ Cron FAILSAFE: Title received:', title);
      warnings.push(`Title doesn't match expected patterns: "${title}"`);
      // Don't throw - just log warning. Title might vary but content could still be valid.
    }
    
    // 🛡️ FAILSAFE: Validate newsletter has meaningful content
    if (!rawNewsletter.sections || rawNewsletter.sections.length === 0) {
      throw new Error('FAILSAFE: Newsletter has no sections - scraping may have failed');
    }
    console.log(`✅ Cron: Content validation passed (${rawNewsletter.sections.length} sections)`)
    
    console.log('🤖 Cron: Processing newsletter with AI...');
    const organizedNewsletter = await organizeNewsletterWithAI(rawNewsletter.sections, latestUrl, rawNewsletter.title);
    
    console.log('� Cron: Extracting time-sensitive data...');
    const enrichedNewsletter = await extractTimeSensitiveData(organizedNewsletter);
    
    console.log('�📅 Cron: Fetching calendar events...');
    const cohortEvents = await getCohortEvents();
    
    console.log('🧠 Cron: Pre-generating AI summaries...');
    const myWeekData = await analyzeCohortMyWeekWithAI({
      blue: cohortEvents.blue || [],
      gold: cohortEvents.gold || []
    }, enrichedNewsletter);
    
    // 🛡️ FAILSAFE: Extract date from newsletter title and check staleness
    const titleMatch = enrichedNewsletter.title?.match(/(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})/);
    if (titleMatch) {
      const [, month, day, year] = titleMatch;
      const fullYear = year.length === 2 ? `20${year}` : year;
      const newsletterDate = new Date(`${fullYear}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`);
      const now = new Date();
      const daysSinceNewsletter = Math.floor((now.getTime() - newsletterDate.getTime()) / (1000 * 60 * 60 * 24));
      
      console.log(`📅 Cron: Newsletter date detected: ${newsletterDate.toISOString().split('T')[0]} (${daysSinceNewsletter} days ago)`);
      
      // 🛡️ FAILSAFE: Warn if newsletter is older than 14 days
      if (daysSinceNewsletter > 14) {
        console.error(`⚠️ Cron FAILSAFE WARNING: Newsletter is ${daysSinceNewsletter} days old!`);
        console.error('⚠️ This may indicate the scraper is picking up an old newsletter.');
        warnings.push(`Newsletter is ${daysSinceNewsletter} days old - may be stale`);
        // Still proceed but log prominent warning
      }
    } else {
      console.warn('⚠️ Cron: Could not extract date from newsletter title:', organizedNewsletter.title);
      warnings.push(`Could not extract date from title: "${organizedNewsletter.title}"`);
    }
    
    // 🚀 WRITE TO CACHE (KV only - static JSON doesn't persist on Vercel's read-only filesystem)
    console.log('💾 Cron: Writing to KV cache...');
    const newsletterTime = Date.now() - startTime;
    await setCachedData(CACHE_KEYS.NEWSLETTER_DATA, enrichedNewsletter);
    await setCachedData(CACHE_KEYS.COHORT_EVENTS, cohortEvents);
    await setCachedData(CACHE_KEYS.MY_WEEK_DATA, myWeekData);
    
    // Combined dashboard data - MUST match UnifiedDashboardData shape exactly
    const dashboardData: UnifiedDashboardData = {
      newsletterData: {
        ...enrichedNewsletter,
        aiDebugInfo: enrichedNewsletter.aiDebugInfo ? {
          reasoning: enrichedNewsletter.aiDebugInfo.reasoning || 'Cron refresh',
          sectionDecisions: enrichedNewsletter.aiDebugInfo.sectionDecisions || [],
          edgeCasesHandled: enrichedNewsletter.aiDebugInfo.edgeCasesHandled || [],
          totalSections: enrichedNewsletter.aiDebugInfo.totalSections,
          processingTime: enrichedNewsletter.aiDebugInfo.processingTime || 0,
        } : undefined,
      },
      cohortEvents,
      myWeekData,
      processingInfo: {
        totalTime: Date.now() - startTime,
        newsletterTime,
        calendarTime: 0,
        myWeekTime: myWeekData.processingTime || 0,
        timestamp: new Date().toISOString(),
      },
    };
    await setCachedData(CACHE_KEYS.DASHBOARD_DATA, dashboardData);
    
    const duration = Date.now() - startTime;
    console.log(`✅ Cron: 8:10 AM newsletter refresh completed in ${duration}ms`);
    console.log('💾 Cron: All data cached in KV - users will experience INSTANT loads (~50-200ms)!');
    await trackServerEvent('newsletter_cron_completed', { success: true, durationMs: duration, hasNewsletter: true });
    
    // 📧 Send success notification email
    await sendCronNotification({
      jobName: 'Newsletter Refresh (8:10 AM)',
      success: true,
      durationMs: duration,
      timestamp: new Date().toISOString(),
      details: {
        newsletterTitle: enrichedNewsletter.title,
        newsletterUrl: latestUrl,
        sectionsProcessed: enrichedNewsletter.sections.length,
        warnings: warnings.length > 0 ? warnings : undefined,
      }
    });
    
    return NextResponse.json({
      success: true,
      message: 'Newsletter and cache refreshed at 8:10 AM',
      timestamp: new Date().toISOString(),
      newsletterUrl: latestUrl,
      durationMs: duration,
      sectionsProcessed: enrichedNewsletter.sections.length,
      cached: {
        newsletter: true,
        cohortEvents: true,
        myWeekData: true,
        dashboardData: true
      }
    });
  } catch (error) {
    console.error('❌ Cron error:', error);
    await trackServerEvent('newsletter_fetch_failed', { error: String(error).slice(0, 255) });
    
    // 📧 Send failure notification email
    await sendCronNotification({
      jobName: 'Newsletter Refresh (8:10 AM)',
      success: false,
      durationMs: Date.now() - (Date.now()), // Will be 0, but that's okay for errors
      timestamp: new Date().toISOString(),
      details: {
        error: String(error),
        warnings: warnings.length > 0 ? warnings : undefined,
      }
    });
    
    return NextResponse.json(
      { error: 'Newsletter refresh failed', details: String(error) },
      { status: 500 }
    );
  }
}
