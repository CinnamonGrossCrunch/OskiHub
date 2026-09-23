/**
 * Course Data Foundation — typed domain model.
 *
 * Conceptual rule: syllabi/scaffolding are the narrative; Canvas is the
 * up-to-date source of truth. The backend represents that distinction via
 * `provenance` instead of collapsing everything into one flat ICS.
 *
 * Pipeline: Canvas API + scaffold ICS --ingest--> lib/generated/courses/*.json
 * --reader--> CalendarEvent[] (the existing UI contract, extended).
 */

export type Provenance = 'canvas' | 'scaffold' | 'merged';

/** A deliverable. Canvas is authoritative for title/due date/points/URL. */
export interface CourseAssignment {
  /** Stable identity: 'canvas:<assignmentId>' or 'scaffold:<slug>' */
  id: string;
  /** Short course key, e.g. 'ew204' (see scripts/course-data/courses.json) */
  courseId: string;
  /** Display title, e.g. 'Operations — Concept Check #3 due' */
  title: string;
  /** ISO datetime. Canvas wins; null when Canvas has no due date. */
  dueAt: string | null;
  /** Canvas points_possible; null when unknown. */
  pointsPossible: number | null;
  /** Canvas assignment URL (or course URL for scaffold-only items). */
  url: string;
  provenance: Provenance;
  /** True when no Canvas assignment backs this (real per course pages, or legacy). */
  unverified?: boolean;
  /** Narrative carried over from the scaffold ICS (readings, context). */
  scaffoldNote?: string;
  /** Original ICS UID, preserved so UI facets keyed on UID don't shift. */
  scaffoldUid?: string;
}

/** A class meeting / session. Pure narrative scaffolding — never a deliverable. */
export interface CourseSession {
  id: string;
  courseId: string;
  title: string;
  /** ISO datetimes */
  start: string;
  end: string;
  location?: string;
  topic?: string;
  readings?: string[];
  description?: string;
  provenance: 'scaffold';
  scaffoldUid?: string;
}

/** Merged per-course dataset — the generated artifact the app reads. */
export interface CourseData {
  courseId: string;
  canvasCourseId: number | null;
  title: string;
  term: string;
  assignments: CourseAssignment[];
  sessions: CourseSession[];
  /** ISO timestamps for staleness reasoning */
  generatedAt: string;
  canvasSyncedAt: string | null;
  /** Ghosts dropped at generation time (never reach the app) */
  droppedGhosts?: { title: string; reason: string }[];
}

/** Raw Canvas ingest output (truth layer, unmerged). */
export interface CanvasIngest {
  courseId: string;
  canvasCourseId: number;
  syncedAt: string;
  unpublished?: boolean;
  assignments: {
    id: number;
    name: string;
    dueAt: string | null;
    pointsPossible: number | null;
    published: boolean;
    htmlUrl: string;
  }[];
}
