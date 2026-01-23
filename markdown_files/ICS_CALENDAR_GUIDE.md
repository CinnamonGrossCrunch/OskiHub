# ICS Calendar Integration Guide

> Complete workflow for adding course calendars to OSKI Hub

## Quick Reference: Chat → Working ICS File

**Process:** User provides ICS content → Create/update `.ics` file → Register in config → Add UI color → Commit → Deploy

---

## Step 1: Create ICS File

**Location:** `public/[course]_[cohort]_[term].ics`

**Example:** `public/ewmba202_accounting_blue_spring2026.ics`

### ICS Template

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

### Required Fields

- `UID`: Unique ID (format: `ewmba[course]-sp26-[cohort]-[identifier]`)
- `DTSTART`/`DTEND`: Format `YYYYMMDDTHHmmss` (UTC, will convert to PST)
- `SUMMARY`: Event title (keep concise)
- `DESCRIPTION`: Use `\n` for newlines, escape special chars
- `URL;VALUE=URI`: Direct link (use course home or assignments page, NOT week pages)

### Common ICS File Issues

| ❌ Problem | ✅ Solution |
|-----------|-----------|
| Week-specific URLs | Use `https://bcourses.berkeley.edu/courses/[ID]` not `/pages/week-X` |
| Wrong course IDs | Verify course ID matches (e.g., 1549713 for accounting, 1549648 for macro) |
| Misplaced events | Check event belongs to correct course (macro events in macro files only) |
| Missing URLs | All events should have a URL field pointing to relevant page |

---

## Step 2: Register in `lib/icsUtils.ts`

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

---

## Step 3: Add Course Color in `app/components/MonthGrid.tsx`

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

### Course Color Palette

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

---

## Step 4: Commit & Deploy

```bash
git add public/[filename].ics lib/icsUtils.ts app/components/MonthGrid.tsx
git commit -m "Add [Course] [Term] calendars (Blue & Gold)"
git push origin main
```

---

## Step 5: Verify Production

```bash
# Wait 90 seconds for Vercel deploy
# Force cache refresh
curl "https://www.oski.app/api/unified-dashboard?refresh=true"
```

---

## Troubleshooting

### Events Not Appearing

1. Check file is in `public/` directory
2. Verify filename in `COHORT_FILES` array matches exactly
3. Confirm `.ics` extension is present
4. Force cache refresh: `?refresh=true`

### Wrong Links Showing

- Search all ICS files for old course IDs: `grep -r "1544880" public/*.ics`
- Replace with correct course ID
- Common mistake: copying from old semester files with outdated URLs

### Events on Wrong Cohort

- Verify event is in correct ICS file (blue vs gold)
- Check `COHORT_FILES` mapping is correct
- Remove duplicate events from wrong files

### Dev Mode Not Updating

- Cache bypass only works for `COHORT_EVENTS` and `DASHBOARD_DATA` keys
- Restart dev server: `npm run dev`
- Check `lib/cache.ts` dev mode skip logic

---

## Advanced Patterns

### Batch Event Creation

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

### Adding Pre-Class Materials

```
DESCRIPTION:Topic: [Name]\n\nObjectives:\n• [Point 1]\n• [Point 2]\n\nPre-Class Materials (Required):\n• [Title]: [URL]\n• [Title]: [URL]\n\nOptional Readings:\n• [Title]: [URL]\n\nCourse Page: [URL]
```

---

## Validation Checklist

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
