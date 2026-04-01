// Node runtime required for cheerio
export const runtime = 'nodejs';
// Force dynamic to prevent ANY prerendering during build - absolutely critical for Vercel
export const dynamic = 'force-dynamic';
// Revalidate doesn't work with force-dynamic, but we'll use Cache-Control headers instead
export const fetchCache = 'force-no-store';
// Set maximum function duration to 180 seconds (AI processing takes ~72s, need buffer)
export const maxDuration = 180;

import { NextResponse } from 'next/server';
import { getLatestNewsletterUrl, scrapeNewsletter } from '@/lib/scrape';
import { organizeNewsletterWithAI } from '@/lib/openai-organizer';
import { getCachedData, setCachedData, CACHE_KEYS, type CacheKey } from '@/lib/cache';

// Safe logging that won't contaminate API responses
const safeLog = (...args: unknown[]) => {
  if (process.env.NODE_ENV === 'development') {
    console.log(...args);
  }
};

export async function GET() {
  // CRITICAL: Prevent execution during Vercel build ONLY (not local development)
  // During Vercel build: CI=true and VERCEL_ENV is not set
  // During local dev: Neither CI nor VERCEL_ENV are set
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

  try {
    // 🚀 TRY CACHE FIRST (INSTANT LOADS ~50-200ms!)
    safeLog('🔍 [Newsletter API] Checking cache for pre-rendered newsletter data...');
    const cachedNewsletter = await getCachedData(CACHE_KEYS.NEWSLETTER_DATA);
    
    if (cachedNewsletter) {
      safeLog(`✅ [Newsletter API] CACHE HIT from ${cachedNewsletter.store}! Returning pre-rendered data (${Date.now() - startTime}ms)`);
      return NextResponse.json(cachedNewsletter.data, {
        headers: {
          'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200',
          'X-Cache-Source': cachedNewsletter.store,
          'X-Response-Time': `${Date.now() - startTime}ms`
        }
      });
    }
    
    safeLog('⚠️ [Newsletter API] Cache miss - generating fresh data...');
    
    safeLog('Newsletter API: Starting request');
    const latest = await getLatestNewsletterUrl();
    safeLog('Newsletter API: Latest URL found:', latest);
    const rawData = await scrapeNewsletter(latest);
    safeLog('Newsletter API: Data scraped successfully');
    
    // Use OpenAI to organize the content intelligently
    const organizedData = await organizeNewsletterWithAI(
      rawData.sections, 
      rawData.sourceUrl, 
      rawData.title
    );
    safeLog('Newsletter API: Content organized with AI');
    
    // � Write fresh data back to cache — use source 'api' so cron-enriched data
    // (which includes extractTimeSensitiveData) won't be overwritten by less-enriched data.
    safeLog('💾 [Newsletter API] Writing fresh data to cache...');
    try {
      await setCachedData(CACHE_KEYS.NEWSLETTER_DATA as CacheKey, organizedData, { 
        source: 'api',
        writeStatic: process.env.NODE_ENV === 'development' 
      });
      safeLog('✅ [Newsletter API] Cache write successful - next request will be instant!');
    } catch (cacheError) {
      console.error('⚠️ [Newsletter API] Cache write failed (non-fatal):', cacheError);
    }
    
    return NextResponse.json(organizedData, { 
      status: 200,
      headers: {
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
        'X-Cache-Source': 'fresh-computed',
        'X-Response-Time': `${Date.now() - startTime}ms`
      }
    });
  } catch (err: unknown) {
    if (process.env.NODE_ENV === 'development') {
      console.error('Newsletter API Error:', err);
    }
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to load newsletter data', details: errorMessage },
      { status: 500 }
    );
  }
}
