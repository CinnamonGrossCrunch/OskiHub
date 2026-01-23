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

## ICS Calendar Integration Guide

### Quick Reference: Chat → Working ICS File

**Process:** User provides ICS content → Create/update `.ics` file → Register in config → Add UI color → Commit → Deploy

#### Step 1: Create ICS File
```bash
# Location: public/[course]_[cohort]_[term].ics
# Example: public/ewmba202_accounting_blue_spring2026.ics
```

**ICS Template:**
```ics
BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//OSKI Hub//EWMBA [COURSE] [COHORT]//EN
CALSCALE:GREGORIAN
METHOD:PUBLISH
X-WR-CALNAME:EWMBA [COURSE] [NAME] ([COHORT])
X-WR-CALDESC:[TERM] Schedule - [INSTRUCTOR]
BEGIN:VEVENT
DTSTAMP:20260101T000000Z
UID:[course]-[term]-[cohort]-[identifier]
DTSTART:20260107T180000
DTEND:20260107T213000
SUMMARY:[Class Title]
DESCRIPTION:[Details]\n\nObjectives:\n• [Point 1]\n\nPre-Class:\n• [Resource]: [URL]\n\nCourse Page: [URL]
LOCATION:[Building Room]
URL;VALUE=URI:[Course URL]
END:VEVENT
END:VCALENDAR
```

**Required Fields:**
- `UID`: Unique ID (format: `ewmba[course]-sp26-[cohort]-[identifier]`)
- `DTSTART`/`DTEND`: Format `YYYYMMDDTHHmmss` (UTC, will convert to PST)
- `SUMMARY`: Event title (keep concise)
- `DESCRIPTION`: Use `\n` for newlines, escape special chars
- `URL;VALUE=URI`: Direct link (use course home or assignments page, NOT week pages)

**Common Issues:**
- ❌ **Week-specific URLs**: Use `https://bcourses.berkeley.edu/courses/[ID]` not `/pages/week-X`
- ❌ **Wrong course IDs**: Verify course ID matches (e.g., 1549713 for accounting, 1549648 for macro)
- ❌ **Misplaced events**: Check event belongs to correct course (macro events in macro files only)
- ❌ **Missing URLs**: All events should have a URL field pointing to relevant page

#### Step 2: Register in `lib/icsUtils.ts`
```typescript
// Add to COHORT_FILES object
export const COHORT_FILES = {
  blue: [
    'ewmba202_accounting_blue_spring2026.ics',
    'ewmba201b_macro_blue_spring2026.ics',
    // ... add new file
  ],
  gold: [
    'ewmba202_accounting_gold_spring2026.ics',
    'ewmba201b_macro_gold_spring2026.ics',
    // ... add new file
  ]
};
```

#### Step 3: Add Course Color in `app/components/MonthGrid.tsx`
```typescript
// In getCourseColor() function
if (event.source.includes('201b_macro')) {
  return `${glassBase} bg-blue-900/60 border-blue-700/50 text-white ${hoverGold}`;
}
if (event.source.includes('202_accounting')) {
  return `${glassBase} bg-teal-700/50 border-teal-600/50 text-white ${hoverGold}`;
}
// Add new course with unique color
```

**Course Color Palette:**
| Course | Color | Tailwind Classes |
|--------|-------|------------------|
| 201A Microeconomics | Forest Green | `bg-green-800/35 border-green-700/40` |
| 201B Macroeconomics | Navy Blue | `bg-blue-900/60 border-blue-700/50` |
| 202 Financial Accounting | Teal | `bg-teal-700/50 border-teal-600/50` |
| 203 Financial Management | Amber | `bg-amber-700/50 border-amber-600/50` |
| 204 Operations & Analytics | Slate | `bg-slate-700/50 border-slate-600/50` |
| 205 Leading People | Crimson | `bg-red-800/35 border-red-700/40` |
| 206 Data & Decisions | Sky Blue | `bg-sky-700/50 border-sky-600/50` |
| 207 Corporate Finance | Indigo | `bg-indigo-800/50 border-indigo-700/50` |
| 208 Marketing | Orange | `bg-orange-600/50 border-orange-500/50` |
| 209 Strategic Management | Purple | `bg-purple-800/50 border-purple-700/50` |
| 210 Ethics | Rose | `bg-rose-700/50 border-rose-600/50` |
| 211 Negotiations | Emerald | `bg-emerald-700/50 border-emerald-600/50` |
| 212 Entrepreneurship | Fuchsia | `bg-fuchsia-800/50 border-fuchsia-700/50` |
| Teams@Haas | Violet | `bg-violet-800/40 border-violet-900/40` |

**For new courses not listed above:**
- Choose a distinct color not already used
- Use format: `bg-[color]-[700-900]/[35-60] border-[color]-[600-800]/[40-50]`
- Available unused colors: lime, cyan, yellow, pink, stone, zinc, neutral, gray, warmGray
- Maintain consistent opacity (35-60 for background, 40-50 for border)
- Add to MonthGrid.tsx getCourseColor() function
- Update this table with the new color assignment

#### Step 4: Commit & Deploy
```bash
git add public/[filename].ics lib/icsUtils.ts app/components/MonthGrid.tsx
git commit -m "Add [Course] [Term] calendars (Blue & Gold)"
git push origin main
```

#### Step 5: Verify Production
```bash
# Wait 90 seconds for Vercel deploy
# Force cache refresh
curl "https://www.oski.app/api/unified-dashboard?refresh=true"
```

### Troubleshooting

**Events not appearing:**
1. Check file is in `public/` directory
2. Verify filename in `COHORT_FILES` array matches exactly
3. Confirm `.ics` extension is present
4. Force cache refresh: `?refresh=true`

**Wrong links showing:**
- Search all ICS files for old course IDs: `grep -r "1544880" public/*.ics`
- Replace with correct course ID
- Common mistake: copying from old semester files with outdated URLs

**Events on wrong cohort:**
- Verify event is in correct ICS file (blue vs gold)
- Check `COHORT_FILES` mapping is correct
- Remove duplicate events from wrong files

**Dev mode not updating:**
- Cache bypass only works for `COHORT_EVENTS` and `DASHBOARD_DATA` keys
- Restart dev server: `npm run dev`
- Check `lib/cache.ts` dev mode skip logic

### Advanced: Batch Updates

**Updating multiple weeks:**
```typescript
// Pattern for bulk event creation
const weeks = [
  { date: '20260107', topic: 'Intro' },
  { date: '20260114', topic: 'Growth' },
  // ...
];
weeks.forEach((week, idx) => {
  // Generate VEVENT blocks
});
```

**Adding pre-class materials:**
```
DESCRIPTION:Topic: [Name]\n\nObjectives:\n• [Point 1]\n• [Point 2]\n\nPre-Class Materials (Required):\n• [Title]: [URL]\n• [Title]: [URL]\n\nOptional Readings:\n• [Title]: [URL]\n\nCourse Page: [URL]
```

### Validation Checklist

Before committing:
- [ ] All URLs point to correct course (verify course ID)
- [ ] No week-specific page URLs (use course home or assignments)
- [ ] Events in correct cohort files (blue vs gold)
- [ ] UIDs are unique and follow naming convention
- [ ] Times are in UTC (will display as PST automatically)
- [ ] Descriptions use `\n` for line breaks, no HTML
- [ ] File registered in `lib/icsUtils.ts`
- [ ] Course color added in `MonthGrid.tsx`
- [ ] Tested in dev mode (localhost:3000)

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
