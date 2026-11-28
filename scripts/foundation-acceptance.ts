import { foundationFixtures, FIXTURE_USER_A, FIXTURE_USER_B } from '../lib/foundation/fixtures';
import { getPrivateEvent, resolveUserEvents } from '../lib/foundation/resolver';

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

const a = resolveUserEvents(FIXTURE_USER_A, foundationFixtures);
const b = resolveUserEvents(FIXTURE_USER_B, foundationFixtures);
assert(a.length === 1, 'User A should have one deadline event');
assert(b.length === 2, 'User B should have two deadline events');
assert(a[0].time.kind === 'instant' && a[0].time.at.startsWith('2026-11-11'), 'Blue deadline should remain on the verified base date');
assert(b[0].time.kind === 'instant' && b[0].time.at.startsWith('2026-11-13'), 'Gold deadline should shift one day from the verified base');
assert(b[1].time.kind === 'instant' && b[1].time.at.startsWith('2026-11-12'), 'Holiday exception should suppress the Gold shift');
assert(a[0].uid.endsWith('@oski.app'), 'Export UID should use the stable oski.app form');
assert(getPrivateEvent(FIXTURE_USER_A, b[0].id, foundationFixtures) === null, 'Cross-owner event lookup must not reveal another user event');
console.log('foundation acceptance: pass');
