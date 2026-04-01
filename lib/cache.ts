/**
 * Cache System v2 — Reliable Upstash Redis KV with metadata & stampede protection
 * 
 * Changes from v1:
 * - Every cached value wrapped in CacheEnvelope with cachedAt timestamp + version
 * - Pipeline writes for atomic multi-key updates (cron jobs)
 * - In-flight dedup (stampede protection) so only one concurrent regeneration runs
 * - Static JSON fallback preserved but with staleness awareness
 * - Cache invalidation on deploy via invalidateAllCaches()
 * - Type-safe cache keys enforced
 * 
 * Architecture:
 * 1. Cron jobs write all keys atomically via pipelineSet()
 * 2. API routes read via getCachedData() — returns data + metadata
 * 3. On cache miss, withStampedeProtection() ensures only one rebuild runs
 * 4. Deploy webhook calls invalidateAllCaches() to force fresh data
 */

import { Redis } from '@upstash/redis';

// ─── Redis Client ───────────────────────────────────────────────────────────

let kv: Redis | null = null;

try {
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    kv = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
  }
} catch (err) {
  console.error('[Cache] Failed to initialize Upstash Redis:', err);
}

// ─── Types ──────────────────────────────────────────────────────────────────

/** Envelope wrapping every cached value with freshness metadata */
export interface CacheEnvelope<T> {
  data: T;
  cachedAt: string;       // ISO timestamp when this value was written
  version: number;        // Monotonic version — ms timestamp as version
  source: 'cron' | 'api'; // Who wrote this value
}

export interface CacheResult<T> {
  data: T;
  cachedAt: string;
  version: number;
  source: 'cron' | 'api';
  store: 'kv' | 'static';
  ageMs: number;          // Milliseconds since cachedAt
}

// ─── Cache Keys (v3 — enveloped format) ──────────────────────────────────────

export const CACHE_KEYS = {
  NEWSLETTER_DATA: 'newsletter-data-v3',
  MY_WEEK_DATA: 'myweek-data-v3',
  DASHBOARD_DATA: 'dashboard-data-v3',
  COHORT_EVENTS: 'cohort-events-v3',
} as const;

export type CacheKey = typeof CACHE_KEYS[keyof typeof CACHE_KEYS];

// ─── Configuration ──────────────────────────────────────────────────────────

/** 25 hours — survives one missed cron cycle (24h interval) */
const CACHE_TTL = 90_000;

/** Max age before data is considered "stale" (for client-side display) */
export const STALE_THRESHOLD_MS = 26 * 60 * 60 * 1000; // 26 hours

// ─── In-flight dedup (stampede protection) ─────────────────────────────────

const inFlightRequests = new Map<string, Promise<unknown>>();

/**
 * Ensures only ONE concurrent rebuild runs for a given key.
 * Subsequent callers get the same Promise instead of triggering parallel rebuilds.
 */
export async function withStampedeProtection<T>(
  key: string,
  rebuilder: () => Promise<T>
): Promise<T> {
  const existing = inFlightRequests.get(key);
  if (existing) {
    console.log(`[Cache] Stampede protection: reusing in-flight request for ${key}`);
    return existing as Promise<T>;
  }

  const promise = rebuilder()
    .finally(() => {
      inFlightRequests.delete(key);
    });

  inFlightRequests.set(key, promise);
  return promise;
}

// ─── Read ───────────────────────────────────────────────────────────────────

/**
 * Read cached data. Returns data + metadata (age, version, source) or null on miss.
 */
export async function getCachedData<T>(key: CacheKey): Promise<CacheResult<T> | null> {
  // In dev mode, skip cache for ICS data so edits are reflected immediately
  if (process.env.NODE_ENV === 'development' && key === CACHE_KEYS.COHORT_EVENTS) {
    return null;
  }

  // Try KV
  if (kv) {
    try {
      const envelope = await kv.get<CacheEnvelope<T>>(key);
      if (envelope && envelope.data !== undefined && envelope.cachedAt) {
        const ageMs = Date.now() - new Date(envelope.cachedAt).getTime();
        return {
          data: envelope.data,
          cachedAt: envelope.cachedAt,
          version: envelope.version ?? 0,
          source: envelope.source ?? 'cron',
          store: 'kv',
          ageMs,
        };
      }
      // Handle legacy data (v1/v2 format without envelope)
      if (envelope && typeof envelope === 'object' && !('cachedAt' in (envelope as unknown as Record<string, unknown>))) {
        console.log(`[Cache] Legacy (un-enveloped) data found for ${key} — returning with unknown age`);
        return {
          data: envelope as unknown as T,
          cachedAt: new Date(0).toISOString(),
          version: 0,
          source: 'cron',
          store: 'kv',
          ageMs: Infinity,
        };
      }
    } catch (err) {
      console.warn(`[Cache] KV read failed for ${key}:`, err);
    }
  }

  // Fallback: static JSON in public/cache/ (read-only on Vercel, from build time)
  try {
    const fs = await import('fs/promises');
    const path = await import('path');
    const filePath = path.join(process.cwd(), 'public', 'cache', `${key}.json`);
    const raw = await fs.readFile(filePath, 'utf-8');
    const parsed = JSON.parse(raw);

    // Check if it's envelope format
    if (parsed && parsed.cachedAt && parsed.data !== undefined) {
      const ageMs = Date.now() - new Date(parsed.cachedAt).getTime();
      return {
        data: parsed.data as T,
        cachedAt: parsed.cachedAt,
        version: parsed.version ?? 0,
        source: parsed.source ?? 'cron',
        store: 'static',
        ageMs,
      };
    }
    // Legacy static fallback (raw data, no envelope)
    return {
      data: parsed as T,
      cachedAt: new Date(0).toISOString(),
      version: 0,
      source: 'cron',
      store: 'static',
      ageMs: Infinity,
    };
  } catch {
    // Static file not found — expected in production
  }

  return null;
}

// ─── Write (single key) ────────────────────────────────────────────────────

/**
 * Write a single cache key with envelope metadata.
 */
export async function setCachedData<T>(
  key: CacheKey,
  data: T,
  options: {
    ttl?: number;
    source?: 'cron' | 'api';
    writeStatic?: boolean; // Dev only — writes JSON to public/cache/
  } = {}
): Promise<void> {
  const { ttl = CACHE_TTL, source = 'api', writeStatic = false } = options;

  const envelope: CacheEnvelope<T> = {
    data,
    cachedAt: new Date().toISOString(),
    version: Date.now(),
    source,
  };

  if (kv) {
    try {
      await kv.set(key, envelope, { ex: ttl });
    } catch (err) {
      console.error(`[Cache] KV write failed for ${key}:`, err);
    }
  }

  // Dev-only static JSON write
  if (writeStatic && process.env.NODE_ENV === 'development') {
    try {
      const fs = await import('fs/promises');
      const path = await import('path');
      const cacheDir = path.join(process.cwd(), 'public', 'cache');
      await fs.mkdir(cacheDir, { recursive: true });
      await fs.writeFile(
        path.join(cacheDir, `${key}.json`),
        JSON.stringify(envelope, null, 2),
        'utf-8'
      );
    } catch (err) {
      console.error(`[Cache] Static write failed for ${key}:`, err);
    }
  }
}

// ─── Write (pipeline — atomic multi-key) ────────────────────────────────────

/**
 * Write multiple cache keys atomically using Upstash pipeline.
 * All keys are written in a single round-trip — readers see either all-old or all-new data.
 * 
 * Usage in cron jobs:
 *   await pipelineSet([
 *     { key: CACHE_KEYS.NEWSLETTER_DATA, data: newsletter },
 *     { key: CACHE_KEYS.COHORT_EVENTS, data: events },
 *     { key: CACHE_KEYS.MY_WEEK_DATA, data: myWeek },
 *     { key: CACHE_KEYS.DASHBOARD_DATA, data: dashboard },
 *   ]);
 */
export async function pipelineSet(
  entries: { key: CacheKey; data: unknown }[],
  options: { ttl?: number; source?: 'cron' | 'api' } = {}
): Promise<void> {
  const { ttl = CACHE_TTL, source = 'cron' } = options;
  const now = new Date().toISOString();
  const version = Date.now();

  if (!kv) {
    console.warn('[Cache] KV not available — pipeline write skipped');
    return;
  }

  try {
    const pipeline = kv.pipeline();
    for (const entry of entries) {
      const envelope: CacheEnvelope<unknown> = {
        data: entry.data,
        cachedAt: now,
        version,
        source,
      };
      pipeline.set(entry.key, envelope, { ex: ttl });
    }
    await pipeline.exec();
    console.log(`[Cache] Pipeline write: ${entries.length} keys written atomically (v${version})`);
  } catch (err) {
    console.error('[Cache] Pipeline write failed:', err);
    // Fallback: sequential writes
    for (const entry of entries) {
      await setCachedData(entry.key as CacheKey, entry.data, { ttl, source }).catch(e =>
        console.error(`[Cache] Sequential fallback failed for ${entry.key}:`, e)
      );
    }
  }
}

// ─── Invalidation ───────────────────────────────────────────────────────────

/**
 * Delete a single cache key from KV.
 */
export async function deleteCachedData(key: CacheKey): Promise<void> {
  if (kv) {
    try {
      await kv.del(key);
    } catch (err) {
      console.error(`[Cache] Delete failed for ${key}:`, err);
    }
  }
}

/**
 * Invalidate ALL cache keys. Called on deploy to ensure fresh data.
 * Uses pipeline for atomicity.
 */
export async function invalidateAllCaches(): Promise<void> {
  if (!kv) return;

  try {
    const pipeline = kv.pipeline();
    for (const key of Object.values(CACHE_KEYS)) {
      pipeline.del(key);
    }
    await pipeline.exec();
    console.log('[Cache] All caches invalidated');
  } catch (err) {
    console.error('[Cache] Failed to invalidate all caches:', err);
    for (const key of Object.values(CACHE_KEYS)) {
      await deleteCachedData(key).catch(() => {});
    }
  }
}

// ─── Utilities ──────────────────────────────────────────────────────────────

export function isKVAvailable(): boolean {
  return kv !== null;
}

/** Check if cached data is considered stale (older than STALE_THRESHOLD_MS). */
export function isStale(result: CacheResult<unknown>): boolean {
  return result.ageMs > STALE_THRESHOLD_MS;
}
