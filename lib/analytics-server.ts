/**
 * OskiHub Server-Side Analytics — Vercel Custom Event Tracking for API Routes
 *
 * Usage: import { trackServerEvent } from '@/lib/analytics-server'
 *
 * Uses @vercel/analytics/server for server-side tracking in API routes and cron jobs.
 */

import { track } from '@vercel/analytics/server';

// ─── Server Event Definitions ────────────────────────────────────────

export type ServerAnalyticsEvents = {
  dashboard_data_served: { source: 'kv_cache' | 'fresh_build' | 'static_fallback'; latencyMs: number };
  newsletter_cron_completed: { success: boolean; durationMs: number; hasNewsletter: boolean };
  cache_cron_completed: { success: boolean; durationMs: number; eventCount: number };
  newsletter_fetch_failed: { error: string };
  cache_fetch_failed: { error: string };
};

/**
 * Track a server-side custom event with typed name and properties.
 * Safe to call in API routes and cron jobs — silently no-ops on error.
 */
export async function trackServerEvent<K extends keyof ServerAnalyticsEvents>(
  eventName: K,
  properties: ServerAnalyticsEvents[K]
): Promise<void> {
  try {
    const props = properties as Record<string, string | number | boolean | null>;
    // Truncate string values to 255 chars
    for (const key of Object.keys(props)) {
      const val = props[key];
      if (typeof val === 'string' && val.length > 255) {
        props[key] = val.slice(0, 252) + '...';
      }
    }
    await track(eventName, props);
  } catch {
    // Analytics should never break API responses
  }
}
