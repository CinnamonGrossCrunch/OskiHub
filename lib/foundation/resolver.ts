import type { FoundationData, ResolvedEvent, UUID } from './types';

function shiftDays(iso: string, days: number): string {
  const date = new Date(iso);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString();
}

export function resolveUserEvents(ownerUserId: UUID, data: FoundationData): ResolvedEvent[] {
  const enrollments = data.enrollments.filter((e) => e.ownerUserId === ownerUserId);
  const sectionIds = new Set(enrollments.flatMap((e) => e.sectionIds));

  return data.events
    .filter((event) => event.ownerUserId === ownerUserId)
    .map((event) => {
      const observations = data.observations
        .filter((o) => o.entityId === event.assignmentId && o.field === 'due_at')
        .filter((o) => !o.ownerUserId || o.ownerUserId === ownerUserId)
        .sort((a, b) => b.revision - a.revision);
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
      const exception = data.rules.find((r) => r.operation === 'suppress_shift' && r.assignmentId === event.assignmentId);
      const shift = data.rules.find((r) => r.operation === 'shift_days' && r.sectionId && sectionIds.has(r.sectionId));

      if (exception && selected.basis && exception.acceptedBasis.includes(selected.basis)) {
        appliedRuleIds.push(exception.id);
      } else if (shift && selected.basis && shift.acceptedBasis.includes(selected.basis)) {
        value = shiftDays(value, shift.days ?? 0);
        appliedRuleIds.push(shift.id);
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
        explanations: [{
          field: 'due_at',
          selectedObservationIds: [selected.id],
          appliedRuleIds,
          overrideId: override?.id,
          reason: override ? override.reason : exception && appliedRuleIds.includes(exception.id) ? exception.reason : shift && appliedRuleIds.includes(shift.id) ? shift.reason : 'Selected the latest authorized source observation without transformation.',
        }],
      } satisfies ResolvedEvent;
    });
}

export function getPrivateEvent(ownerUserId: UUID, eventId: UUID, data: FoundationData): ResolvedEvent | null {
  return resolveUserEvents(ownerUserId, data).find((event) => event.id === eventId) ?? null;
}
