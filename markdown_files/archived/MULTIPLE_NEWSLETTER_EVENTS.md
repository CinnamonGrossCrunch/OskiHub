# Multiple Newsletter Events - Single Icon Display

**Date**: November 3, 2025  
**Feature**: Show one newsletter icon in calendar grid even when multiple newsletter events exist on same day

## The Problem

When multiple newsletter events occurred on the same day (e.g., "Free Flu Shot Clinic" and "Dean's Speaker Series" both on Nov 6):
- ❌ Only the first event was accessible
- ❌ Other events were hidden/lost
- ❌ No indication that multiple events existed

## The Solution

### Visual Changes:

1. **Single Icon**: Only one purple newsletter icon appears per day (regardless of how many events)
2. **Badge Counter**: If 2+ events exist, shows a white badge with the count
3. **Combined Modal**: Clicking opens a modal showing ALL newsletter events for that day

### Implementation:

**File Modified**: `app/components/MonthGrid.tsx`

#### 1. Added Local Type Definition:
```typescript
// Newsletter event type (extends CalendarEvent with optional htmlContent)
type NewsletterCalendarEvent = CalendarEvent & {
  htmlContent?: string;
  sourceMetadata?: {
    sectionTitle: string;
    sectionIndex: number;
    itemTitle: string;
    itemIndex: number;
  };
};
```

#### 2. Enhanced Newsletter Icon Click Handler:
```typescript
onClick={(e) => {
  e.stopPropagation();
  if (dayNewsletterEvents.length > 0) {
    // If multiple newsletter events on same day, create combined event
    if (dayNewsletterEvents.length > 1) {
      const combinedEvent = {
        ...dayNewsletterEvents[0],
        title: `${dayNewsletterEvents.length} Newsletter Events`,
        description: dayNewsletterEvents.map(ev => ev.title).join('\n• '),
        // Combine all HTML content with separators
        htmlContent: dayNewsletterEvents.map((ev, idx) => 
          `<div class="newsletter-event-${idx}">
            <h3 class="font-semibold text-lg mb-2">${ev.title}</h3>
            ${ev.htmlContent || ''}
          </div>`
        ).join('<hr class="my-4 border-slate-300" />')
      };
      onEventClick(combinedEvent);
    } else {
      // Single event, show normally
      onEventClick(dayNewsletterEvents[0]);
    }
  }
}}
```

#### 3. Added Badge Counter:
```typescript
<div className="...relative">
  <svg>...</svg>
  {dayNewsletterEvents.length > 1 && (
    <span className="absolute -top-1 -right-1 bg-white text-purple-600 text-xs font-bold rounded-full w-4 h-4 flex items-center justify-center">
      {dayNewsletterEvents.length}
    </span>
  )}
</div>
```

## User Experience

### Before:
```
Calendar Day: Wednesday, Nov 6
├─ Purple newsletter icon
└─ Click → Opens "Free Flu Shot Clinic" only
    (Dean's Speaker Series was hidden!)
```

### After:
```
Calendar Day: Wednesday, Nov 6
├─ Purple newsletter icon with "2" badge
└─ Click → Opens "2 Newsletter Events" modal
    ├─ Free Flu Shot Clinic (full content)
    │   [formatted HTML with all details]
    ├─ [separator line]
    └─ Dean's Speaker Series (full content)
        [formatted HTML with all details]
```

## Visual Design

### Newsletter Icon States:

**Single Event (no changes):**
```
┌────────┐
│   📰   │  Purple icon, no badge
└────────┘
```

**Multiple Events (NEW):**
```
┌────────┐
│   📰 ② │  Purple icon + white badge with count
└────────┘
```

### Modal Content:

**Single Event:**
- Title: Event name (e.g., "Free Flu Shot Clinic")
- Content: Original formatted HTML from newsletter

**Multiple Events:**
- Title: "2 Newsletter Events" (or 3, 4, etc.)
- Content: All events stacked with separators
  ```html
  <div>
    <h3>Free Flu Shot Clinic</h3>
    [formatted content]
  </div>
  <hr />
  <div>
    <h3>Dean's Speaker Series</h3>
    [formatted content]
  </div>
  ```

## Technical Details

### Combined Event Structure:

```typescript
{
  uid: "newsletter-0-0-20251106",  // From first event
  title: "2 Newsletter Events",     // NEW: Count indicator
  start: "2025-11-06T12:00:00",    // Shared date
  end: "2025-11-06T12:00:00",      // Shared date
  allDay: true,                     // From first event
  source: "newsletter",             // From first event
  description: "• Free Flu Shot Clinic\n• Dean's Speaker Series",
  htmlContent: "<div>...</div><hr/><div>...</div>",  // COMBINED
  sourceMetadata: {...},            // From first event
  timeSensitive: {...}             // From first event
}
```

### HTML Content Format:

Each event's content is wrapped in a div with a unique class:
```html
<div class="newsletter-event-0">
  <h3 class="font-semibold text-lg mb-2">Event Title 1</h3>
  [Original formatted content from newsletter]
</div>
<hr class="my-4 border-slate-300" />
<div class="newsletter-event-1">
  <h3 class="font-semibold text-lg mb-2">Event Title 2</h3>
  [Original formatted content from newsletter]
</div>
```

## Benefits

1. ✅ **Cleaner Calendar Grid**: No duplicate icons cluttering the view
2. ✅ **All Events Accessible**: No newsletter events are hidden/lost
3. ✅ **Visual Indicator**: Badge shows at a glance how many events exist
4. ✅ **Comprehensive Modal**: Users see all events in one view
5. ✅ **Maintains Formatting**: Original newsletter HTML preserved for each event
6. ✅ **Better UX**: Similar to how email apps group messages by thread

## Testing Checklist

- [ ] Single newsletter event on a day → one icon, no badge
- [ ] Two newsletter events on same day → one icon with "2" badge
- [ ] Click single-event icon → modal shows that one event
- [ ] Click multi-event icon → modal shows "2 Newsletter Events" title
- [ ] Multi-event modal → shows all events with separators
- [ ] Multi-event modal → each event has its full formatted content
- [ ] Multi-event modal → "View in Newsletter" button works for combined events
- [ ] Badge counter updates correctly (3, 4, 5+ events)
- [ ] Icon tooltip shows all event titles (comma-separated)

## Edge Cases Handled

### 3+ Events on Same Day:
```
Badge shows: "3"
Modal title: "3 Newsletter Events"
Content: Event 1 <hr/> Event 2 <hr/> Event 3
```

### Events with No HTML Content:
```typescript
htmlContent: ev.htmlContent || '' // Falls back to empty string
```

### Mixed Event Types on Same Day:
- Cohort events (classes): Listed in main calendar grid
- Newsletter events: Grouped under single purple icon
- Cal Bears events: Separate bear icon
- Each event type has its own icon/display

## Future Enhancements

1. **Collapsible Sections**: Add expand/collapse for each event in combined modal
2. **Event Navigation**: Add prev/next arrows within combined modal to jump between events
3. **Calendar List View**: Apply same grouping logic to list view
4. **Color Coding**: Different badge colors for different priorities (high/medium/low)
5. **Summary View**: Show bullet list of event names before full content

