/**
 * courseLinks.ts — single source of truth for course -> bCourses links.
 *
 * Every calendar event's "Open Class Page" destination resolves through this
 * registry. Rules:
 *
 * 1. Current-term courses get their REAL Canvas course home page. We never
 *    fabricate a week-N page URL for them.
 * 2. Archive (past-term) courses keep their legacy generated week-N links —
 *    that behavior predates this registry and is preserved as-is.
 * 3. A source file that matches no entry gets NO link (null) — never another
 *    course's link. (A previous substring classifier once branded every Fall
 *    2026 session as "Data & Decisions" because "fall2026" contains "202".)
 *
 * To add a course: append an entry with the Canvas course ID and the source
 * filename patterns. No other code changes needed.
 */

export interface CourseLinkEntry {
  /** Stable key, e.g. 'ew209'. */
  key: string;
  /** Human label used in generated descriptions. */
  label: string;
  /** bCourses Canvas course ID. null = unpublished/unknown -> no link. */
  canvasId: string | null;
  /** Explicit source-filename matchers (lowercased substring match). */
  filenamePatterns: string[];
  /**
   * Archive-only: legacy generated week-page pattern, e.g. 'pages/week-'.
   * Entries WITHOUT this pattern are current-term courses: their events link
   * to the course home page, never a fabricated week page.
   */
  weekPagePattern?: string;
  /** Archive-only: per-cohort term start dates for legacy week math. */
  startDates?: { blue: string; gold: string };
}

export const COURSE_LINKS: CourseLinkEntry[] = [
  // ---------------- Current term: Fall 2026 ----------------
  // Course home page is the destination. Verified against Canvas 2026-10-14.
  {
    key: 'ew200c',
    label: 'Leadership Communication',
    canvasId: '1555570',
    filenamePatterns: ['200c_leadershipcomm', 'leadershipcomm'],
  },
  {
    key: 'ew204',
    label: 'Operations',
    canvasId: '1555698',
    filenamePatterns: ['204_operations'],
  },
  {
    key: 'ew209',
    label: 'Strategic Leadership',
    canvasId: '1557494',
    filenamePatterns: ['209_strategicleadership', 'strategicleadership'],
  },

  // ---------------- Archive: legacy week-N behavior ----------------
  {
    key: 'micro',
    label: 'MicroEconomics',
    canvasId: '1544880',
    filenamePatterns: ['201a_micro'],
    weekPagePattern: 'pages/week-',
    startDates: { blue: '2025-07-28', gold: '2025-07-29' },
  },
  {
    key: 'macro',
    label: 'MacroEconomics',
    canvasId: '1549648',
    filenamePatterns: ['201b_macro'],
    weekPagePattern: 'pages/week-',
    startDates: { blue: '2026-01-07', gold: '2026-01-08' },
  },
  {
    key: 'accounting',
    label: 'Financial Accounting',
    canvasId: '1549713',
    filenamePatterns: ['202_accounting'],
    weekPagePattern: 'pages/week-',
    startDates: { blue: '2026-01-05', gold: '2026-01-06' },
  },
  {
    key: 'datadecisions',
    label: 'Data & Decisions',
    canvasId: '1545042',
    filenamePatterns: ['datadecisions'],
    weekPagePattern: 'pages/week-',
    startDates: { blue: '2025-10-14', gold: '2025-10-15' },
  },
  {
    key: 'marketing',
    label: 'Marketing',
    canvasId: '1545360',
    filenamePatterns: ['marketing'],
    weekPagePattern: 'pages/session-',
    startDates: { blue: '2025-10-14', gold: '2025-10-15' },
  },
  {
    key: 'leadingpeople',
    label: 'Leading People',
    canvasId: '1545386',
    filenamePatterns: ['leadingpeople'],
    weekPagePattern: 'pages/',
    startDates: { blue: '2025-08-06', gold: '2025-08-07' },
  },
];

/** Find the registry entry for an event source filename. null = no link. */
export function courseEntryForSource(source?: string): CourseLinkEntry | null {
  if (!source) return null;
  const s = source.toLowerCase();
  return (
    COURSE_LINKS.find((e) => e.filenamePatterns.some((p) => s.includes(p))) ??
    null
  );
}

/** Canonical bCourses course home URL, or null when unknown/unpublished. */
export function coursePageUrl(entry: CourseLinkEntry): string | null {
  return entry.canvasId
    ? `https://bcourses.berkeley.edu/courses/${entry.canvasId}`
    : null;
}

/** Canonical syllabus URL, or null when unknown/unpublished. */
export function syllabusUrl(entry: CourseLinkEntry): string | null {
  return entry.canvasId
    ? `https://bcourses.berkeley.edu/courses/${entry.canvasId}/assignments/syllabus`
    : null;
}
