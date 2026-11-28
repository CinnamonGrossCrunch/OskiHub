import type { FoundationData, Observation, ResolutionRule, ResolvedEvent, UUID } from './types';

function guardConflict(rule: ResolutionRule, observation: Observation): string | undefined {
  const hasValue = rule.expectedValue !== undefined;
  const hasRevision = rule.expectedRevision !== undefined;
  if (!hasValue && !hasRevision) {
    return 'Deadline rule has no reviewed input guard; cohort adjustment withheld for review.';
  }
  if ((hasValue && (typeof rule.expectedValue !== 'string' || !rule.expectedValue.trim() || !Number.isFinite(Date.parse(rule.expectedValue)))) ||
      (hasRevision && (!Number.isSafeInteger(rule.expectedRevision) || rule.expectedRevision! < 1))) {
    return 'Deadline rule has an invalid reviewed input guard; cohort adjustment withheld for review.';
  }
  if ((hasValue && rule.expectedValue !== observation.value) ||
      (hasRevision && rule.expectedRevision !== observation.revision)) {
    return 'Deadline changed from the reviewed rule input; cohort adjustment withheld for review.';
  }
}

function shiftDays(iso: string, days: number): string {
  const date = new Date(iso);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString();
}

export function resolveUserEvents(ownerUserId: UUID, data: FoundationData): ResolvedEvent[] {
  const enrollments = data.enrollments.filter((e) => e.ownerUserId === ownerUserId);
  const sectionsByOffering = new Map<UUID, Set<UUID>>();
  for (const enrollment of enrollments) {
    sectionsByOffering.set(enrollment.offeringId, new Set(enrollment.sectionIds));
  }

  return data.events
    .filter((event) => event.ownerUserId === ownerUserId)
    .map((event) => {
      const observations = data.observations
        .filter((o) => o.entityId === event.assignmentId && o.field === 'due_at')
        .filter((o) => !o.ownerUserId || o.ownerUserId === ownerUserId)
        .sort((a, b) => b.sourceAuthority - a.sourceAuthority || b.revision - a.revision);
      const selected = observations[0];
      if (!selected) {
        return {
          id: event.id,
          uid: `${event.id}@oski.app`,
          ownerUserId,
          title: event.title,
          eventKind: event.eventKind,
          time: { kind: 'unknown', reason: 'No due-date observation is available.' },
          explanations: [{ field: 'due_at', selectedObservationIds: [], appliedRuleIds: [], reason: 'No observation selected.' }],
        } satisfies ResolvedEvent;
      }

      let value = selected.value;
      const appliedRuleIds: UUID[] = [];
      const assignment = data.assignments.find((a) => a.id === event.assignmentId && a.ownerUserId === ownerUserId);
      const offeringSectionIds = assignment ? sectionsByOffering.get(assignment.offeringId) : undefined;
      const visibleRules = data.rules.filter((r) => (!r.ownerUserId && !r.assignmentId) || r.ownerUserId === ownerUserId);
      const exception = visibleRules.find((r) => r.operation === 'suppress_shift' && r.assignmentId === event.assignmentId);
      const shift = visibleRules.find((r) => r.operation === 'shift_days' &&
        (!r.assignmentId || r.assignmentId === event.assignmentId) &&
        r.sectionId && offeringSectionIds?.has(r.sectionId));
      let conflict: string | undefined;

      if (exception && selected.basis && exception.acceptedBasis.includes(selected.basis)) {
        // A stale specific exception must not fall through to a general shift.
        conflict = guardConflict(exception, selected);
        if (!conflict) appliedRuleIds.push(exception.id);
      } else if (shift && selected.basis && shift.acceptedBasis.includes(selected.basis)) {
        conflict = guardConflict(shift, selected);
        if (!conflict) {
          value = shiftDays(value, shift.days ?? 0);
          appliedRuleIds.push(shift.id);
        }
      }

      const override = data.overrides.find((o) => o.ownerUserId === ownerUserId && o.eventId === event.id && o.field === 'due_at');
      if (override) value = override.value;

      return {
        id: event.id,
        uid: `${event.id}@oski.app`,
        ownerUserId,
        title: event.title,
        eventKind: event.eventKind,
        time: { kind: 'instant', at: value, timeZone: 'America/Los_Angeles' },
        conflict,
        explanations: [{
          field: 'due_at',
          selectedObservationIds: [selected.id],
          appliedRuleIds,
          overrideId: override?.id,
          reason: override ? override.reason : conflict ?? (exception && appliedRuleIds.includes(exception.id) ? exception.reason : shift && appliedRuleIds.includes(shift.id) ? shift.reason : 'Selected the latest authorized source observation without transformation.'),
        }],
      } satisfies ResolvedEvent;
    });
}

export function getPrivateEvent(ownerUserId: UUID, eventId: UUID, data: FoundationData): ResolvedEvent | null {
  return resolveUserEvents(ownerUserId, data).find((event) => event.id === eventId) ?? null;
}
