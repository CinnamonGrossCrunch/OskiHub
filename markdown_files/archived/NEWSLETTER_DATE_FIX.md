# Newsletter Date Extraction Fixes

**Date**: November 3, 2025  
**Issue**: AI extracting incorrect dates from newsletter, causing calendar events to show wrong days

## Problems Identified

### 1. Off-by-One Day Errors
- "Free Flu Shot Clinic" showing as **Monday Nov 3** (should be **Tuesday Nov 4**)
- "Dean's Speaker Series" showing as **Tuesday Nov 4** (should be **Wednesday Nov 6**)
- "Underhill Lot Advisory" showing as **Sunday Nov 2** (should be **Monday**)
- "Biz Comm Action Items" showing as **Saturday Nov 15** (should be **Sunday Nov 16**)

### 2. Missing Events
- "Coffee Chat with Mette Lykke" on **Thursday Nov 6, 9-10 AM** not extracted

### 3. Duplicate Events
- "Parking & Transportation Advisory" appearing twice (Nov 6 and Nov 7) when it's actually about **Saturday** games

### 4. Hallucinated Dates
- "FTMBA Electives for Spring 2026" showing **Tuesday Nov 11** when **no date is mentioned** in newsletter

## Root Causes

1. **Insufficient Context**: AI only saw first 300 chars of each item → missed important date details
2. **Vague Prompt**: Didn't specify current day (Sunday Nov 3) and day-of-week mapping
3. **No Validation**: No check for day name mismatches (text says "Tuesday" but extracted date is Monday)
4. **Weak Filtering**: Allowing advisory/digest items with vague date references

## Solutions Implemented

### 1. Improved AI Prompt (`lib/openai-organizer-fixed.ts`)

**Increased Context:**
```typescript
// BEFORE:
.substring(0, 300) // First 300 chars only

// AFTER:
.substring(0, 500) // Increased to 500 chars for better context
```

**Added Calendar Context:**
```typescript
CURRENT CONTEXT:
- Today is Sunday, November 3, 2025
- Reference dates: Mon Nov 4, Tue Nov 5, Wed Nov 6, Thu Nov 7, Fri Nov 8, Sat Nov 9, Sun Nov 10
```

**Stricter Rules:**
```
CRITICAL RULES:
1. ONLY include items with EXPLICIT dates mentioned in the text
2. DO NOT infer or guess dates - if no date is mentioned, skip it
3. Match day names carefully (e.g., "Monday, Nov 4" = 2025-11-04)
4. For "Saturday Scoop" or weekly digests with no specific date, skip them
5. For advisory items about multiple future dates, skip them
6. If day name doesn't match calendar, use the day name from text
```

**Examples Added:**
```
EXAMPLES:
✓ "Coffee Chat Thursday, Nov 6, 9-10 AM" → {"dates": ["2025-11-06"]}
✓ "Flu Shot Clinic Tuesday, Nov 4, 12-4PM" → {"dates": ["2025-11-04"]}
✗ "FTMBA Electives for Spring 2026" (no date) → skip
✗ "Saturday Scoop" (newsletter name) → skip
✗ "Parking Advisory for all games" (vague) → skip
```

### 2. Added Date Validation (`lib/openai-organizer-fixed.ts`)

**Day-of-Week Validation:**
```typescript
const getDayName = (dateStr: string): string => {
  const date = new Date(dateStr + 'T12:00:00'); // Noon to avoid timezone
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return days[date.getDay()];
};

// Check if text mentions a day name that doesn't match extracted date
const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const mentionedDay = dayNames.find(day => itemText.includes(day));

if (mentionedDay && mentionedDay !== dayName.toLowerCase()) {
  console.warn(`⚠️ Day mismatch for "${item.title}": text mentions "${mentionedDay}" but date ${dateStr} is ${dayName}`);
}
```

**Enhanced Logging:**
```typescript
console.log(`✓ Added timeSensitive to "${item.title}": ${dates.join(', ')} [${dates.map(getDayName).join(', ')}]`);
// Example output: "✓ Added timeSensitive to "Flu Shot Clinic": 2025-11-04 [Tuesday]"
```

### 3. Improved Conservative Filtering (`app/components/CohortCalendarTabs.tsx`)

**Pattern-Based Filtering:**
```typescript
// Skip items with titles that indicate digest/advisory content
const skipPatterns = [
  /saturday scoop/i,
  /sunday scoop/i,
  /weekly digest/i,
  /parking.*advisory/i,
  /underhill.*advisory/i,
  /transportation.*advisory/i
];

if (skipPatterns.some(pattern => pattern.test(item.title))) {
  console.log(`⏭️ Skipping "${item.title}" - matches advisory/digest pattern`);
  return;
}
```

## Expected Results After Fix

### Events That Should NOW Appear Correctly:
✅ **Free Flu Shot Clinic**: Tuesday, Nov 4 (not Monday Nov 3)  
✅ **Dean's Speaker Series**: Wednesday, Nov 6 (not Tuesday Nov 4)  
✅ **Coffee Chat with Mette Lykke**: Thursday, Nov 6, 9-10 AM ✨ (NEW - was missing)

### Events That Should BE REMOVED:
❌ **Underhill Lot Advisory**: Removed (advisory with multiple vague dates)  
❌ **Parking Advisory (Nov 6)**: Removed (duplicate advisory)  
❌ **Parking Advisory (Nov 7)**: Removed (duplicate advisory)  
❌ **FTMBA Electives (Nov 11)**: Removed (no actual date in newsletter)  
❌ **Saturday Scoop**: Removed (weekly digest, not specific event)

### Events That Should Appear on Correct Day:
✅ **Biz Comm Action Items**: Sunday, Nov 16 (not Saturday Nov 15)

## Testing Process

1. **Clear Cache**: Delete any cached newsletter data
2. **Reload Dashboard**: Force fresh API call to `/api/unified-dashboard`
3. **Check Console Logs**: Look for:
   - `⚠️ Day mismatch` warnings (should see fixes)
   - `⏭️ Skipping` messages for advisory items
   - `✓ Added timeSensitive` with correct day names
4. **Verify Calendar**:
   - Navigate to November 2025
   - Check each event date matches day-of-week
   - Verify advisory items don't appear
   - Confirm Coffee Chat appears on Thursday Nov 6

## Console Logging

### What to Look For:

**Good Output:**
```
✅ Converted 5 newsletter events from 8 sections
✓ Added timeSensitive to "Free Flu Shot Clinic": 2025-11-04 [Tuesday]
✓ Added timeSensitive to "Dean's Speaker Series": 2025-11-06 [Wednesday]
✓ Added timeSensitive to "Coffee Chat": 2025-11-06 [Thursday]
⏭️ Skipping "Underhill Lot Advisory" - has 10 dates (likely advisory content)
⏭️ Skipping "Parking Advisory" - matches advisory/digest pattern
⏭️ Skipping "Saturday Scoop" - matches advisory/digest pattern
```

**Bad Output (Indicates Issues):**
```
⚠️ Day mismatch for "Flu Shot Clinic": text mentions "tuesday" but date 2025-11-03 is Monday
⚠️ Day mismatch for "Dean's Speaker": text mentions "wednesday" but date 2025-11-04 is Tuesday
```

## Benefits

1. **Accurate Dates**: Events appear on correct calendar days matching newsletter text
2. **No Hallucinations**: Items without dates aren't given fake dates
3. **Clean Calendar**: Advisory/digest items filtered out automatically
4. **Better Detection**: Coffee Chat and other events with dates in body text now extracted
5. **Validation**: Day-of-week mismatches logged for debugging

## Future Improvements

1. **Regex Date Extraction**: Supplement AI with regex patterns for common formats
2. **Timezone Handling**: Ensure PST/PDT conversion for exact times
3. **Multi-day Events**: Better handling of events spanning multiple days
4. **Recurring Events**: Detect and handle "Every Thursday" type patterns

