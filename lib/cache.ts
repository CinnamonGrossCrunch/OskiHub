/**
 * Hybrid Cache System (Option C)
 * 
 * Combines Upstash Redis KV (fast edge caching) with static JSON fallback (free tier resilience).
 * 
 * Flow:
 * 1. Cron jobs write to KV (instantaneous reads for users)
 * 2. If KV unavailable/empty, fallback to static JSON in public/cache/
 * 3. If both fail, caller can regenerate fresh data
 * 
 * Performance:
 * - KV hit: ~50-200ms (instantaneous)
 * - Static fallback: ~500-1000ms (acceptable)
 * - Fresh regeneration: ~8-20s (only if cache completely fails)
 */

import { Redis } from '@upstash/redis';

// Initialize Upstash Redis client (only if env vars are set)
let kv: Redis | null = null;

try {
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    kv = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
    console.log('✅ [Cache] Upstash Redis KV initialized');
  } else {
    console.warn('⚠️ [Cache] Upstash Redis credentials not found - using static fallback only');
  }
} catch (err) {
  console.error('❌ [Cache] Failed to initialize Upstash Redis:', err);
}

// Cache key constants
export const CACHE_KEYS = {
  NEWSLETTER_DATA: 'newsletter-data',
  MY_WEEK_DATA: 'myweek-data',
  DASHBOARD_DATA: 'dashboard-data',
  COHORT_EVENTS: 'cohort-events-v2', // v2: Fixed UTC vs floating time parsing
} as const;

// Cache TTL (time-to-live) - 8 hours (28800 seconds)
const CACHE_TTL = 28800;

/**
 * Get cached data from KV (primary) or static JSON (fallback)
 */
export async function getCachedData<T>(key: string): Promise<{ data: T; source: 'kv' | 'static' } | null> {
  // Skip cache in development mode ONLY for ICS calendar data (for real-time ICS updates)
  // Keep caching for dashboard/newsletter/AI content to avoid expensive reprocessing (~100s)
  const skipCacheInDev = process.env.NODE_ENV === 'development' && 
                         key === CACHE_KEYS.COHORT_EVENTS;
  
  if (skipCacheInDev) {
    console.log(`🔧 [Cache] DEV MODE: Skipping cache for ICS calendar data: ${key}`);
    return null;
  }
  
  // Try KV first (instantaneous)
  if (kv) {
    try {
      const kvData = await kv.get<T>(key);
      if (kvData) {
        console.log(`✅ [Cache] KV hit for key: ${key}`);
        return { data: kvData, source: 'kv' };
      } else {
        console.log(`⚠️ [Cache] KV miss for key: ${key}`);
      }
    } catch (err) {
      console.warn(`⚠️ [Cache] KV read failed for key ${key}:`, err);
    }
  }

  // Fallback to static JSON (if available)
  try {
    const staticPath = `/cache/${key}.json`;
    console.log(`📂 [Cache] Attempting static fallback: ${staticPath}`);
    
    // Use dynamic import for server-side file reading
    const fs = await import('fs/promises');
    const path = await import('path');
    
    const publicDir = path.join(process.cwd(), 'public');
    const filePath = path.join(publicDir, 'cache', `${key}.json`);
    
    const fileContent = await fs.readFile(filePath, 'utf-8');
    const staticData = JSON.parse(fileContent) as T;
    
    console.log(`✅ [Cache] Static fallback hit for key: ${key}`);
    return { data: staticData, source: 'static' };
  } catch (err) {
    console.warn(`⚠️ [Cache] Static fallback failed for key ${key}:`, err);
  }

  // Both KV and static fallback failed
  console.log(`❌ [Cache] Complete cache miss for key: ${key}`);
  return null;
}

/**
 * Set cached data in KV (primary).
 * 
 * NOTE: Static JSON fallback (public/cache/) does NOT work on Vercel.
 * Vercel's serverless filesystem is read-only — writes to public/ are
 * ephemeral and lost on cold start. Static JSON is only useful for local
 * development seeding. The writeStatic option is kept for local dev only.
 */
export async function setCachedData<T>(
  key: string, 
  data: T, 
  options: { 
    writeStatic?: boolean; // Only works in local dev — Vercel fs is read-only
    ttl?: number; // Custom TTL in seconds (defaults to CACHE_TTL)
  } = {}
): Promise<void> {
  const { writeStatic = false, ttl = CACHE_TTL } = options;

  // Write to KV (primary cache)
  if (kv) {
    try {
      await kv.set(key, data, { ex: ttl });
      console.log(`✅ [Cache] KV write successful for key: ${key} (TTL: ${ttl}s)`);
    } catch (err) {
      console.error(`❌ [Cache] KV write failed for key ${key}:`, err);
    }
  } else {
    console.warn(`⚠️ [Cache] KV not available - skipping KV write for key: ${key}`);
  }

  // Static JSON fallback — only attempt in local development (Vercel fs is read-only)
  if (writeStatic && process.env.NODE_ENV === 'development') {
    try {
      const fs = await import('fs/promises');
      const path = await import('path');
      
      const publicDir = path.join(process.cwd(), 'public');
      const cacheDir = path.join(publicDir, 'cache');
      
      // Ensure cache directory exists
      await fs.mkdir(cacheDir, { recursive: true });
      
      const filePath = path.join(cacheDir, `${key}.json`);
      await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
      
      console.log(`✅ [Cache] Static JSON write successful (dev only): ${filePath}`);
    } catch (err) {
      console.error(`❌ [Cache] Static JSON write failed for key ${key}:`, err);
    }
  }
}

/**
 * Delete cached data (useful for manual cache invalidation)
 */
export async function deleteCachedData(key: string): Promise<void> {
  if (kv) {
    try {
      await kv.del(key);
      console.log(`✅ [Cache] Deleted KV key: ${key}`);
    } catch (err) {
      console.error(`❌ [Cache] Failed to delete KV key ${key}:`, err);
    }
  }
}

/**
 * Check if KV is available (useful for conditional logic)
 */
export function isKVAvailable(): boolean {
  return kv !== null;
}
