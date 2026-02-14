/**
 * OskiHub Analytics — Centralized Vercel Custom Event Tracking
 *
 * Client-side: import { trackEvent } from '@/lib/analytics'
 * Server-side: import { trackServerEvent } from '@/lib/analytics-server'
 *
 * All event names and property shapes are typed for consistency.
 * Vercel limits: 255 chars max per event name/key/value, no nested objects.
 */

import { track } from '@vercel/analytics';

// ─── Event Definitions ──────────────────────────────────────────────

export type AnalyticsEvents = {
  // ── Cohort & Navigation ──
  cohort_selected: { cohort: 'blue' | 'gold' };
  tab_switched: { tab: string; source: 'click' | 'cross_widget' };
  widget_expanded: { widget: 'my_week' | 'resources'; expanded: boolean };

  // ── Calendar ──
  calendar_month_navigated: { direction: 'previous' | 'next'; targetMonth: string };
  event_source_toggled: { source: string; enabled: boolean };
  event_source_hide_all: Record<string, never>;
  event_source_dropdown_opened: Record<string, never>;
  calendar_event_clicked: { source: string; title: string };
  multi_event_day_clicked: { eventCount: number; date: string };
  calendar_list_scrolled: { direction: 'next' | 'previous' };

  // ── Event Detail Modal ──
  event_modal_navigated: { direction: 'next' | 'previous' };
  event_modal_view_newsletter: { source: string; title: string };
  event_modal_open_class_page: { title: string; url: string };
  multi_event_selected: { source: string; title: string };

  // ── Newsletter ──
  newsletter_section_opened: { section: string };
  newsletter_item_read: { section: string; item: string };
  newsletter_source_clicked: { url: string };
  gmail_newsletter_opened: { title: string };
  gmail_newsletter_navigated: { direction: 'next' | 'previous' };

  // ── My Week ──
  my_week_expanded: { expanded: boolean };
  my_week_event_clicked: { title: string; source: string };

  // ── Resources ──
  resource_category_toggled: { category: string };
  resource_link_clicked: { category: string; item: string; url: string };
  haas_journey_toggled: { expanded: boolean };
  haas_journey_link_clicked: { resource: string; title: string };
  book_a_space_clicked: Record<string, never>;

  // ── ICS Export ──
  ics_export_modal_opened: Record<string, never>;
  ics_filter_toggled: { filter: string; enabled: boolean };
  ics_url_copied: { filterCount: number };
  ics_downloaded: { filterCount: number };

  // ── Utility Widgets ──
  weather_clicked: Record<string, never>;
  travel_time_clicked: Record<string, never>;
};

// ─── Typed track wrapper ─────────────────────────────────────────────

/**
 * Track a custom event with typed name and properties.
 * Safe to call anywhere on the client — silently no-ops on error.
 */
export function trackEvent<K extends keyof AnalyticsEvents>(
  eventName: K,
  ...args: AnalyticsEvents[K] extends Record<string, never>
    ? []
    : [properties: AnalyticsEvents[K]]
): void {
  try {
    const properties = args[0] as Record<string, string | number | boolean | null> | undefined;
    // Truncate values to 255 chars (Vercel limit)
    if (properties) {
      for (const key of Object.keys(properties)) {
        const val = properties[key];
        if (typeof val === 'string' && val.length > 255) {
          properties[key] = val.slice(0, 252) + '...';
        }
      }
    }
    track(eventName, properties);
  } catch {
    // Analytics should never break the app
  }
}
