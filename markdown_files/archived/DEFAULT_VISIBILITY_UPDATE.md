# Default Visibility Update - Newsletter & Cal Bears Events

**Date**: November 3, 2025  
**File Modified**: `app/components/CohortCalendarTabs.tsx`

## Changes Made

### 1. Updated Default Visibility States

**Changed from OFF to ON by default:**

```typescript
// BEFORE:
const [showCalBears, setShowCalBears] = useState(false);
const [showNewsletter, setShowNewsletter] = useState(false);

// AFTER:
const [showCalBears, setShowCalBears] = useState(true); // Default ON
const [showNewsletter, setShowNewsletter] = useState(true); // Default ON
```

### 2. Added localStorage Support for Cal Bears

Previously, only Newsletter had localStorage persistence. Now Cal Bears toggle state is also saved and restored.

**Load from localStorage (on mount):**
```typescript
// Load Cal Bears preference
const savedShowCalBears = localStorage.getItem('calendar-show-calbears');
if (savedShowCalBears !== null) {
  setShowCalBears(savedShowCalBears === 'true');
}

// Load Newsletter preference (already existed)
const savedShowNewsletter = localStorage.getItem('calendar-show-newsletter');
if (savedShowNewsletter !== null) {
  setShowNewsletter(savedShowNewsletter === 'true');
}
```

**Save to localStorage (on change):**
```typescript
// Save Cal Bears preference
useEffect(() => {
  localStorage.setItem('calendar-show-calbears', String(showCalBears));
}, [showCalBears]);

// Save Newsletter preference (already existed)
useEffect(() => {
  localStorage.setItem('calendar-show-newsletter', String(showNewsletter));
}, [showNewsletter]);
```

## Behavior

### First-Time Users (No localStorage)
- ✅ **Cal Bears events**: Visible by default
- ✅ **Newsletter events**: Visible by default
- Both toggles will appear as ON (blue/purple)

### Returning Users (Has localStorage)
- Restores user's last preference
- If user toggled OFF before, will remain OFF
- If user toggled ON before, will remain ON

### User Actions
- **Toggle OFF**: Events hide + preference saved to localStorage
- **Toggle ON**: Events show + preference saved to localStorage
- Preferences persist across page reloads and browser sessions

## UI Changes

### Event Type Toggles Dropdown

**Cal Bears Toggle:**
- Default state: ✅ ON (blue toggle)
- Shows Cal Bears home games (Football & Basketball)
- State persists in localStorage

**Newsletter Toggle:**
- Default state: ✅ ON (purple toggle)
- Shows time-sensitive newsletter events
- State persists in localStorage

**Other Toggles (unchanged):**
- Greek Theater: OFF by default
- UC Launch: OFF by default
- Campus Groups: OFF by default

## Benefits

1. **Better User Experience**: Important events (Cal Bears, Newsletter) visible immediately
2. **User Control**: Can toggle off if not interested
3. **Persistence**: User preferences saved and restored
4. **Consistency**: Same localStorage pattern for both event types

## Testing Checklist

- [ ] Load page for first time → Cal Bears & Newsletter events visible
- [ ] Toggle Cal Bears OFF → events disappear
- [ ] Reload page → Cal Bears remains OFF (localStorage works)
- [ ] Toggle Cal Bears ON → events reappear
- [ ] Toggle Newsletter OFF → events disappear
- [ ] Reload page → Newsletter remains OFF (localStorage works)
- [ ] Toggle Newsletter ON → events reappear
- [ ] Clear localStorage → both default to ON again
- [ ] Verify toggles show correct state (blue/purple when ON, gray when OFF)

## localStorage Keys

```
calendar-show-calbears: 'true' | 'false'
calendar-show-newsletter: 'true' | 'false'
calendar-cohort: 'blue' | 'gold'
```

## Impact on Calendar

### November 2025 (Current Month)
**With defaults ON:**
- Shows cohort events (classes, assignments)
- Shows Cal Bears basketball games (Nov 3, 6, 10, 18, 21)
- Shows SMU football game (Nov 29)
- Shows newsletter time-sensitive events (if any for November)

**User can toggle off** either event type if calendar feels cluttered.

## Notes

- Other event types (Greek Theater, UC Launch, Campus Groups) remain OFF by default
- Users who previously set preferences will not be affected (localStorage takes precedence)
- Clean localStorage will reset all toggles to new defaults (Cal Bears & Newsletter ON)

