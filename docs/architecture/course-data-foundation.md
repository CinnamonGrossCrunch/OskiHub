# Course Data Foundation — Architecture

**Branch:** `rebuild/course-data-foundation` (forked off main; main keeps serving)
**Status:** vertical slice implemented for EW204; migration plan below
**Date:** 2026-09-23

## Why

OskiHub grew from a newsletter UI improver into a multi-facet dashboard by
cobbling together Haas's myriad info pipelines: bCourses/Canvas (walled,
shitty UI, no auth persistence), .edu pages, hand-built ICS files, Gmail,
Slack, generated parking feeds. Clever workarounds, real novel synthesis —
and real technical debt.

The sharpest edge: the **course ICS pipeline was duct tape requiring
per-course intervention**. Hand-built ICS files were simultaneously the
narrative scaffolding (session topics, readings, descriptions) *and* the
claimed source of truth (due dates, points). Nothing recorded which parts
were which — so a "Read Uber" reading became a 5-point "Prepare Uber" due
event, reflection dates drifted from stale Fall-2024 Saturdays, and EW200C's
calendar silently omitted 18 of 48 grade points. The old audit only checked
events that already had Canvas URLs, so ghosts without URLs survived every
build.

Conceptual model going forward: **syllabi/scaffolding are the narrative;
Canvas is the up-to-date source of truth.** The backend must represent that
distinction instead of collapsing it into one flat ICS.

## Current state (what we're replacing)

- `public/course_ICS_files/*.ics` — ~18 hand-built files, per course × cohort.
  Parsed at request time by `lib/icsUtils.ts` into flat `CalendarEvent`
  (title/start/end/location/url/description/source). No assignment concept;
  "due" isn't even a backend notion (UI sniffs titles).
- `lib/calendar.ts` — history cutoff (already removed), upcoming slice.
- `scripts/audit-course-ics.py` — external reconciler (new, works, but
  outside the app: it reports drift, doesn't prevent it).
- The one healthy pattern: **parking pipeline** — `scripts/event-parking/`
  generates `public/parking-events/` + `lib/generated/`, weekly cron,
  data-only pushes via `push_via_api.py`. The rebuild copies this pattern.

## Target architecture

```
┌─────────────┐     ┌──────────────┐     ┌───────────────┐     ┌──────────┐
│   SOURCES   │     │  INGESTION   │     │     MERGE     │     │   APP    │
│ (truth +    │────▶│  (adapters,  │────▶│ (typed, rule- │────▶│ (reads   │
│  scaffolding│     │  per source, │     │  based, audited│     │ generated│
│  , not per  │     │  not per     │     │  )            │     │ JSON)    │
│  course)    │     │  course)     │     │               │     │          │
└─────────────┘     └──────────────┘     └───────────────┘     └──────────┘
```

### Layer 0 — Typed domain model (`lib/course-data/types.ts`)

```ts
type Provenance = 'canvas' | 'scaffold' | 'merged';
interface CourseAssignment {
  id: string;            // 'canvas:9093750' — stable identity
  courseId: string;      // 'ew204'
  title: string;         // display title
  dueAt: string | null;  // ISO, Canvas is authoritative
  pointsPossible: number | null;
  url: string;           // Canvas assignment URL
  provenance: Provenance;
  unverified?: boolean;  // scaffold-only, no Canvas backing
  scaffoldNote?: string; // narrative carried over from ICS
}
interface CourseSession {
  id: string; courseId: string;
  title: string; start: string; end: string;
  location?: string; topic?: string;
  readings?: string[]; description?: string;
  provenance: 'scaffold';
}
interface CourseData {
  courseId: string; canvasCourseId: number | null;
  title: string; term: string;
  assignments: CourseAssignment[]; sessions: CourseSession[];
  generatedAt: string; canvasSyncedAt: string | null;
}
```

`CalendarEvent` (the UI contract) is **extended, not replaced**: `+ provenance?`,
`+ assignmentId?`. Every existing widget keeps working.

### Layer 1 — Ingestion adapters (`scripts/course-data/`)

One adapter **per source**, never per course:

- `canvas-ingest.py` — Canvas API → `lib/generated/courses/<id>.canvas.json`
  (assignments, modules, pages). Paginates, handles unpublished courses
  (writes `{"unpublished": true}` instead of failing).
- `scaffold-ingest.py` — hand-built ICS → sessions + narrative fragments
  (the storytelling layer: topics, readings, descriptions). This is where
  human curation lives from now on — *descriptions and topics only*,
  never dates/points.
- (later) `syllabus-ingest.py`, `edu-ingest.py` — same interface.

Config: `scripts/course-data/courses.json`
(`courseId → { ics, canvasId, title, term }`). Adding a course = one JSON
entry, zero new code. This is the anti-duct-tape rule.

### Layer 2 — Merge (`scripts/course-data/merge.py`)

Rule-based, deterministic, audited:

1. Every Canvas assignment → `CourseAssignment`, provenance `canvas`.
   Canvas wins on **title, due date, points, URL**. Always.
2. ICS due-events matching a Canvas assignment (fuzzy, number-aware) →
   their narrative embellishments attach as `scaffoldNote`; identity
   (UID) preserved so UI facets (rings, modals, export) don't shift.
3. ICS due-events with no Canvas match but a course-page requirement →
   `provenance: 'scaffold'`, `unverified: true` (kept, visibly marked).
4. ICS due-events with no evidence → **dropped at generation time**,
   listed in the merge report (ghosts never reach the app).
5. ICS sessions → `CourseSession[]` verbatim (narrative layer untouched).
6. Description-embedded `Due:`/`Reflection:` claims re-verified; stale
   dates corrected to Canvas, fabrications removed.

Output: `lib/generated/courses/<id>.json` + `merge-report.json`.
Deterministic: same inputs → byte-identical outputs (diffable in git).

### Layer 3 — App reads generated data (`lib/course-data/reader.ts`)

`reader.ts` loads `lib/generated/courses/*.json` → `CalendarEvent[]`
(same shape the UI already consumes, plus provenance). `icsUtils.ts`
`COHORT_FILES` entries for migrated courses are replaced by reader calls.
Unmigrated courses keep the old path — migration is per-course, zero
flag-days.

### Layer 4 — Automation (copies the parking pattern)

- Cron (weekly, same infra as `event-parking-refresh-inseason`):
  ingest → merge → audit → commit **generated JSON only** → push via
  `push_via_api.py --only lib/generated/`. Never touches code or scaffolding.
- `audit-course-ics.py --all` becomes the pre-merge gate: merge aborts on
  new GHOST/MISMATCH instead of shipping it.

## Facet inventory (must not lose — parity checklist)

- [ ] MonthGrid: course colors, due-date rings/bars, parking badges, overflow
- [ ] CohortCalendarTabs: all feeds default-on, parking banner decoupled
- [ ] EventDetailModal contents per event
- [ ] CalendarListView
- [ ] IcsExportModal + `/api/calendar/export.ics`
- [ ] My Week analyzer + widget
- [ ] Parking: badges, banner, popover, legend (generated feeds untouched)
- [ ] Newsletters, announcements, official links, resources, Slack, weather,
      travel-time widgets (out of scope, must keep working)
- [ ] Blue/gold cohort file mapping (shared Fall 2026 files)
- [ ] Archive terms (Spring 2026, Fall 2025) keep rendering

## Migration plan (phases)

1. **Foundation** (this branch, now): types, Canvas ingest, merge, generated
   JSON for Fall 2026 courses, reader. ✅ vertical slice: EW204
2. **Per-course migration**: EW200C (add missing assignments as
   `provenance: canvas` events), EW209 (when published), then archive terms
   as scaffold-only.
3. **Cutover**: icsUtils reads generated for migrated courses; ICS files
   become scaffold input only (descriptions/topics), never dates.
4. **Automation**: weekly cron + audit gate + data-only pushes.
5. **Decommission**: hand-edited due dates removed from scaffolding ICS;
   `audit-course-ics.py` retires into the merge gate.

## Open questions

- EW200C: add the 12 missing Canvas assignments as calendar events? (Awaiting Matt.)
- Week 7 Reflection (EW204) has no Canvas due date — keep scaffold date?
- Should `unverified` scaffold events render differently in the UI (e.g.
  subtle marker), or just exist?
- Archive terms: scaffold-only forever, or leave on the legacy path?
