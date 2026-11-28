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
assert((byTitle(b2, 'Week 5 Article Question').time as any).at.startsWith('2026-11-16'), 'Newer Canvas revision should update the resolved deadline');
assert(byTitle(b2, 'Week 5 Article Question').uid === byTitle(b, 'Week 5 Article Question').uid, 'Source update must preserve stable event UID');
console.log('foundation acceptance: pass');
