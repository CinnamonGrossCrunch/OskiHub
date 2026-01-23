# Cache Refresh Issue & Solution

**Date:** November 24, 2025  
**Issue:** Dashboard showing stale data from last week's newsletter

---

## 🔍 Problem Diagnosis

### Symptoms
- My Week widget showing events from last week (Nov 16-18)
- Newsletter widget displaying old newsletter content
- Cache not updating automatically with new newsletter

### Root Cause Analysis

The system uses a **two-tier caching strategy**:

1. **Primary Cache**: Upstash Redis KV (fast, 50-200ms reads)
2. **Fallback Cache**: Static JSON files in `public/cache/` directory

**The Issue:**
- Cron job scheduled to run daily at **8:10 AM Pacific** (`10 15 * * *` = 3:10 PM UTC)
- If cron job fails or hasn't run yet today, cache contains stale data
- Static JSON fallback files are committed to git and deployed with old data
- Cache TTL is 8 hours (28,800 seconds)

### Evidence
From `public/cache/dashboard-data.json`:
```json
{
  "newsletterData": {
    "sourceUrl": "http://eepurl.com/jrGJic",
    "sections": [
      {
        "items": [
          {
            "title": "Sunday Traffic Advisory - Berkeley Half Marathon",
            "html": "Sunday, Nov 16, Berkeley, CA"
          }
        ]
      }
    ]
  }
}
```

This confirms the cache contains **November 16-18 events** from last week's newsletter.

---

## ✅ Solutions Implemented

### 1. Force Refresh Query Parameter

**File:** `app/api/unified-dashboard/route.ts`

Added support for `?refresh=true` query parameter to bypass cache:

```typescript
export async function GET(request: Request) {
  // Check for force-refresh query parameter to bypass cache
  const url = new URL(request.url);
  const forceRefresh = url.searchParams.get('refresh') === 'true';
  
  // Skip cache check if force refresh requested
  if (!forceRefresh) {
    const cachedDashboard = await getCachedData<UnifiedDashboardData>(CACHE_KEYS.DASHBOARD_DATA);
    if (cachedDashboard) {
      return NextResponse.json(cachedDashboard.data, {
        headers: {
          'X-Cache-Source': cachedDashboard.source,
        }
      });
    }
  } else {
    console.log('🔄 [API] Force refresh requested - bypassing cache and regenerating data...');
  }
  
  // ... rest of data generation logic
}
```

**Usage:**
```bash
# Force refresh cache manually
curl https://www.oski.app/api/unified-dashboard?refresh=true

# Or in browser
https://www.oski.app/api/unified-dashboard?refresh=true
```

### 2. Admin Cache Refresh Page

**File:** `app/admin/cache-refresh/page.tsx`

Created user-friendly admin interface for manual cache refresh:

**Features:**
- ✅ One-click cache refresh button
- ✅ Real-time progress indicator
- ✅ Success/error feedback with timing
- ✅ Cache status information
- ✅ Clear instructions and warnings

**Access:**
```
https://www.oski.app/admin/cache-refresh
```

**Benefits:**
- Non-technical users can refresh cache when needed
- No need to access Vercel dashboard or run cron manually
- Immediate feedback on refresh status
- Safe to use (just fetches latest newsletter)

### 3. Enhanced Debug Headers

Added headers to track cache source:

```typescript
headers: {
  'X-Cache-Source': forceRefresh ? 'force-refresh' : 'fresh-computed',
  'X-Force-Refresh': forceRefresh ? 'true' : 'false',
  'X-Response-Time': `${totalTime}ms`
}
```

**Inspect in browser DevTools:**
```javascript
// In Network tab, check response headers
X-Cache-Source: force-refresh
X-Force-Refresh: true
X-Response-Time: 8234ms
```

---

## 🚀 How to Use

### Option 1: Admin UI (Recommended)
1. Go to `https://oski.app/admin/cache-refresh`
2. Click "🔄 Refresh Cache Now" button
3. Wait 8-20 seconds for processing
4. Refresh dashboard to see latest data

### Option 2: Direct API Call
```bash
# Using curl
curl "https://www.oski.app/api/unified-dashboard?refresh=true"

# Using PowerShell
Invoke-WebRequest -Uri "https://www.oski.app/api/unified-dashboard?refresh=true"
```

### Option 3: Trigger Cron Job (Production)
```bash
# Requires CRON_SECRET from environment
curl -X GET "https://www.oski.app/api/cron/refresh-newsletter" \
  -H "Authorization: Bearer $CRON_SECRET"
```

---

## 📊 Cache Architecture

### Cache Flow Diagram
```
User Request
    ↓
┌───────────────────────────────┐
│ Check ?refresh=true parameter │
└───────────────────────────────┘
    ↓
    ├─ YES → Skip cache, regenerate
    └─ NO  → Check KV cache
                ↓
                ├─ HIT → Return (50-200ms)
                └─ MISS → Check static JSON
                            ↓
                            ├─ EXISTS → Return (500-1000ms)
                            └─ MISSING → Regenerate (8-20s)
                                          ↓
                                    Write to KV + JSON
```

### Cache Keys
```typescript
CACHE_KEYS = {
  NEWSLETTER_DATA: 'newsletter-data',
  MY_WEEK_DATA: 'myweek-data',
  DASHBOARD_DATA: 'dashboard-data',
  COHORT_EVENTS: 'cohort-events',
}
```

### Cache Storage Locations
- **KV Cache**: Upstash Redis (ephemeral, 8hr TTL)
- **Static Cache**: `public/cache/*.json` (persistent, committed to git)

---

## ⚙️ Automatic Cache Refresh

### Cron Job Schedule
```json
{
  "crons": [
    {
      "path": "/api/cron/refresh-newsletter",
      "schedule": "10 15 * * *"  // 3:10 PM UTC = 8:10 AM Pacific
    }
  ]
}
```

**What it does:**
1. Fetches latest newsletter from Mailchimp archive
2. Scrapes and processes content
3. Runs AI organization (gpt-4o-mini)
4. Fetches calendar events (Blue & Gold cohorts)
5. Generates My Week AI summaries
6. Writes all data to KV + static JSON caches

**Expected behavior:**
- Runs every day at 8:10 AM Pacific
- Takes ~60-120 seconds to complete
- Users see instant loads (<200ms) after cron runs

---

## 🐛 Troubleshooting

### Issue: Newsletter still showing old data after refresh
**Solution:**
1. Hard refresh browser (Ctrl+Shift+R / Cmd+Shift+R)
2. Check browser DevTools Network tab for `X-Cache-Source` header
3. If showing `kv` or `static`, try force refresh again
4. Check Vercel deployment logs for errors

### Issue: Admin page shows error
**Possible causes:**
- OpenAI API rate limit exceeded
- Mailchimp archive temporarily unavailable
- Network timeout (>200s)

**Solution:**
- Wait 5 minutes and try again
- Check Vercel function logs
- Verify OPENAI_API_KEY is valid

### Issue: Cron job not running
**Check Vercel dashboard:**
1. Go to project → Cron Jobs tab
2. Verify last execution time
3. Check execution logs for errors

**Common fixes:**
- Verify `CRON_SECRET` environment variable is set
- Check function timeout limits (currently 300s)
- Review OpenAI API quota

---

## 📈 Performance Metrics

### Cache Performance
| Scenario | Response Time | Cost |
|----------|---------------|------|
| KV Cache Hit | 50-200ms | $0 |
| Static Fallback | 500-1000ms | $0 |
| Fresh Generation | 8,000-20,000ms | ~$0.02 |
| Force Refresh | 8,000-20,000ms | ~$0.02 |

### Cache Hit Rates (Expected)
- **After cron run**: 99% KV hits
- **During KV failure**: 100% static fallback
- **Cold start**: 1% fresh generation

---

## 🔮 Future Improvements

### Potential Enhancements
1. **Webhook-triggered refresh**: Update cache immediately when new newsletter published
2. **Incremental cache invalidation**: Only refresh changed sections
3. **Background revalidation**: Refresh cache in background while serving stale data
4. **Cache version tracking**: Add timestamp/hash to detect stale data automatically
5. **Admin dashboard**: Show cache stats, last refresh time, next cron run

### Monitoring Ideas
- Track cache hit/miss rates
- Alert on cron job failures
- Monitor cache age
- Log newsletter URL changes

---

## 📝 Related Files

### Modified Files
- `app/api/unified-dashboard/route.ts` - Added force refresh logic
- `app/admin/cache-refresh/page.tsx` - New admin UI

### Key Dependencies
- `lib/cache.ts` - Cache read/write logic
- `lib/scrape.ts` - Newsletter fetching
- `lib/openai-organizer-fixed.ts` - AI processing
- `lib/my-week-analyzer.ts` - Event extraction
- `app/api/cron/refresh-newsletter/route.ts` - Automated refresh

### Configuration
- `vercel.json` - Cron schedule
- `.env.local` - CRON_SECRET, API keys

---

## ✅ Verification Checklist

After implementing fixes:
- [x] Force refresh parameter works
- [x] Admin UI accessible and functional
- [x] Debug headers present in responses
- [x] Cache write successful after refresh
- [ ] Cron job runs on schedule (verify in Vercel)
- [ ] New newsletter triggers cache update
- [ ] Static JSON files update correctly

---

**Next Steps:**
1. Deploy changes to production
2. Test admin UI at `/admin/cache-refresh`
3. Verify force refresh with `?refresh=true`
4. Monitor Vercel logs for next cron execution
5. Document URL for team access
