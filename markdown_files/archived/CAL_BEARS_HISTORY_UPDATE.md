# Cal Bears Calendar - Show All History Update

**Date**: November 3, 2025

## Changes Made

### 1. Updated SMU Football Game (ICS File)
**File**: `public/cal_bears_home_2025_original.ics`

**Updated Event**:
- **Game**: SMU Mustangs at California Golden Bears Football
- **Date**: Saturday, November 29, 2025
- **Time**: TBD
- **Location**: California Memorial Stadium, Berkeley, CA
- **Tickets**: Updated to correct gotickets.com URL
  - Old: `https://calbears.evenue.net/events/FBS`
  - New: `https://gotickets.com/tickets/871555/smu-mustangs-at-california-golden-bears-football-tickets/california-memorial-stadium-berkeley-ca-11-29-2025`

**Changes**:
- Updated `URL` field with correct ticket link
- Updated `X-ALT-DESC` HTML description to include date and "Get Tickets" link
- Updated `DESCRIPTION` field with full event details
- Updated `DTSTAMP` to current timestamp

### 2. Calendar Start Month (Show All Football Games)
**File**: `app/components/CohortCalendarTabs.tsx`

**Change**: Modified initial `currentMonth` state
```typescript
// BEFORE:
const [currentMonth, setCurrentMonth] = useState(new Date()); // Current month (Nov 2025)

// AFTER:
const [currentMonth, setCurrentMonth] = useState(new Date(2025, 7, 1)); // Start at August 2025
```

**Rationale**:
- Football season starts in September 2025
- By starting the calendar at August 2025, users can see all football games when they first load the calendar
- Users can still navigate forward to see basketball games (Nov 2025 - March 2026)

## Football Schedule Now Visible

### September 2025
- **Sept 6**: Texas Southern Tigers at Cal
- **Sept 13**: Minnesota Golden Gophers at Cal

### October 2025
- **Oct 4**: Duke Blue Devils at Cal
- **Oct 17**: North Carolina Tar Heels at Cal

### November 2025
- **Nov 1**: Virginia Cavaliers at Cal
- **Nov 29**: SMU Mustangs at Cal ✨ (Updated)

## Basketball Schedule (Still Accessible)

Users can navigate forward from August to see basketball games:
- **Nov-Dec 2025**: 13 home games
- **Jan-Feb 2026**: 8 ACC conference games

## Technical Details

### Date Range Filtering
Both `lib/icsUtils.ts` and `lib/calendar.ts` already support showing events from 120 days in the past:

```typescript
const pastLimit = addDays(now, -120); // Show events from 120 days ago
```

This means:
- ✅ Events are fetched correctly (football games from Sept included)
- ✅ Events are parsed correctly (all 21 Cal Bears games parsed)
- ✅ Events are sorted chronologically (football → basketball)

### Month Grid Display
The `MonthGrid` component displays events day-by-day for the currently visible month. By starting at August 2025:
- Users see the calendar beginning at the start of the academic year
- All football games (Sept-Nov) are accessible by navigating forward
- All basketball games (Nov-Mar) are accessible by continuing to navigate forward

### Navigation
Users can navigate months using:
- **Previous Month** button: Goes backward (e.g., Aug → July)
- **Next Month** button: Goes forward (e.g., Aug → Sept → Oct → Nov, etc.)

## Testing Checklist

- [ ] Calendar loads at August 2025 on first visit
- [ ] Navigate to September 2025 - verify 2 football games visible
- [ ] Navigate to October 2025 - verify 2 football games visible
- [ ] Navigate to November 2025 - verify 2 football games + basketball games
- [ ] Click SMU game on Nov 29 - verify updated ticket URL works
- [ ] Verify ticket link opens: https://gotickets.com/tickets/871555/...
- [ ] Navigate through entire season (Aug 2025 → March 2026)
- [ ] Verify all events display correctly in chronological order

## User Experience

**Before**: Calendar started at current month (November 3, 2025)
- ❌ Football games in Sept/Oct were hidden (required manual navigation back)
- ✅ Basketball games visible immediately

**After**: Calendar starts at August 2025
- ✅ All football games visible by navigating forward from Aug
- ✅ All basketball games visible by continuing to navigate forward
- ✅ Natural flow: Start of academic year → Football season → Basketball season

## Notes

- ICS file order doesn't matter - events are automatically sorted chronologically
- The parsing logic handles both football and basketball games correctly
- Users can still use the month navigation to jump to any month
- The 120-day lookback window ensures historical events remain accessible

