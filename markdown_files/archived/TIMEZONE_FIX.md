# Timezone Fix: Calendar Date Shift Issue

**Date**: November 3, 2025  
**Issue**: Calendar events showing 1 day earlier than MyWeek widget and newsletter  
**Root Cause**: UTC timezone conversion when parsing date-only strings

## The Problem

### Observed Behavior:
- **Newsletter**: "Dean's Speaker Series on Wednesday, Nov 6"
- **MyWeek Widget**: Shows correctly as **Wednesday, Nov 6** ✅
- **Calendar Widget**: Shows incorrectly as **Tuesday, Nov 5** ❌

### Why the 1-Day Shift?

When parsing date-only strings like `"2025-11-06"`:

```typescript
// ❌ WRONG WAY (what we were doing):
const eventDate = new Date("2025-11-06");
// JavaScript interprets this as:
// "2025-11-06T00:00:00Z" (midnight UTC)

// When displayed in PST (UTC-8):
// 2025-11-06 00:00 UTC = 2025-11-05 16:00 PST
// Result: Shows as November 5 instead of November 6!
```

The date string `"2025-11-06"` without a time component is parsed as **midnight UTC** (00:00:00Z). When JavaScript converts this to Pacific Standard Time (PST, which is UTC-8), it becomes **4:00 PM on November 5**.

### Why MyWeek Worked Correctly

MyWeek widget doesn't rely on the Date object's display - it compares dates numerically and displays the raw date string from the data. The calendar widget uses `isSameDay()` which is timezone-aware, causing the mismatch.

## The Solution

### Force Local Timezone Parsing

For date-only strings (no 'T' time component), add `'T12:00:00'` to force parsing in **local timezone at noon**:

```typescript
// ✅ CORRECT WAY (fixed):
let eventDate: Date;

if (dateStr.includes('T')) {
  // Has time component (e.g., "2025-11-06T14:00:00"), parse as-is
  eventDate = new Date(dateStr);
} else {
  // Date-only string: force local timezone by adding noon time
  // "2025-11-06" → "2025-11-06T12:00:00"
  eventDate = new Date(dateStr + 'T12:00:00');
}

// Result: 
// 2025-11-06T12:00:00 in local time (PST)
// = 2025-11-06 12:00 PST
// Correctly shows as November 6!
```

### Why Noon (12:00:00)?

Using noon instead of midnight avoids edge cases:
- **Midnight (00:00:00)**: Could shift backwards in some timezones
- **Noon (12:00:00)**: Safe middle-of-day, no DST ambiguity
- **All-day events**: Time doesn't matter for display, only the date

## Code Changes

**File**: `app/components/CohortCalendarTabs.tsx`  
**Function**: Newsletter data conversion in `useEffect`

### Before:
```typescript
const eventDate = new Date(dateStr);
```

### After:
```typescript
let eventDate: Date;

if (dateStr.includes('T')) {
  // Has time component, parse as-is
  eventDate = new Date(dateStr);
} else {
  // Date-only string: parse in local timezone
  // Add 'T12:00:00' to force noon local time
  eventDate = new Date(dateStr + 'T12:00:00');
}
```

## Testing

### Test Cases:

**Date-only strings (common case):**
```
Input: "2025-11-06"
Before: new Date("2025-11-06") → Nov 5, 4PM PST → displays as Nov 5 ❌
After: new Date("2025-11-06T12:00:00") → Nov 6, 12PM PST → displays as Nov 6 ✅
```

**Date with time (edge case):**
```
Input: "2025-11-06T14:00:00"
Before: new Date("2025-11-06T14:00:00") → Nov 6, 2PM → displays correctly ✅
After: new Date("2025-11-06T14:00:00") → Nov 6, 2PM → displays correctly ✅
```

### Verification Steps:

1. **Reload dashboard** to get fresh newsletter data
2. **Check MyWeek widget** for reference dates:
   - "Dean's Speaker Series" should show **Wednesday, Nov 6**
3. **Open Calendar widget**, navigate to November
4. **Find "Dean's Speaker Series"** event:
   - Should appear on **Wednesday, Nov 6** (not Tuesday Nov 5)
5. **Check other events**:
   - "Free Flu Shot Clinic" → **Tuesday, Nov 4**
   - "Coffee Chat" → **Thursday, Nov 6**

### Console Logging:

Look for this in the console:
```
✅ Converted 5 newsletter events from 8 sections
  ✓ Event "Dean's Speaker Series" → 2025-11-06 (local noon)
  ✓ Event "Free Flu Shot Clinic" → 2025-11-04 (local noon)
```

## Technical Details

### JavaScript Date Parsing Behavior:

| Input Format | Interpretation | PST Result | Calendar Display |
|--------------|---------------|------------|------------------|
| `"2025-11-06"` (before fix) | Midnight UTC | Nov 5, 4PM | ❌ Nov 5 |
| `"2025-11-06T12:00:00"` (after fix) | Noon local | Nov 6, 12PM | ✅ Nov 6 |
| `"2025-11-06T00:00:00"` | Midnight local | Nov 6, 12AM | ✅ Nov 6 |
| `"2025-11-06T14:00:00Z"` | 2PM UTC | Nov 6, 6AM | ✅ Nov 6 |

### Why This Matters for Calendars:

The `MonthGrid` component uses `isSameDay()` from `date-fns`:
```typescript
const dayEvents = events.filter((ev) =>
  isSameDay(new Date(ev.start), day)
);
```

`isSameDay()` compares the **calendar date** in local timezone:
- `new Date("2025-11-06T00:00:00Z")` → Nov 5 in PST → matches Nov 5 grid cell ❌
- `new Date("2025-11-06T12:00:00")` → Nov 6 in PST → matches Nov 6 grid cell ✅

## Related Files

### Also Check These Files:
If other parts of the codebase parse newsletter dates, they may need the same fix:

- ✅ `app/components/CohortCalendarTabs.tsx` - **FIXED**
- ⚠️ `lib/my-week-analyzer.ts` - Check if it has similar parsing (seems OK as it works)
- ⚠️ Any other calendar event converters

### Standard Pattern for Newsletter Dates:

Going forward, always use this pattern when parsing dates from `timeSensitive.dates`:

```typescript
function parseNewsletterDate(dateStr: string): Date {
  if (dateStr.includes('T')) {
    return new Date(dateStr); // Has time, parse as-is
  }
  return new Date(dateStr + 'T12:00:00'); // Date-only, force noon local
}
```

## Benefits

1. ✅ **Calendar matches MyWeek**: Consistent dates across all widgets
2. ✅ **Calendar matches Newsletter**: Events appear on correct days
3. ✅ **No timezone confusion**: Local timezone used consistently
4. ✅ **DST-safe**: Noon avoids daylight saving ambiguity
5. ✅ **Simple fix**: Single-line change, easy to understand

## Prevention

### Best Practices:

1. **Always specify timezone** when parsing dates
2. **Use noon for all-day events** to avoid edge cases
3. **Test in different timezones** (PST, EST, UTC)
4. **Log both date string and parsed date** for debugging
5. **Use `date-fns` utilities** for consistent date operations

### Code Review Checklist:

When reviewing date parsing code:
- [ ] Does it handle date-only strings (YYYY-MM-DD)?
- [ ] Does it specify local vs UTC timezone?
- [ ] Is it tested in PST/PDT (UTC-8/7)?
- [ ] Does it match across all widgets?

