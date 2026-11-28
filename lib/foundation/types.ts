export type UUID = string;

export type DeadlineBasis =
  | 'verified_base'
  | 'verified_section_effective'
  | 'verified_individual_effective'
  | 'user_effective_unknown'
  | 'unknown';

export type TimeShape =
  | { kind: 'instant'; at: string; timeZone: string }
  | { kind: 'interval'; start: string; end: string; timeZone: string }
  | { kind: 'date'; startDate: string; endDateExclusive: string }
  | { kind: 'unknown'; reason: string };

export interface Course { id: UUID; institutionId: UUID; familyKey: string; title: string }
export interface Offering { id: UUID; courseId: UUID; termId: UUID; offeringKey: string }
export interface Section { id: UUID; offeringId: UUID; sectionKey: string; label: string }
export interface Enrollment { id: UUID; ownerUserId: UUID; offeringId: UUID; sectionIds: UUID[]; status: 'enrolled' | 'completed' | 'planned' | 'manual' }
export interface Assignment { id: UUID; ownerUserId: UUID; offeringId: UUID; title: string }
export interface PersonalEvent { id: UUID; ownerUserId: UUID; assignmentId?: UUID; sectionId?: UUID; title: string; eventKind: 'deadline' | 'meeting' | 'exam' | 'personal' }

export interface Observation {
  id: UUID;
  ownerUserId?: UUID;
  entityId: UUID;
  field: 'due_at' | 'title' | 'meeting_time' | 'room';
  value: string;
  basis?: DeadlineBasis;
  source: string;
  sourceAuthority: number;
  fetchedAt: string;
  revision: number;
}

export interface ResolutionRule {
  id: UUID;
  version: number;
  field: 'due_at';
  sectionId?: UUID;
  assignmentId?: UUID;
  operation: 'shift_days' | 'suppress_shift';
  days?: number;
  acceptedBasis: DeadlineBasis[];
  exceptionOf?: UUID;
  reason: string;
}

export interface UserOverride {
  id: UUID;
  ownerUserId: UUID;
  eventId: UUID;
  field: 'due_at';
  value: string;
  reason: string;
}

export interface FieldExplanation {
  field: string;
  selectedObservationIds: UUID[];
  appliedRuleIds: UUID[];
  overrideId?: UUID;
  reason: string;
}

export interface ResolvedEvent {
  id: UUID;
  uid: string;
  ownerUserId: UUID;
  title: string;
  eventKind: PersonalEvent['eventKind'];
  time: TimeShape;
  explanations: FieldExplanation[];
}

export interface FoundationData {
  courses: Course[];
  offerings: Offering[];
  sections: Section[];
  enrollments: Enrollment[];
  assignments: Assignment[];
  events: PersonalEvent[];
  observations: Observation[];
  rules: ResolutionRule[];
  overrides: UserOverride[];
  profileByEmail: Record<string, UUID>;
}
