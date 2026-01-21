# OSKI Hub - Copilot Instructions

> UC Berkeley EWMBA Dashboard (Next.js 15 + TypeScript + Tailwind)
> Production: www.oski.app | Vercel-hosted

## Repository & Deployment Stack

```
VS Code (Local Development)
    ↓
GitHub Repository: https://github.com/CinnamonGrossCrunch/OskiHub
    ↓
Vercel Project: https://vercel.com/matt-gross-projects-2589e68e/oskihub
(Project ID: prj_4PcZTaos2UlHV9bXLGlQEXlUINVC)
    ↓
Production URL: https://www.oski.app
```

**Note:** The previous repository (vibeshift.me) is deprecated. All code changes should be pushed to the OskiHub repository.

## Project Overview

OSKI Hub aggregates EWMBA program data into a single dashboard:
- **Newsletter Widget**: Scrapes Mailchimp archive, AI-organizes content
- **Calendar System**: Parses ICS files for Blue/Gold cohort schedules
- **My Week Widget**: AI-generated weekly summaries per cohort
- **Supporting widgets**: Weather, travel time, resources, Slack links

## Critical Architecture Patterns

### 1. Hybrid Cache System (`lib/cache.ts`)
```
Request → Upstash KV (primary) → Static JSON fallback → Fresh regeneration
```
- **KV cache**: ~50-200ms response, 8-hour TTL
- **Static fallback**: `public/cache/dashboard-data.json`, committed to repo
- **Always use `writeStatic: true`** when caching to ensure fallback is updated
- Cache keys: `CACHE_KEYS.DASHBOARD_DATA`, `NEWSLETTER_DATA`, `MY_WEEK_DATA`, `COHORT_EVENTS`

### 2. Cron Jobs (`vercel.json`)
| Job | Schedule (UTC) | Pacific | Purpose |
|-----|---------------|---------|---------|
| `/api/cron/refresh-cache` | 0 7 * * * | 11 PM | Calendar refresh |
| `/api/cron/refresh-newsletter` | 10 15 * * * | 8:10 AM | Newsletter + AI processing |

**Cron jobs require `Authorization: Bearer ${CRON_SECRET}` header.**

### 3. Timezone Handling (`lib/date-utils.ts`)
- **ALL date logic uses `America/Los_Angeles`** (Berkeley time)
- Vercel runs in UTC - always convert with `toZonedTime()`
- Use `getConsistentToday()` not `new Date()` for "today"
- Use `parseICSDate()` for calendar events (handles UTC→PST conversion)
- Use `getConsistentWeekRange()` for week boundaries

### 4. Newsletter Scraper (`lib/scrape.ts`)
- Source: `us7.campaign-archive.com` Mailchimp archive
- **Critical selector**: `#archive-list li.campaign a[href*="eepurl.com"]`
- Failsafes validate URL doesn't contain "subscribe", "join", "signup"
- HTML sanitized via `sanitize-html` with safe allowlist

### 5. AI Processing (`lib/openai-organizer.ts`, `lib/my-week-analyzer.ts`)
- Model: `gpt-4o-mini` via `lib/aiClient.ts`
- Processing time: ~60-90 seconds for full newsletter
- 24-hour in-memory cache to avoid redundant API calls
- Always handle timeout gracefully (200s max on Vercel)

## File Structure

```
newsletter-widget/
├── app/
│   ├── api/
│   │   ├── unified-dashboard/    # Main data endpoint (cache-first)
│   │   ├── cron/                 # Vercel cron handlers
│   │   ├── calendar/             # ICS export functionality
│   │   └── notify/               # Email notifications
│   ├── components/
│   │   ├── ClientDashboard.tsx   # Main dashboard shell
│   │   ├── MainDashboardTabs.tsx # Newsletter/Calendar/My Week tabs
│   │   ├── NewsletterWidget.tsx  # Newsletter display (64KB, complex)
│   │   ├── CohortCalendarTabs.tsx # Calendar views (month/list/export)
│   │   ├── MyWeekWidget.tsx      # AI weekly summary
│   │   └── EventDetailModal.tsx  # Event detail overlay
│   └── page.tsx                  # Server component, fetches initial data
├── lib/
│   ├── cache.ts                  # Hybrid KV + static cache
│   ├── scrape.ts                 # Newsletter scraper (Cheerio)
│   ├── icsUtils.ts               # ICS parser (node-ical)
│   ├── openai-organizer.ts       # Newsletter AI organization
│   ├── my-week-analyzer.ts       # Weekly summary AI
│   ├── date-utils.ts             # Timezone-safe date utilities
│   ├── notifications.ts          # Resend email notifications
│   └── aiClient.ts               # OpenAI client wrapper
├── public/
│   ├── cache/                    # Static cache JSON files
│   └── *.ics                     # Course calendar files
└── vercel.json                   # Cron schedules, function timeouts
```

## Component Hierarchy

```
page.tsx (Server Component - fetches data)
└── ClientDashboard (Client - manages state)
    ├── MainDashboardTabs
    │   ├── NewsletterWidget (collapsible sections)
    │   ├── CohortCalendarTabs (MonthGrid, CalendarListView)
    │   └── MyWeekWidget (AI summaries)
    ├── DashboardTabs2 (Resources, Journey, Slack)
    └── Sidebar widgets (Weather, Travel, Cohort toggle)
```

## Cohort System

Two cohorts with separate schedules: **Blue** and **Gold**
- User preference stored in `localStorage['global-cohort-preference']`
- Default: Blue
- ICS files per cohort in `public/` (e.g., `DataDecisions-Blue.ics`)
- Shared events: `teams@Haas.ics`, `cal_bears_home_*.ics`

## Environment Variables

| Variable | Required | Purpose |
|----------|----------|---------|
| `OPENAI_API_KEY` | Yes | AI processing |
| `CRON_SECRET` | Yes | Cron job auth |
| `UPSTASH_REDIS_REST_URL` | Yes | KV cache |
| `UPSTASH_REDIS_REST_TOKEN` | Yes | KV cache |
| `RESEND_API_KEY` | No | Email notifications |
| `NOTIFICATION_EMAIL` | No | Alert recipient |

## Common Pitfalls

### ❌ DON'T
- Use `new Date()` for date comparisons (timezone issues)
- Forget `writeStatic: true` when updating cache
- Call OpenAI without timeout handling
- Assume cron jobs succeed (check failsafes)
- Edit files outside `newsletter-widget/` directory

### ✅ DO
- Use `getConsistentToday()` and `parseICSDate()` for dates
- Test timezone logic with `America/Los_Angeles` context
- Add failsafe validations for scraped content
- Check cache source header (`X-Cache-Source`) when debugging
- Run `npm run build` before committing (catches type errors)

## API Response Structure

`/api/unified-dashboard` returns:
```typescript
{
  newsletterData: { sourceUrl, title, sections[] },
  myWeekData: { weekStart, weekEnd, blueEvents[], goldEvents[], blueSummary, goldSummary },
  cohortEvents: { blue[], gold[], original[], launch[], calBears[], campusGroups[] },
  processingInfo: { totalTime, newsletterTime, calendarTime, myWeekTime }
}
```

## Debugging Tips

1. **Stale newsletter?** Check scraper selector in `lib/scrape.ts`
2. **Cache miss?** Verify KV credentials, check `X-Cache-Source` header
3. **Wrong dates?** Always use `date-utils.ts` functions
4. **Cron failing?** Check Vercel logs, verify `CRON_SECRET`
5. **AI timeout?** Increase `maxDuration` in route exports

## Testing Commands

```bash
# Local development
npm run dev

# Type check
npm run build

# Test cache performance
node scripts/test-cache-performance.mjs

# Trigger cron manually (local)
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/refresh-newsletter
```

## Deployment

- **GitHub Repo**: https://github.com/CinnamonGrossCrunch/OskiHub
- **Vercel Project**: https://vercel.com/matt-gross-projects-2589e68e/oskihub
- **Vercel Project ID**: `prj_4PcZTaos2UlHV9bXLGlQEXlUINVC`
- Auto-deploys on push to `main` via Vercel
- GitHub Action `warm-cache.yml` warms cache post-deploy
- Static cache (`public/cache/`) committed to repo as fallback

```bash
# Push changes to production
git push origin main
```
