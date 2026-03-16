# OskiHub - Copilot Instructions

> UC Berkeley EWMBA Dashboard | Next.js 15.5 + TypeScript 5 + Tailwind 4  
> Production: https://www.oski.app | Vercel-hosted (region: `iad1`, Node 22)  
> Repo: https://github.com/CinnamonGrossCrunch/OskiHub

## Architecture Overview

OskiHub aggregates EWMBA data into a unified dashboard:
- **Entry point**: `app/page.tsx` (client component) → `ClientDashboard.tsx` → fetches `/api/unified-dashboard`
- **Two newsletter sources**: Mailchimp scraper (Bear Necessities) + Gmail pipeline (Blue Crew, EW Wire)
- **Caching**: Upstash KV (primary, ~50-200ms) → Static JSON fallback (~500ms) → Fresh regeneration (~8-20s)
- **AI Processing**: OpenAI Responses API (falls back to Chat Completions) with model fallback chain
- **Always dark mode**: Forced via layout.tsx; font: Urbanist (Google Fonts)
- **Rendering**: `PerformanceProvider` wraps app for adaptive rendering based on device capability
- **Analytics**: Vercel Analytics + Speed Insights + Microsoft Clarity

### Key Directories
| Path | Purpose |
|------|---------|
| `app/api/unified-dashboard/` | Main endpoint - aggregates all dashboard data |
| `app/api/cron/` | Vercel cron handlers (`refresh-newsletter`, `refresh-cache`) |
| `app/api/gmail-newsletters/` | Serves Gmail-sourced newsletters from `content/newsletters/` |
| `app/api/github-webhook/` | Receives GitHub push events → triggers Vercel redeploy |
| `app/api/calendar/` | Calendar-specific API |
| `app/api/travel-time/` | Travel time calculations |
| `app/api/weather/` | Weather data |
| `app/admin/cache-refresh/` | Admin page: manual cache refresh, deploy trigger (password-protected) |
| `app/components/` | ~28 React components (`ClientDashboard.tsx` is main shell) |
| `lib/` | Core logic: `cache.ts`, `scrape.ts`, `aiClient.ts`, `date-utils.ts`, `icsUtils.ts` |
| `public/*.ics` | Course calendars per cohort |
| `public/cache/` | Static JSON fallbacks (committed to repo) |
| `content/newsletters/` | Gmail-ingested newsletters (YAML frontmatter + raw HTML body) |
| `scripts/` | Google Apps Scripts (reference copies - edit at script.google.com) |

## Gmail Newsletter Pipeline

```
Gmail (unread) → Apps Script (5-10 min) → GitHub repository_dispatch
                                                    ↓
content/newsletters/*.md ← GitHub Action commits ← newsletter_received event
         ↓
GitHub push → Webhook → Vercel redeploy → warm-cache.yml → GmailNewsletterWidget
```

### Pipeline Components
| Step | System | File/Location |
|------|--------|---------------|
| 1. Monitor Gmail | Google Apps Script | `scripts/*.js` (reference only - edit at script.google.com) |
| 2. Create file | GitHub Action | `.github/workflows/newsletter-dispatch.yml` |
| 3. Trigger redeploy | API endpoint | `app/api/github-webhook/route.ts` |
| 4. Warm cache | GitHub Action | `.github/workflows/warm-cache.yml` |
| 5. Display | React component | `app/components/GmailNewsletterWidget.tsx` |

### Gmail Pipeline Troubleshooting
If newsletters aren't appearing:
1. **Apps Script logs**: script.google.com → Your project → Executions
2. **GitHub Action**: Actions tab → "Ingest Newsletter from Gmail" workflow
3. **File created?**: Check `content/newsletters/` for new `.md` file
4. **Webhook fired?**: Repo Settings → Webhooks → Recent Deliveries
5. **Cache warmed?**: Check `warm-cache.yml` run in Actions tab

### Gmail Pipeline Secrets
| Secret | Where to Set | Purpose |
|--------|--------------|---------|
| `GMAIL_DISPATCH_TOKEN` | GitHub repo secrets | PAT for Apps Script → GitHub |
| `GITHUB_WEBHOOK_SECRET` | Vercel env + GitHub webhook | Signature validation |
| `VERCEL_DEPLOY_HOOK_URL` | Vercel env | Trigger redeployment |
| `CRON_SECRET` | Vercel env + GitHub secrets | Cache warming auth |
| `PRODUCTION_URL` | GitHub secrets | Target URL for cache warming |

## Critical Patterns

### 1. Timezone Handling (`lib/date-utils.ts`)
**ALL date logic must use Berkeley time (America/Los_Angeles)**. Vercel runs in UTC.
```typescript
import { getConsistentToday, parseICSDate, getConsistentWeekRange } from '@/lib/date-utils';

getConsistentToday()                         // Today in Berkeley time (not UTC)
parseICSDate(isoString)                      // Parse ICS dates correctly
getConsistentWeekRange()                     // Sun-to-Mon (8-day, end exclusive)
parseConsistentDate(dateString)              // Parse arbitrary date strings
formatConsistentDate(dateString)             // Format for display
isDateInWeekRange(dateString, start, end)    // Range check
```
**Never use `new Date()` directly** — always use these helpers.

### 2. Hybrid Cache (`lib/cache.ts`)
```typescript
import { getCachedData, setCachedData, CACHE_KEYS } from '@/lib/cache';

// Reading: returns { data, source: 'kv' | 'static' } or null
const cached = await getCachedData(CACHE_KEYS.DASHBOARD_DATA);

// Writing: writeStatic writes to public/cache/ (dev only — Vercel fs is read-only)
await setCachedData(CACHE_KEYS.DASHBOARD_DATA, data, { writeStatic: true });
```
- Cache keys: `DASHBOARD_DATA`, `NEWSLETTER_DATA`, `MY_WEEK_DATA`, `COHORT_EVENTS` (stored as `'cohort-events-v2'`)
- TTL: 25 hours (90000s) — exceeds the 24h cron interval to prevent mid-day expiration
- **Dev mode**: `COHORT_EVENTS` cache is skipped for real-time ICS testing
- **`writeStatic: true`** only writes locally; Vercel's serverless fs is read-only. Include it for dev convenience but don't rely on it in production.

### 3. AI Client (`lib/aiClient.ts`)
```typescript
import { runAI } from '@/lib/aiClient';

const result = await runAI({ 
  prompt: '...', 
  reasoningEffort: 'low',     // 'minimal' | 'low' | 'medium' | 'high'
  verbosity: 'low',           // 'low' | 'medium' | 'high'
  maxOutputTokens: 1200       // Optional, default 1200
});
// Returns: { model, modelsTried, ms, text }
```
- Uses **Responses API first**, falls back to **Chat Completions** if unsupported
- Model fallback chain: `OPENAI_MODEL` → `OPENAI_MODEL_FALLBACKS` (comma-separated) → defaults `['gpt-4o-mini', 'gpt-4o', 'gpt-4.1-mini']`
- Env vars: `OPENAI_REASONING_EFFORT`, `OPENAI_VERBOSITY` set defaults

### 4. Vercel Cron Jobs (`vercel.json`)
| Endpoint | UTC Schedule | Pacific | Purpose |
|----------|--------------|---------|---------|
| `/api/cron/refresh-newsletter` | `10 15 * * *` | 8:10 AM | Newsletter scrape + AI |
| `/api/cron/refresh-cache` | `0 7 * * *` | 11:00 PM | Calendar refresh |

All cron endpoints require: `Authorization: Bearer ${CRON_SECRET}`

### 5. Middleware (`middleware.ts`)
- HTTP → HTTPS redirect (301) for non-localhost
- Security headers: HSTS, X-Frame-Options (DENY), X-Content-Type-Options, X-XSS-Protection, Referrer-Policy
- Excludes: API routes, `_next/*`, `favicon.ico`

## Cohort System & Calendar Management

**Two cohorts**: Blue and Gold (separate class schedules, shared program events)
- User preference: `localStorage['global-cohort-preference']` (default: 'blue')
- Shared calendars: `teams@Haas.ics`, `cal_bears_home_*.ics`
- `cohortEvents` response includes: `blue`, `gold`, `original`, `launch`, `calBears`, `campusGroups`, `academicCalendar`, `cmg`, `registration`

### Adding a New Course Calendar
1. Export ICS from bCourses/Canvas
2. Save to `public/` (naming varies — some use `ewmba{courseNum}_{cohort}_{term}.ics`, others like `DataDecisions-Blue.ics` or `Marketing-Blue-Final.ics`)
3. Add filename to `COHORT_FILES` in `lib/icsUtils.ts`
4. Commit and push (dev mode bypasses cache for instant testing)

## Environment Variables

### Required
| Variable | Purpose |
|----------|---------|
| `OPENAI_API_KEY` | AI processing for newsletter organization |
| `CRON_SECRET` | Auth for cron endpoints and cache warming |
| `UPSTASH_REDIS_REST_URL` | KV cache URL |
| `UPSTASH_REDIS_REST_TOKEN` | KV cache auth token |
| `GITHUB_WEBHOOK_SECRET` | Webhook signature validation |
| `VERCEL_DEPLOY_HOOK_URL` | Trigger Vercel redeploy from webhook |

### Optional
| Variable | Purpose |
|----------|---------|
| `OPENAI_MODEL` | Primary model (default: gpt-4o-mini) |
| `OPENAI_MODEL_FALLBACKS` | Comma-separated fallback models |
| `OPENAI_REASONING_EFFORT` | Default reasoning effort (`low`) |
| `OPENAI_VERBOSITY` | Default verbosity (`low`) |
| `RESEND_API_KEY` | Email notifications |
| `NOTIFICATION_EMAIL` | Alert recipient email |

## Common Mistakes

| ❌ Don't | ✅ Do Instead |
|---------|---------------|
| `new Date()` | `getConsistentToday()` from `lib/date-utils.ts` |
| Assume `writeStatic` persists on Vercel | It only writes locally; KV is the production cache |
| Edit `scripts/*.js` directly | Edit in Google Apps Script, then copy to repo |
| Assume cron succeeded | Check Vercel logs, add failsafe validations |
| Skip build before commit | Run `npm run build` (catches type errors) |
| Missing route config | Add `export const runtime/dynamic/maxDuration` to API routes |
| Set `maxDuration` without checking `vercel.json` | `vercel.json` `functions` config overrides route exports (currently 300s) |

## API Route Configuration Pattern

All API routes that use Node.js features (OpenAI, cheerio, fs) must include:
```typescript
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;             // Match vercel.json functions config
export const fetchCache = 'force-no-store';
```
**Note**: `vercel.json` sets `maxDuration: 300` for key routes — this overrides in-file exports.

## API Response: `/api/unified-dashboard`

```typescript
interface UnifiedDashboardData {
  newsletterData: {
    sourceUrl: string;
    title?: string;
    sections: { sectionTitle: string; items: { title: string; html: string; timeSensitive?: object }[] }[];
    aiDebugInfo?: { model: string; modelsTried: string[]; modelLatency: number };
  };
  myWeekData: {
    weekStart: string;
    weekEnd: string;
    blueEvents: CalendarEvent[];  // events have type: 'assignment'|'class'|'exam'|'administrative'|'social'|'newsletter'|'other'
    goldEvents: CalendarEvent[];
    blueSummary?: string;
    goldSummary?: string;
    processingTime?: number;
  };
  cohortEvents: {
    blue: CalendarEvent[];
    gold: CalendarEvent[];
    original: CalendarEvent[];
    launch: CalendarEvent[];
    calBears: CalendarEvent[];
    campusGroups: CalendarEvent[];
    academicCalendar: CalendarEvent[];
    cmg?: CalendarEvent[];
    registration?: CalendarEvent[];
  };
  processingInfo: { totalTime: number; newsletterTime: number; calendarTime: number; myWeekTime: number; timestamp: string };
}
```
Response header `X-Cache-Source: kv | static | fresh` indicates data origin.

## Quick Debugging

| Symptom | Check | Guide |
|---------|-------|-------|
| Stale newsletter | Scraper selector in `lib/scrape.ts` | - |
| Cache miss | KV credentials, `X-Cache-Source` header | [`CACHE_SETUP_GUIDE.md`](../markdown_files/CACHE_SETUP_GUIDE.md) |
| Wrong dates | Using `date-utils.ts`? Berkeley timezone? | [`MY_WEEK_DATE_LOGIC.md`](../markdown_files/MY_WEEK_DATE_LOGIC.md) |
| ICS events missing | File in `public/`? In `COHORT_FILES`? | [`ICS_CALENDAR_GUIDE.md`](../markdown_files/ICS_CALENDAR_GUIDE.md) |
| Gmail newsletter missing | See Pipeline Troubleshooting above | [`NEWSLETTER_SYNC_SETUP.md`](../markdown_files/NEWSLETTER_SYNC_SETUP.md) |
| AI timeout | Check `maxDuration` in `vercel.json` `functions` (currently 300s) | - |
| Webhook not firing | Check GitHub webhook deliveries | [`GITHUB_WEBHOOK_SETUP.md`](../markdown_files/GITHUB_WEBHOOK_SETUP.md) |
| Cron not running | Verify `CRON_SECRET` in Vercel | [`VERCEL_CRON_SECRET_SETUP.md`](../markdown_files/VERCEL_CRON_SECRET_SETUP.md) |
| Port 3000 in use | `taskkill /F /IM node.exe` before `npm run dev` | - |
| Manual cache refresh needed | Use admin page at `/admin/cache-refresh` (password-protected) | - |

## Developer Commands

```powershell
# Windows: Kill existing Node processes first (prevents port conflicts)
taskkill /F /IM node.exe 2>$null; npm run dev

# Development
npm run dev           # Dev server (cache bypassed for calendar data)
npm run build         # Full build with type checking  
npm run type-check    # TypeScript only
npm run build:safe    # Build + verify no API key leakage
npm run lint          # ESLint

# Manual cache refresh (production)
curl -H "Authorization: Bearer $CRON_SECRET" https://oski.app/api/cron/refresh-newsletter
```

## Deployment

- **Auto-deploy**: Push to `main` → Vercel builds → `warm-cache.yml` prewarms cache
- **Build command**: `npm run build && node scripts/verify-no-api-leakage.js`
- **Static fallback**: `public/cache/*.json` committed to repo (used if KV fails)
- **Region**: `iad1` | **Node**: 22 (configured in `vercel.json`)
- **Deploy skip**: `vercel.json` `ignoreCommand` skips deploy for changes only to `LICENSE`, `.gitignore`, `markdown_files/`

## Webpack / Next.js Quirks

- `node-ical` aliased to `false` on client (in `next.config.js` webpack config) — only usable server-side
- Client-side fallbacks for `fs`, `path`, `stream`, `crypto` all set to `false`
- CSP allows: `clarity.ms`, `va.vercel-scripts.com`, `vercel.live`

## Component Map

### Hierarchy
```
RootLayout (Server) — layout.tsx
└── PerformanceProvider
    └── page.tsx (Client)
        └── ClientDashboard              ← god component: owns cohort state, fetches /api/unified-dashboard
            ├── AnimatedLogo
            ├── CohortToggleWidget        ← Blue/Gold selector
            │
            ├── [Top Widgets Row]
            │   ├── MyWeekWidget           ← weekly schedule, accordion-expand (mutual-exclusive w/ HaasJourney)
            │   ├── HaasJourneyWidget      ← quick-link resource tiles
            │   ├── WeatherWidget           ← self-fetching Berkeley weather
            │   └── TravelTimeWidget        ← geolocation → drive/transit to Haas
            │
            ├── [Main Grid]
            │   ├── MainDashboardTabs (left, 6-col)
            │   │   ├── CohortCalendarWidget → CohortCalendarTabs → MonthGrid + EventDetailModal
            │   │   ├── CalendarListView → EventDetailModal
            │   │   ├── NewsletterWidget     ← Bear Necessities accordion
            │   │   ├── GmailNewsletterWidget ← Blue Crew / EW Wire
            │   │   └── SlackWidget           ← placeholder
            │   │
            │   ├── DashboardTabs2 (right, 2-col, desktop only)
            │   │   ├── NewsletterWidget     ← shared with MainDashboardTabs for responsive layout
            │   │   ├── GmailNewsletterWidget
            │   │   └── SlackWidget
            │   │
            │   └── HaasResourcesWidget → HaasResourcesTabs
            │
            ├── GmailNewsletterModalHost   ← global listener for custom "openGmailNewsletter" DOM event
            └── IcsExportModal              ← ICS subscription URL builder
```

### Component Patterns
- **All components are `'use client'`** except `layout.tsx` (server)
- **Responsive duplication**: `MainDashboardTabs` (mobile) and `DashboardTabs2` (desktop) render the same newsletter/Slack children
- **Accordion mutual-exclusion**: `MyWeekWidget` and `HaasJourneyWidget` — exactly one expanded, controlled by `ClientDashboard`
- **Custom event bus**: `GmailNewsletterWidget` dispatches `openGmailNewsletter` DOM event → `GmailNewsletterModalHost` listens and opens detail modal (decoupled)
- **Dead files**: `CompactNewsletterWidget.tsx` and `NewsletterModalWrapper.tsx` are empty/unused

### Key Components Reference
| Component | Props | Notes |
|-----------|-------|-------|
| `ClientDashboard` | `initialData: UnifiedDashboardData \| null` | Always receives `null` from page.tsx; fetches client-side |
| `CohortCalendarTabs` | `cohortEvents, title, externalSelectedCohort, newsletterData` | Full interactive monthly calendar |
| `MonthGrid` | `events, currentMonth, onEventClick, show*` | Colored dots per event layer (many boolean flags) |
| `NewsletterWidget` | `data: { sourceUrl, title, sections }` | Accordion sections with read-tracking |
| `MyWeekWidget` | `data, selectedCohort, isExpanded, onExpandChange` | Expandable weekly summary |

## File Naming Conventions

| Type | Pattern | Example |
|------|---------|---------|
| Course ICS | `ewmba{courseNum}_{cohort}_{term}.ics` or descriptive | `ewmba201b_macro_blue_spring2026.ics`, `DataDecisions-Blue.ics` |
| Gmail newsletter | `{YYYY-MM-DD}-{slug}.md` | `2026-01-28-ew-wire-week-of-january-26-2026.md` |
| Static cache | `{cache-key}.json` | `dashboard-data.json` |
