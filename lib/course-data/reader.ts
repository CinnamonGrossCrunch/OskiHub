/**
 * Course-data foundation reader — the app's view of merged course data.
 *
 * Reads lib/generated/courses/<courseId>.json (Canvas truth merged over
 * scaffold narrative) and converts to CalendarEvent[], the existing UI
 * contract. Instants are normalized to UTC ISO strings, matching the
 * legacy ICS parser's storage format, so the UI can't tell the difference.
 */
import { promises as fs } from 'fs';
import path from 'path';
import type { CalendarEvent } from '../icsUtils';
import type { CourseData } from './types';

const DEFAULT_EVENT_MINUTES = 30;

export async function loadCourseData(courseId: string): Promise<CourseData | null> {
  try {
    const p = path.join(
      process.cwd(), 'lib', 'generated', 'courses', `${courseId}.json`
    );
    const raw = await fs.readFile(p, 'utf-8');
    return JSON.parse(raw) as CourseData;
  } catch {
    return null;
  }
}

/** Load several courses; skips (with a warning) any that fail. */
export async function loadCourseDataMany(
  courseIds: string[]
): Promise<CourseData[]> {
  const out: CourseData[] = [];
  for (const id of courseIds) {
    const d = await loadCourseData(id);
    if (d) out.push(d);
    else console.warn(`[course-data] no generated data for '${id}'`);
  }
  return out;
}

function toStorageIso(iso: string | null | undefined): string | undefined {
  if (!iso) return undefined;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

function addMinutesIso(iso: string, minutes: number): string {
  const d = new Date(iso);
  return new Date(d.getTime() + minutes * 60_000).toISOString();
}

function canvasOnlyDescription(data: CourseData, title: string, pts: number | null, url: string): string {
  const ptsTxt = pts != null ? ` (${pts} pts)` : '';
  return `${data.title}${ptsTxt}.\n\nFrom Canvas: ${title}\n${url}`;
}

export function courseDataToEvents(
  data: CourseData,
  cohort: 'blue' | 'gold',
  sourceFile: string
): CalendarEvent[] {
  const events: CalendarEvent[] = [];

  for (const a of data.assignments) {
    const start = toStorageIso(a.dueAt);
    if (!start) continue;
    events.push({
      uid: a.scaffoldUid || `coursedata-${data.courseId}-${a.id}`,
      title: a.title,
      start,
      end: addMinutesIso(start, DEFAULT_EVENT_MINUTES),
      url: a.url || undefined,
      // Merged events keep the scaffold's curated narrative; canvas-only
      // events get a minimal generated description.
      description:
        a.scaffoldNote ||
        canvasOnlyDescription(data, a.title, a.pointsPossible, a.url),
      cohort,
      source: sourceFile,
      provenance: a.provenance,
      assignmentId: a.id,
    });
  }

  for (const s of data.sessions) {
    const start = toStorageIso(s.start);
    if (!start) continue;
    events.push({
      uid: s.scaffoldUid || s.id,
      title: s.title,
      start,
      end: toStorageIso(s.end),
      location: s.location || undefined,
      description: s.description || undefined,
      cohort,
      source: sourceFile,
      provenance: 'scaffold',
    });
  }

  return events;
}
