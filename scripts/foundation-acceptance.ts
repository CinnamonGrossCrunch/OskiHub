import { foundationFixtures, FIXTURE_USER_A, FIXTURE_USER_B } from '../lib/foundation/fixtures';
import { getPrivateEvent, resolveUserEvents } from '../lib/foundation/resolver';

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}
function byTitle(events: ReturnType<typeof resolveUserEvents>, title: string) {
  const event = events.find((e) => e.title === title);
  assert(event, `Missing event ${title}`);
  return event!;
}

const a = resolveUserEvents(FIXTURE_USER_A, foundationFixtures);
const b = resolveUserEvents(FIXTURE_USER_B, foundationFixtures);
assert(a.length === 1, 'User A should have one deadline event');
assert(b.length === 4, 'User B should have four deadline events');
assert((byTitle(a, 'Week 5 Article Question').time as any).at.startsWith('2026-11-11'), 'Blue deadline should remain on the verified base date');
assert((byTitle(b, 'Week 5 Article Question').time as any).at.startsWith('2026-11-13'), 'Gold deadline should shift one day from Canvas, not from legacy revision 99');
assert((byTitle(b, 'Holiday Week Article Question').time as any).at.startsWith('2026-11-12'), 'Holiday exception should suppress the Gold shift');
assert((byTitle(b, 'Operations Lab').time as any).at.startsWith('2026-11-04'), 'Strategy Gold rule must not move an Operations deadline');
assert((byTitle(b, 'Individual Extension Check').time as any).at.startsWith('2026-11-13'), 'Individualized deadline must not receive the general Gold shift');
assert(a[0].uid.endsWith('@oski.app'), 'Export UID should use the stable oski.app form');
assert(getPrivateEvent(FIXTURE_USER_A, b[0].id, foundationFixtures) === null, 'Cross-owner event lookup must not reveal another user event');

const updated = structuredClone(foundationFixtures);
updated.observations.push({ id: '07777777-7777-4777-8777-777777777777', ownerUserId: FIXTURE_USER_B, entityId: 'b2222222-2222-4222-8222-222222222222', field: 'due_at', value: '2026-11-14T17:30:00-08:00', basis: 'verified_base', source: 'canvas', sourceAuthority: 100, fetchedAt: '2026-11-29T00:00:00Z', revision: 2 });
const b2 = resolveUserEvents(FIXTURE_USER_B, updated);
assert((byTitle(b2, 'Week 5 Article Question').time as any).at.startsWith('2026-11-14'), 'Changed Canvas deadline should surface without the guarded cohort shift');
assert(byTitle(b2, 'Week 5 Article Question').conflict, 'Guard mismatch should surface a conflict for review');
assert(byTitle(b2, 'Week 5 Article Question').uid === byTitle(b, 'Week 5 Article Question').uid, 'Source update must preserve stable event UID');

// Missing or malformed reviewed inputs must never authorize a transformation.
const invalidGuards = [
  {},
  { expectedValue: '' },
  { expectedValue: '   ' },
  { expectedValue: 'not-a-date' },
  { expectedRevision: 0 },
  { expectedRevision: -1 },
  { expectedRevision: 1.5 },
  { expectedRevision: Number.NaN },
  { expectedValue: '2026-11-14T17:30:00-08:00', expectedRevision: 0 },
];
for (const [index, guard] of invalidGuards.entries()) {
  const data = structuredClone(updated);
  const { expectedValue: _value, expectedRevision: _revision, ...rule } = data.rules[0];
  data.rules[0] = { ...rule, ...guard };
  const event = byTitle(resolveUserEvents(FIXTURE_USER_B, data), 'Week 5 Article Question');
  assert(event.time.kind === 'instant' && event.time.at === '2026-11-14T17:30:00-08:00', `Invalid guard ${index} must preserve the Saturday source deadline`);
  assert(event.conflict && event.explanations[0].appliedRuleIds.length === 0, `Invalid guard ${index} must expose a conflict without applying the rule`);
  assert(event.uid === byTitle(b, 'Week 5 Article Question').uid, 'Withholding a rule must preserve the event UID');
}

// The contract permits a value OR revision guard. Every supplied guard must match.
for (const guard of [
  { expectedValue: '2026-11-11T17:30:00-08:00' },
  { expectedRevision: 1 },
  { expectedValue: '2026-11-11T17:30:00-08:00', expectedRevision: 1 },
]) {
  const data = structuredClone(foundationFixtures);
  const { expectedValue: _value, expectedRevision: _revision, ...rule } = data.rules[0];
  data.rules[0] = { ...rule, ...guard };
  const event = byTitle(resolveUserEvents(FIXTURE_USER_B, data), 'Week 5 Article Question');
  assert(event.time.kind === 'instant' && event.time.at === '2026-11-13T01:30:00.000Z' && !event.conflict, 'A matching reviewed guard must permit the existing Gold shift');
}
for (const mismatch of [{ expectedValue: '2026-11-10T17:30:00-08:00' }, { expectedRevision: 2 }]) {
  const data = structuredClone(foundationFixtures);
  Object.assign(data.rules[0], mismatch);
  const event = byTitle(resolveUserEvents(FIXTURE_USER_B, data), 'Week 5 Article Question');
  assert(event.time.kind === 'instant' && event.time.at === '2026-11-11T17:30:00-08:00' && event.conflict, 'Either mismatched supplied guard must stop the shift');
}

for (const badException of [{ expectedValue: undefined, expectedRevision: undefined }, { expectedRevision: 2 }]) {
  const data = structuredClone(foundationFixtures);
  // General rule deliberately matches this holiday input, so fall-through would move it.
  data.rules[0].expectedValue = '2026-11-12T17:30:00-08:00';
  Object.assign(data.rules[1], badException);
  const event = byTitle(resolveUserEvents(FIXTURE_USER_B, data), 'Holiday Week Article Question');
  assert(event.time.kind === 'instant' && event.time.at === '2026-11-12T17:30:00-08:00', 'Unreviewed/stale holiday exception must not fall through to the general shift');
  assert(event.conflict && event.explanations[0].appliedRuleIds.length === 0, 'Invalid exception must be visible for review');
}

const foreignRule = structuredClone(foundationFixtures);
foreignRule.rules[0].ownerUserId = FIXTURE_USER_A;
const privateRuleResult = byTitle(resolveUserEvents(FIXTURE_USER_B, foreignRule), 'Week 5 Article Question');
assert(privateRuleResult.time.kind === 'instant' && privateRuleResult.time.at === '2026-11-11T17:30:00-08:00', 'Another owner\'s private rule must not apply');

const assignmentScopedRule = structuredClone(foundationFixtures);
assignmentScopedRule.rules = [{ ...assignmentScopedRule.rules[0], ownerUserId: FIXTURE_USER_B, assignmentId: 'b3333333-3333-4333-8333-333333333333' }];
const otherAssignment = byTitle(resolveUserEvents(FIXTURE_USER_B, assignmentScopedRule), 'Week 5 Article Question');
assert(otherAssignment.time.kind === 'instant' && otherAssignment.time.at === '2026-11-11T17:30:00-08:00' && !otherAssignment.conflict, 'Private assignment rule must not affect another assignment in the same section');

console.log('foundation acceptance: pass (baseline, reviewed guards, exceptions, scope, and stable identities)');
