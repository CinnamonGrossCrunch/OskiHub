# Newsletter Events Calendar Integration - Bug Fixes & Solutions

**Date:** November 16, 2025  
**Status:** ✅ RESOLVED  
**Commits:** `0dd24e6`, `fef4ea9`, `4966548`, `55481ce`, `7104847`

---

## Table of Contents
1. [Problem Overview](#problem-overview)
2. [Root Causes Identified](#root-causes-identified)
3. [Solutions Implemented](#solutions-implemented)
4. [Technical Deep Dive](#technical-deep-dive)
5. [Deployment & Caching Challenges](#deployment--caching-challenges)
6. [Lessons Learned](#lessons-learned)
7. [Code References](#code-references)

---

## Problem Overview

Newsletter events were displaying correctly in the **MyWeek widget** but **not appearing in the calendar grid** on production deployment (www.oski.app).

### Initial Symptoms
- ✅ Local development: Newsletter events displayed
- ❌ Production: "Converted 0 newsletter events from 7 sections"
- ❌ Calendar grid showed no purple newsletter events
- ❌ Build logs indicated successful compilation but zero events extracted

---

## Root Causes Identified

### 1. Missing `timeSensitive` Field from AI
**Issue:** Newsletter API returns organized sections/items, but the AI does not populate the `timeSensitive` field with extracted dates.

**Discovery:**
```javascript
console.log(item.timeSensitive); // undefined
```

**Impact:** CohortCalendarTabs relied on `item.timeSensitive.dates` which was always `undefined`, causing zero events to be created.

---

### 2. No Regex Fallback in Calendar Component
**Issue:** MyWeek widget had regex fallback for date extraction, but CohortCalendarTabs did not.

**Code Comparison:**
```typescript
// MyWeek Widget (WORKING):
if (item.timeSensitive?.dates) {
  // Use AI dates
} else {
  // Fallback to regex extraction ✅
}

// CohotCalendarTabs (BROKEN):
if (item.timeSensitive?.dates) {
  // Use AI dates
} else {
  // No fallback ❌
}
```

---

### 3. Incomplete Regex Patterns
**Issue:** Initial regex only matched dates with day-of-week prefix (e.g., "Sunday, Nov 16") and missed standalone dates (e.g., "Nov 15", "Dec 1").

**Original Pattern:**
```javascript
// Only matched: "Sunday, Nov 16"
/\b(?:Mon|Tues?|Wed...)(?:day)?s?,?\s+(?:Jan|Feb...)\.?\s+\d{1,2}/gi
```

**Missing Examples:**
- "Nov 15" ❌
- "Dec 1" ❌
- "May 23, 2026" ❌

---

### 4. JavaScript Date Parsing Year Bug (2001/2024 Issue)
**Issue:** Dates were being parsed as year **2001** or **2024** instead of **2025**.

**Root Cause:**
```javascript
// JavaScript Date constructor bug:
new Date("Sunday, Nov 16, 2025") 
// → 2024-11-16 (WRONG! Day-of-week doesn't match 2025, so JS uses current year)

new Date("Nov 16") 
// → 2001-11-16 (WRONG! Defaults to 2001 when no year provided)
```

**Console Evidence:**
```javascript
sampleEvent: {
  start: '2024-11-16T20:00:00.000Z', // ❌ Wrong year!
  // ...
}
```

**Impact:** Events were created but filtered out because they were in the wrong year:
```javascript
totalNewsletterEvents: 17,
eventsForThisMonth: 0  // All filtered out due to wrong year!
```

---

### 5. Duplicate Date Extractions
**Issue:** Same date mentioned multiple times in one item created duplicate events.

**Example:**
```html
<h4>Biz Comm 2026 Enrollment Deadline</h4>
<p>Sunday, Nov 16 at 11:59PM PST</p>
<ul>
  <li>Form is due by Sunday, Nov 16 at 11:59PM PT.</li>
</ul>
```

**Result:**
- Regex matched "Sunday, Nov 16" → `2025-11-16`
- Regex matched "Nov 16" → `2025-11-16`
- Created **2 events** for the same date/item

---

### 6. Modal Rendering Duplicates
**Issue:** EventDetailModal showed the same event twice when displaying 3+ events on one date.

**Bug in Rendering Logic:**
```typescript
// Main list: Shows ALL events
newsletterEvent.multipleEvents.map((event, index) => ...)

// Grid below: Shows events starting from index 2
newsletterEvent.multipleEvents.slice(2).map((event, index) => ...)
```

**Result:** Events at index 2+ appeared in **both** sections.

---

### 7. Aggressive Browser & CDN Caching
**Issue:** After deploying fixes, browsers continued serving stale JavaScript bundles for hours.

**Evidence:**
```javascript
// Same bundle hash across multiple deployments:
page-2dcec73b9f0669a2.js  // Stale bundle served for 2+ hours
```

**Contributing Factors:**
- Vercel CDN aggressive caching
- `ignoreCommand` in vercel.json skipped deployments for non-code changes
- No cache-control headers on static assets

---

## Solutions Implemented

### Solution 1: Add Regex Fallback to CohortCalendarTabs
**File:** `app/components/CohortCalendarTabs.tsx`

**Implementation:**
```typescript
// Primary: Check if item has time-sensitive data from AI
if (item.timeSensitive && item.timeSensitive.dates && item.timeSensitive.dates.length > 0) {
  datesToProcess = item.timeSensitive.dates;
} else {
  // Fallback: Extract dates from HTML content using regex
  const content = item.html?.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  // ... regex extraction
}
```

**Commit:** `b28b7bd`

---

### Solution 2: Enhanced Regex Patterns
**File:** `app/components/CohortCalendarTabs.tsx`, `lib/my-week-analyzer.ts`

**Implementation:**
```typescript
const datePatterns = [
  // Pattern 1: Day name + Month + Date (e.g., "Sunday, Nov 16" or "Friday Nov 21")
  /\b(?:Mon|Tues?|Wed(?:nes)?|Thu(?:rs)?|Fri|Sat(?:ur)?|Sun)(?:day)?s?,?\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2}(?:,?\s+\d{4})?\b/gi,
  
  // Pattern 2: Month + Date (e.g., "Nov 15" or "Dec 1" or "May 23, 2026")
  /\b(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{1,2}(?:,?\s+\d{4})?\b/gi
];

const allMatches: string[] = [];
datePatterns.forEach(pattern => {
  const matches = content.match(pattern);
  if (matches) {
    allMatches.push(...matches);
  }
});
```

**Coverage:**
- ✅ "Sunday, Nov 16"
- ✅ "Nov 15"
- ✅ "Dec 1"
- ✅ "May 23, 2026"
- ✅ "Tuesday Nov 18"

**Commit:** `653d6b0`

---

### Solution 3: Fix Year Parsing Bug
**File:** `app/components/CohortCalendarTabs.tsx`, `lib/my-week-analyzer.ts`

**Implementation:**
```typescript
// Strip day-of-week (Sunday, Monday, etc.) to avoid JS parsing bugs
const cleanDateStr = dateStr.replace(/^\w+,?\s+/, '');
//  "Sunday, Nov 16" → "Nov 16"

// Check if date string includes a year
const hasYear = /\d{4}/.test(cleanDateStr);

let parsedDate: Date;
if (hasYear) {
  // Has year, parse directly
  parsedDate = new Date(cleanDateStr);
} else {
  // No year - add newsletter year (extracted from title)
  const newsletterYear = parseInt(newsletterData.title?.match(/\d{1,2}-\d{1,2}-(\d{4})/)?.[1]) || currentYear;
  parsedDate = new Date(cleanDateStr + ', ' + newsletterYear);
}
```

**Why It Works:**
- Strips problematic day-of-week prefix
- Explicitly adds newsletter year (2025) when missing
- Avoids JavaScript's default year fallback (2001)

**Commit:** `0dd24e6`

---

### Solution 4: Deduplicate Extracted Dates
**File:** `app/components/CohortCalendarTabs.tsx`, `lib/my-week-analyzer.ts`

**Implementation:**
```typescript
// Before deduplication:
datesToProcess = ['2025-11-16', '2025-11-16', '2025-11-18']

// Deduplicate using Set
datesToProcess = [...new Set(datesToProcess)];

// After deduplication:
datesToProcess = ['2025-11-16', '2025-11-18']  // ✅ No duplicates
```

**Result:** Each unique date per newsletter item creates exactly one event.

**Commit:** `fef4ea9`

---

### Solution 5: Fix Modal Duplicate Rendering
**File:** `app/components/EventDetailModal.tsx`

**Before:**
```typescript
// Main list: Shows ALL events
<div className="flex flex-col gap-4">
  {newsletterEvent.multipleEvents.map((individualEvent, index) => (
    // ... render event
  ))}
</div>

// Grid: Shows events 3+
{newsletterEvent.multipleEvents.length > 2 && (
  <div className="grid gap-4">
    {newsletterEvent.multipleEvents.slice(2).map((individualEvent, index) => (
      // ... render event AGAIN ❌
    ))}
  </div>
)}
```

**After:**
```typescript
// Main list: Shows FIRST 2 events only
<div className="flex flex-col gap-4">
  {newsletterEvent.multipleEvents.slice(0, 2).map((individualEvent, index) => (
    // ... render event
  ))}
</div>

// Grid: Shows events 3+
{newsletterEvent.multipleEvents.length > 2 && (
  <div className="grid gap-4">
    {newsletterEvent.multipleEvents.slice(2).map((individualEvent, index) => (
      // ... render event (no duplicates!) ✅
    ))}
  </div>
)}
```

**Commit:** `4966548`

---

### Solution 6: Cache-Control Headers
**File:** `vercel.json`

**Implementation:**
```json
{
  "headers": [
    {
      "source": "/api/:path*",
      "headers": [
        { "key": "Cache-Control", "value": "s-maxage=0, must-revalidate" }
      ]
    },
    {
      "source": "/_next/static/chunks/:path*",
      "headers": [
        { "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }
      ]
    },
    {
      "source": "/_next/static/:path*.js",
      "headers": [
        { "key": "Cache-Control", "value": "public, max-age=3600, stale-while-revalidate=86400" }
      ]
    }
  ]
}
```

**Strategy:**
- **API routes:** No caching (`s-maxage=0`)
- **Hashed chunks:** Long-term cache (1 year, immutable)
- **Page bundles:** 1-hour browser cache + 24-hour stale-while-revalidate

**Result:** Browsers revalidate after 1 hour instead of serving stale code indefinitely.

**Commit:** `7104847`

---

## Technical Deep Dive

### Date Extraction Flow

```
Newsletter Item
    ↓
Extract HTML content
    ↓
Strip HTML tags
    ↓
Apply regex patterns (2 patterns)
    ↓
Match dates:
  - "Sunday, Nov 16"
  - "Nov 16 at 11:59PM"
  - "Nov 18"
    ↓
Clean day-of-week:
  - "Nov 16"
  - "Nov 16 at 11:59PM" → "Nov 16"
  - "Nov 18"
    ↓
Check for year in string:
  - Has year? Parse directly
  - No year? Add newsletter year (2025)
    ↓
Parse to Date objects:
  - new Date("Nov 16, 2025")
  - new Date("Nov 18, 2025")
    ↓
Convert to YYYY-MM-DD:
  - "2025-11-16"
  - "2025-11-16" (duplicate!)
  - "2025-11-18"
    ↓
Deduplicate with Set:
  - "2025-11-16"
  - "2025-11-18"
    ↓
Create calendar events:
  - Event 1: "Item Title" on 2025-11-16
  - Event 2: "Item Title" on 2025-11-18
```

### UID Generation

```typescript
const cleanDate = dateStr.split('T')[0].replace(/-/g, '');
// "2025-11-16" → "20251116"

const uid = `newsletter-${sectionIdx}-${itemIdx}-${cleanDate}`;
// Example: "newsletter-0-1-20251116"
```

**Format:** `newsletter-{section}-{item}-{YYYYMMDD}`

**Uniqueness:** Each combination of section, item, and date creates a unique UID.

---

## Deployment & Caching Challenges

### Challenge 1: Vercel `ignoreCommand`
**Issue:** Empty commits were skipped by Vercel's build system.

**Config in `vercel.json`:**
```json
{
  "ignoreCommand": "git diff --quiet HEAD^ HEAD -- . ':(exclude)*.md' ':(exclude)LICENSE' ':(exclude).gitignore'"
}
```

**Solution:** Made real file changes (e.g., modified `next.config.js` with cache buster comments).

### Challenge 2: Browser Cache Persistence
**Issue:** Hard refresh (Ctrl+Shift+R) and Incognito mode still served stale bundles.

**Root Cause:** Vercel CDN was serving cached bundles despite new deployments.

**Evidence:**
```
Deployment 1: page-2dcec73b9f0669a2.js
Deployment 2: page-2dcec73b9f0669a2.js (same hash! ❌)
Deployment 3: page-2dcec73b9f0669a2.js (same hash! ❌)
```

**Solution:** Implemented cache-control headers to force revalidation after 1 hour.

### Challenge 3: GitHub Actions Cache
**Initial Suspicion:** Stale warm-cache workflow data.

**Investigation:**
```bash
gh cache list
# Found 6.28 KB stale cache from Nov 10

gh cache delete <cache-id>
# Deleted stale cache

gh workflow run warm-cache.yml
# Manually triggered fresh cache
```

**Result:** Cache was refreshed (55 KB healthy), but this wasn't the root cause. The real issue was browser/CDN caching.

---

## Lessons Learned

### 1. JavaScript Date Parsing Quirks
**Never trust `new Date()` with ambiguous date strings.**

❌ **Avoid:**
```javascript
new Date("Sunday, Nov 16, 2025")  // May ignore year if day doesn't match
new Date("Nov 16")                // Defaults to year 2001
```

✅ **Prefer:**
```javascript
// Clean the input first
const clean = "Sunday, Nov 16".replace(/^\w+,?\s+/, '');  // "Nov 16"
const withYear = clean + ', 2025';
new Date(withYear);  // Reliable!
```

### 2. Vercel CDN Caching is Aggressive
**Always set explicit cache-control headers for static assets.**

Default Vercel behavior caches bundles aggressively. Without explicit headers, browsers may serve stale code for extended periods.

**Best Practice:**
- API routes: No cache
- Hashed static files: Long cache (immutable)
- Page bundles: Short cache with revalidation

### 3. Regex for Date Extraction Needs Multiple Patterns
**Natural language dates appear in many formats.**

A single regex pattern is insufficient. Use multiple patterns and combine results:
- Pattern 1: Full format with day-of-week
- Pattern 2: Month + date only
- Pattern 3: ISO dates (if needed)

### 4. Deduplication is Critical
**Same data may appear multiple times in different formats.**

Always deduplicate extracted data:
```typescript
const unique = [...new Set(array)];
```

### 5. Modal/List Rendering Logic Requires Careful Slicing
**When showing "first N items" then "overflow items", be explicit about ranges.**

❌ **Wrong:**
```typescript
mainList.map(...)        // Shows all items
overflowList.slice(N)... // Shows items N+ AGAIN
```

✅ **Correct:**
```typescript
mainList.slice(0, N).map(...)  // Shows first N items
overflowList.slice(N).map(...) // Shows items N+ only
```

---

## Code References

### Files Modified
1. **`app/components/CohortCalendarTabs.tsx`**
   - Lines 110-200: Newsletter conversion with regex fallback
   - Lines 155-180: Year parsing fix and deduplication

2. **`lib/my-week-analyzer.ts`**
   - Lines 315-375: Matching regex patterns for MyWeek widget
   - Consistent date extraction logic with calendar

3. **`app/components/EventDetailModal.tsx`**
   - Line 419: Changed from `.map()` to `.slice(0, 2).map()`

4. **`vercel.json`**
   - Lines 51-83: Added cache-control headers

5. **`next.config.js`**
   - Line 2: Cache buster comments for forced rebuilds

### Key Functions
- `convertNewsletterToEvents()` - Main conversion function in CohortCalendarTabs
- `extractNewsletterEventsForWeek()` - MyWeek date extraction
- Date regex patterns (2 patterns for comprehensive coverage)
- Set-based deduplication

---

## Testing Checklist

✅ **Newsletter events appear in calendar grid**
- Purple background events with 💡 icon
- Events on correct dates (Nov 16, Nov 18, Nov 21, etc.)

✅ **Year parsing correct**
- Events show 2025, not 2001 or 2024
- Console logs show correct ISO dates: `2025-11-16T...`

✅ **No duplicate dates**
- Same date mentioned twice in item only creates 1 event
- Console: "Extracted X valid date(s) (deduplicated)"

✅ **No duplicate modal entries**
- Each event appears once in modal
- First 2 events: collapsed view
- Events 3+: expanded in grid

✅ **Cache behavior**
- Fresh deployments show new bundle hashes
- Browsers revalidate after 1 hour
- Incognito mode shows latest code

✅ **Consistent behavior**
- Calendar and MyWeek widget use same date extraction logic
- Events appear in both components

---

## Future Improvements

### 1. AI Enhancement
**Goal:** Improve AI to consistently populate `timeSensitive` field.

**Benefit:** Avoid regex fallback entirely.

### 2. Date Range Detection
**Enhancement:** Detect date ranges (e.g., "Nov 12 - Nov 16") and create single multi-day event instead of separate events.

### 3. Time Parsing
**Enhancement:** Extract specific times (e.g., "11:59PM PST") instead of defaulting to all-day events.

### 4. Priority/Category from Content
**Enhancement:** Use AI or keyword detection to categorize events:
- Deadlines (high priority)
- Events (medium priority)
- Announcements (low priority)

### 5. Automated Testing
**Need:** Unit tests for date extraction regex patterns.

**Example Test Cases:**
```typescript
expect(extractDates("Sunday, Nov 16")).toEqual(['2025-11-16']);
expect(extractDates("Nov 15 and Dec 1")).toEqual(['2025-11-15', '2025-12-01']);
expect(extractDates("May 23, 2026")).toEqual(['2026-05-23']);
```

---

## Related Documentation
- [MY_WEEK_DATA_FLOW.md](./MY_WEEK_DATA_FLOW.md) - MyWeek widget data flow
- [NEWSLETTER_CALENDAR_REFACTOR.md](./NEWSLETTER_CALENDAR_REFACTOR.md) - Calendar refactoring notes
- [VERCEL_OPTIMIZATION.md](./VERCEL_OPTIMIZATION.md) - Vercel deployment optimizations

---

**Document Status:** Complete  
**Last Updated:** November 16, 2025  
**Author:** Development Team  
**Review Status:** ✅ Verified in Production (www.oski.app)
