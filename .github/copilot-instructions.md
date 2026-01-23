# OskiHub - Copilot Instructions

> UC Berkeley EWMBA Dashboard | Next.js 15.5 + TypeScript + Tailwind  
> Production: https://www.oski.app | Vercel-hosted  
> Repo: https://github.com/CinnamonGrossCrunch/OskiHub

## Architecture Overview

OskiHub aggregates EWMBA data into a unified dashboard:
- **Entry point**: `app/page.tsx` → `ClientDashboard.tsx` → fetches `/api/unified-dashboard`
- **Two newsletter sources**: Mailchimp scraper (Bear Necessities) + Gmail pipeline (Blue Crew, EW Wire)
- **Caching strategy**: Upstash KV (primary, 50ms) → Static JSON fallback (500ms) → Fresh regeneration (20s)

### Key Directories
| Path | Purpose |
|------|---------|
| `app/api/unified-dashboard/` | Main endpoint - aggregates all dashboard data |
| `app/api/cron/` | Vercel cron handlers (daily newsletter + cache refresh) |
| `app/api/gmail-newsletters/` | Serves Gmail-sourced newsletters from `content/newsletters/` |
| `app/api/github-webhook/` | Receives GitHub push events → triggers Vercel redeploy |
| `app/components/` | React components (`ClientDashboard.tsx` is shell) |
| `lib/` | Core logic: `cache.ts`, `scrape.ts`, `aiClient.ts`, `date-utils.ts`, `icsUtils.ts` |
| `public/*.ics` | Course calendars per cohort |
| `public/cache/` | Static JSON fallbacks (committed to repo) |
| `content/newsletters/` | Gmail-ingested newsletters (markdown + frontmatter) |
| `scripts/` | Google Apps Scripts (reference copies - actual scripts live in script.google.com) |

## Gmail Newsletter Pipeline

**Multi-system pipeline for auto-ingesting newsletters from Gmail to the dashboard:**

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

getConsistentToday()       // Today in Berkeley time (not UTC)
parseICSDate(isoString)    // Parse ICS dates correctly
getConsistentWeekRange()   // Week boundaries in Berkeley time
```

### 2. Hybrid Cache (`lib/cache.ts`)
```typescript
import { getCachedData, setCachedData, CACHE_KEYS } from '@/lib/cache';

// Reading: returns { data, source: 'kv' | 'static' } or null
const cached = await getCachedData(CACHE_KEYS.DASHBOARD_DATA);

// Writing: ALWAYS use writeStatic: true in production code paths
await setCachedData(CACHE_KEYS.DASHBOARD_DATA, data, { writeStatic: true });
```
Cache keys: `DASHBOARD_DATA`, `NEWSLETTER_DATA`, `MY_WEEK_DATA`, `COHORT_EVENTS`

### 3. AI Client (`lib/aiClient.ts`)
```typescript
import { runAI } from '@/lib/aiClient';

const result = await runAI({ 
  prompt: '...', 
  reasoningEffort: 'low',     // 'minimal' | 'low' | 'medium' | 'high'
  maxOutputTokens: 1200       // Optional, default 1200
});
// Returns: { model, modelsTried, ms, text }
```
Model fallback chain configured via `OPENAI_MODEL` and `OPENAI_MODEL_FALLBACKS` env vars.

### 4. Vercel Cron Jobs (`vercel.json`)
| Endpoint | UTC Schedule | Pacific | Purpose |
|----------|--------------|---------|---------|
| `/api/cron/refresh-newsletter` | `10 15 * * *` | 8:10 AM | Newsletter scrape + AI |
| `/api/cron/refresh-cache` | `0 7 * * *` | 11:00 PM | Calendar refresh |

All cron endpoints require: `Authorization: Bearer ${CRON_SECRET}`

## Cohort System & Calendar Management

**Two cohorts**: Blue and Gold (separate class schedules, shared program events)
- User preference: `localStorage['global-cohort-preference']` (default: 'blue')
- Shared calendars: `teams@Haas.ics`, `cal_bears_home_*.ics`

### Adding a New Course Calendar
1. Export ICS from bCourses/Canvas
2. Save to `public/` as `ewmba{courseNum}_{cohort}_{term}.ics` (e.g., `ewmba203_blue_spring2026.ics`)
3. Add filename to `COHORT_FILES` in `lib/icsUtils.ts`:
```typescript
const COHORT_FILES = {
  blue: ['ewmba203_blue_spring2026.ics', ...existing],
  gold: ['ewmba203_gold_spring2026.ics', ...existing]
};
```
4. Commit and push (dev mode bypasses cache for instant testing)

## Environment Variables

### Required (App won't function without these)
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
| `RESEND_API_KEY` | Email notifications |
| `NOTIFICATION_EMAIL` | Alert recipient email |

## Common Mistakes

| ❌ Don't | ✅ Do Instead |
|---------|---------------|
| `new Date()` | `getConsistentToday()` from `lib/date-utils.ts` |
| `setCachedData(key, data)` | `setCachedData(key, data, { writeStatic: true })` |
| Edit `scripts/*.js` directly | Edit in Google Apps Script, then copy to repo |
| Assume cron succeeded | Check Vercel logs, add failsafe validations |
| Skip build before commit | Run `npm run build` (catches type errors) |

## API Response: `/api/unified-dashboard`

```typescript
interface UnifiedDashboardData {
  newsletterData: {
    sourceUrl: string;
    title?: string;
    sections: { sectionTitle: string; items: { title: string; html: string }[] }[];
  };
  myWeekData: {
    weekStart: string;
    weekEnd: string;
    blueEvents: CalendarEvent[];
    goldEvents: CalendarEvent[];
    blueSummary?: string;
    goldSummary?: string;
  };
  cohortEvents: {
    blue: CalendarEvent[];
    gold: CalendarEvent[];
    original: CalendarEvent[];  // Rich calendar.ics events
    launch: CalendarEvent[];    // UC Launch Accelerator
    calBears: CalendarEvent[];  // Cal Bears home games
    campusGroups: CalendarEvent[];
  };
  processingInfo: { totalTime: number; newsletterTime: number; calendarTime: number; myWeekTime: number };
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
| AI timeout | Increase `maxDuration` in route exports | [`TIME_SENSITIVE_LOGIC_ANALYSIS.md`](../markdown_files/TIME_SENSITIVE_LOGIC_ANALYSIS.md) |
| Webhook not firing | Check GitHub webhook deliveries | [`GITHUB_WEBHOOK_SETUP.md`](../markdown_files/GITHUB_WEBHOOK_SETUP.md) |
| Cron not running | Verify `CRON_SECRET` in Vercel | [`VERCEL_CRON_SECRET_SETUP.md`](../markdown_files/VERCEL_CRON_SECRET_SETUP.md) |

## Documentation Index

| Guide | Purpose |
|-------|---------|
| [`ENV_SETUP.md`](../markdown_files/ENV_SETUP.md) | All environment variables with generation commands |
| [`CACHE_SETUP_GUIDE.md`](../markdown_files/CACHE_SETUP_GUIDE.md) | Upstash Redis configuration |
| [`QUICK_SETUP.md`](../markdown_files/QUICK_SETUP.md) | 5-minute setup checklist |
| [`QUICK_CACHE_REFRESH_GUIDE.md`](../markdown_files/QUICK_CACHE_REFRESH_GUIDE.md) | Manual cache refresh commands |
| [`ICS_CALENDAR_GUIDE.md`](../markdown_files/ICS_CALENDAR_GUIDE.md) | Calendar troubleshooting & adding courses |
| [`MY_WEEK_DATA_FLOW.md`](../markdown_files/MY_WEEK_DATA_FLOW.md) | AI summary architecture |
| [`MY_WEEK_DATE_LOGIC.md`](../markdown_files/MY_WEEK_DATE_LOGIC.md) | Week boundary calculations |
| [`TIME_SENSITIVE_LOGIC_ANALYSIS.md`](../markdown_files/TIME_SENSITIVE_LOGIC_ANALYSIS.md) | Deadline detection logic |
| [`GITHUB_WEBHOOK_SETUP.md`](../markdown_files/GITHUB_WEBHOOK_SETUP.md) | GitHub → Vercel webhook |
| [`GITHUB_ACTION_SETUP.md`](../markdown_files/GITHUB_ACTION_SETUP.md) | GitHub Actions configuration |
| [`NEWSLETTER_SYNC_SETUP.md`](../markdown_files/NEWSLETTER_SYNC_SETUP.md) | Gmail pipeline setup |
| [`WEBHOOK_QUICK_SETUP.md`](../markdown_files/WEBHOOK_QUICK_SETUP.md) | Quick webhook reference |
| [`VERCEL_CRON_SECRET_SETUP.md`](../markdown_files/VERCEL_CRON_SECRET_SETUP.md) | Cron authentication |
| [`scripts/GMAIL_DISPATCHER_SETUP.md`](../scripts/GMAIL_DISPATCHER_SETUP.md) | Google Apps Script setup |

## Developer Commands

**Before starting dev server, always kill existing Node processes to avoid port conflicts:**
```bash
# Windows (run this FIRST)
taskkill /F /IM node.exe 2>$null; npm run dev

# Or separately:
taskkill /F /IM node.exe    # Kill all Node processes
npm run dev                  # Then start fresh
```

```bash
npm run dev          # Dev server (cache bypassed for calendar data)
npm run build        # Full build with type checking
npm run type-check   # TypeScript only
npm run build:safe   # Build + verify no API key leakage
```

## Deployment

- **Auto-deploy**: Push to `main` → Vercel builds → `warm-cache.yml` prewarms
- **Manual cache refresh**: `curl -H "Authorization: Bearer $CRON_SECRET" https://oski.app/api/cron/refresh-newsletter`
- **Static fallback**: `public/cache/*.json` committed to repo (used if KV fails)
