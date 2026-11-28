import type { SupabaseClient } from '@supabase/supabase-js';
import type { FoundationData, UUID } from './types';

const empty: FoundationData = { courses: [], offerings: [], sections: [], enrollments: [], assignments: [], events: [], observations: [], rules: [], overrides: [], profileByEmail: {} };
type Row = Record<string, unknown>;
const rows = (value: unknown): Row[] => Array.isArray(value) ? value as Row[] : [];
const s = (row: Row, key: string): string => String(row[key] ?? '');
const opt = (row: Row, key: string): string | undefined => row[key] == null ? undefined : String(row[key]);
const n = (row: Row, key: string): number => Number(row[key] ?? 0);
const arr = (row: Row, key: string): string[] => Array.isArray(row[key]) ? row[key].map(String) : [];

export async function loadFoundationData(supabase: SupabaseClient, ownerUserId: UUID): Promise<FoundationData> {
  const [courses, offerings, sections, enrollments, assignments, events, observations, rules, overrides] = await Promise.all([
    supabase.from('courses').select('*'),
    supabase.from('course_offerings').select('*'),
    supabase.from('course_sections').select('*'),
    supabase.from('user_enrollments').select('*').eq('owner_user_id', ownerUserId),
    supabase.from('assignments').select('*').eq('owner_user_id', ownerUserId),
    supabase.from('personal_events').select('*').eq('owner_user_id', ownerUserId),
    supabase.from('source_observations').select('*').or(`owner_user_id.is.null,owner_user_id.eq.${ownerUserId}`),
    supabase.from('resolution_rules').select('*'),
    supabase.from('user_overrides').select('*').eq('owner_user_id', ownerUserId),
  ]);
  if ([courses, offerings, sections, enrollments, assignments, events, observations, rules, overrides].some((r) => r.error)) return empty;
  return {
    courses: rows(courses.data).map((r) => ({ id: s(r, 'id'), institutionId: s(r, 'institution_id'), familyKey: s(r, 'family_key'), title: s(r, 'title') })),
    offerings: rows(offerings.data).map((r) => ({ id: s(r, 'id'), courseId: s(r, 'course_id'), termId: s(r, 'term_id'), offeringKey: s(r, 'offering_key') })),
    sections: rows(sections.data).map((r) => ({ id: s(r, 'id'), offeringId: s(r, 'offering_id'), sectionKey: s(r, 'section_key'), label: opt(r, 'label') ?? s(r, 'section_key') })),
    enrollments: rows(enrollments.data).map((r) => ({ id: s(r, 'id'), ownerUserId: s(r, 'owner_user_id'), offeringId: s(r, 'offering_id'), sectionIds: arr(r, 'section_ids'), status: s(r, 'status') as FoundationData['enrollments'][number]['status'] })),
    assignments: rows(assignments.data).map((r) => ({ id: s(r, 'id'), ownerUserId: s(r, 'owner_user_id'), offeringId: s(r, 'offering_id'), title: s(r, 'title') })),
    events: rows(events.data).map((r) => ({ id: s(r, 'id'), ownerUserId: s(r, 'owner_user_id'), assignmentId: opt(r, 'assignment_id'), sectionId: opt(r, 'section_id'), title: s(r, 'title'), eventKind: s(r, 'event_kind') as FoundationData['events'][number]['eventKind'] })),
    observations: rows(observations.data).map((r) => ({ id: s(r, 'id'), ownerUserId: opt(r, 'owner_user_id'), entityId: s(r, 'entity_id'), field: s(r, 'field') as FoundationData['observations'][number]['field'], value: s(r, 'value'), basis: opt(r, 'basis') as FoundationData['observations'][number]['basis'], source: s(r, 'source'), sourceAuthority: n(r, 'source_authority'), fetchedAt: s(r, 'fetched_at'), revision: n(r, 'revision') })),
    rules: rows(rules.data).map((r) => ({ id: s(r, 'id'), version: n(r, 'version'), field: 'due_at', sectionId: opt(r, 'section_id'), assignmentId: opt(r, 'assignment_id'), operation: s(r, 'operation') as FoundationData['rules'][number]['operation'], days: r.days == null ? undefined : n(r, 'days'), acceptedBasis: arr(r, 'accepted_basis') as FoundationData['rules'][number]['acceptedBasis'], exceptionOf: opt(r, 'exception_of'), reason: s(r, 'reason') })),
    overrides: rows(overrides.data).map((r) => ({ id: s(r, 'id'), ownerUserId: s(r, 'owner_user_id'), eventId: s(r, 'event_id'), field: 'due_at', value: s(r, 'value'), reason: s(r, 'reason') })),
    profileByEmail: {},
  };
}
