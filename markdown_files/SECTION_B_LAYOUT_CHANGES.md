# Section B Layout Changes - Dynamic Widget Expansion

## Overview
Section B was refactored to create a dynamic 6-column grid layout where MyWeekWidget and HaasJourneyWidget (Resources) mutually toggle expansion states. Only one widget can be expanded at a time, and at least one must always be expanded.

## Files Modified
1. `app/components/ClientDashboard.tsx`
2. `app/components/MyWeekWidget.tsx`
3. `app/components/HaasJourneyWidget.tsx`

---

## Step-by-Step Changes

### Step 1: Add Controlled State to ClientDashboard

In `ClientDashboard.tsx`, add state variables and handlers:

```tsx
// Track widget expanded states - exactly one must be expanded at all times
const [isMyWeekExpanded, setIsMyWeekExpanded] = useState(false);
const [isResourcesExpanded, setIsResourcesExpanded] = useState(true); // Resources default expanded

// Handlers that ensure exactly one is always expanded
const handleMyWeekExpandChange = (expanded: boolean) => {
  if (expanded) {
    // Expanding MyWeek -> collapse Resources
    setIsMyWeekExpanded(true);
    setIsResourcesExpanded(false);
  } else {
    // Collapsing MyWeek -> expand Resources
    setIsMyWeekExpanded(false);
    setIsResourcesExpanded(true);
  }
};

const handleResourcesExpandChange = (expanded: boolean) => {
  if (expanded) {
    // Expanding Resources -> collapse MyWeek
    setIsResourcesExpanded(true);
    setIsMyWeekExpanded(false);
  } else {
    // Collapsing Resources -> expand MyWeek
    setIsResourcesExpanded(false);
    setIsMyWeekExpanded(true);
  }
};
```

### Step 2: Update Section B Grid Layout

Change Section B to use a 6-column grid with dynamic column spans:

```tsx
{/* Section B: My Week Widget, Resources, and Weather Widget - 6 column grid */}
<div className="grid grid-cols-1 lg:grid-cols-6 mt-2 lg:py-2 mb-0 gap-2 items-start -mx-3 sm:mx-0 lg:mx-0 transition-all duration-500 ease-in-out">
  {/* My Week Widget - Column 1 when collapsed, Columns 1-4 when expanded */}
  <div className={`transition-all duration-500 ease-in-out px-3 sm:px-0 ${
    isMyWeekExpanded ? 'lg:col-span-4' : 'lg:col-span-1'
  }`}>
    <MyWeekWidget 
      data={dashboardData.myWeekData}
      selectedCohort={selectedCohort}
      isExpanded={isMyWeekExpanded}
      onExpandChange={handleMyWeekExpandChange}
    />
  </div>
  
  {/* Haas Journey Resources - Columns 2-5 when expanded, Column 5 when collapsed */}
  <div className={`transition-all duration-500 ease-in-out px-3 sm:px-0 ${
    isResourcesExpanded ? 'lg:col-span-4' : 'lg:col-span-1'
  }`}>
    <HaasJourneyWidget 
      isExpanded={isResourcesExpanded} 
      onExpandChange={handleResourcesExpandChange}
    />
  </div>
  
  {/* Weather/Travel Widget - Always Column 6 */}
  <div className="lg:col-span-1 flex items-start justify-end px-3 sm:px-0 transition-all duration-500 ease-in-out">
    <div className="w-full flex flex-row lg:flex-col gap-0 min-w-0 justify-end">
      <WeatherWidget />
      <TravelTimeWidget />
    </div>
  </div>
</div>
```

### Step 3: Make MyWeekWidget Controlled

Update `MyWeekWidget.tsx` to accept `isExpanded` prop from parent:

**Interface changes:**
```tsx
interface MyWeekWidgetProps {
  data?: MyWeekData;
  selectedCohort?: CohortType;
  isExpanded?: boolean;  // ADD THIS
  onExpandChange?: (isExpanded: boolean) => void;
}
```

**Function signature:**
```tsx
export default function MyWeekWidget({ data, selectedCohort = 'blue', isExpanded = false, onExpandChange }: MyWeekWidgetProps) {
  const [weekData, setWeekData] = useState<MyWeekData | null>(data || null);
  const [loading, setLoading] = useState(!data);

  // Use controlled state from parent
  const setIsExpanded = (value: boolean) => {
    onExpandChange?.(value);
  };
  
  // REMOVE the useState for isExpanded
  // REMOVE the useEffect that notifies parent
```

### Step 4: Make HaasJourneyWidget Controlled

Update `HaasJourneyWidget.tsx` interface and remove internal state:

**Interface changes:**
```tsx
interface HaasJourneyWidgetProps {
  className?: string;
  isExpanded?: boolean;  // Changed from isCompact
  onExpandChange?: (expanded: boolean) => void;  // ADD THIS
}
```

**Function signature:**
```tsx
export default function HaasJourneyWidget({ className = "", isExpanded = true, onExpandChange }: HaasJourneyWidgetProps) {
  // Use controlled state from parent
  const isOpen = isExpanded;
  const setIsOpen = (value: boolean) => {
    onExpandChange?.(value);
  };
  
  // REMOVE: const [isOpen, setIsOpen] = useState(true);
```

**Remove unused import:**
```tsx
// REMOVE: import { useState } from 'react';
```

---

## Additional UI Enhancements Made

### HaasJourneyWidget Styling Updates

1. **Increased icon sizes:**
   - Container: `w-6 h-6` → `w-8 h-8`
   - Icon font: `!text-[18px]` → `!text-[24px]`

2. **Added circular borders to icons:**
   ```tsx
   iconContainer: "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 border border-white/20"
   ```

3. **Reduced vertical padding:**
   ```tsx
   gridExpanded: "grid grid-cols-3 gap-x-6 gap-y-0 w-full"  // Changed from gap-y-1
   ```

4. **Changed toggle button to match MyWeekWidget:**
   - Uses same animated border: `animate-[rotating-violet-glow_1.5s_ease-in-out_infinite]`
   - Same SVG plus icon with rotation animation

5. **Converted tooltips to subtitles:**
   - Removed floating tooltip
   - Added subtitle below CTA text showing resource title

---

## How to Reverse Changes

### To restore independent widget states:

1. In `ClientDashboard.tsx`:
   - Remove `isResourcesExpanded` state
   - Simplify handlers to not enforce mutual exclusivity
   - Remove `isExpanded` prop from MyWeekWidget
   - Remove `isExpanded` and `onExpandChange` from HaasJourneyWidget

2. In `MyWeekWidget.tsx`:
   - Restore internal `useState` for `isExpanded`
   - Restore `useEffect` to notify parent

3. In `HaasJourneyWidget.tsx`:
   - Restore `import { useState } from 'react'`
   - Restore internal `useState` for `isOpen`
   - Change props back to `isCompact` if needed

### To restore original grid layout:

Change Section B back to simpler layout without dynamic column spans.

---

## Behavior Summary

| State | MyWeek Columns | Resources Columns | Weather |
|-------|----------------|-------------------|---------|
| Resources Expanded (default) | 1 | 4 | 1 |
| MyWeek Expanded | 4 | 1 | 1 |

- Clicking to expand one widget automatically collapses the other
- Clicking to collapse one widget automatically expands the other
- One widget is always expanded (never both collapsed)
