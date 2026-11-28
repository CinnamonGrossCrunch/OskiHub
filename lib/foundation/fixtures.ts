import type { FoundationData } from './types';

export const FIXTURE_USER_A = '11111111-1111-4111-8111-111111111111';
export const FIXTURE_USER_B = '22222222-2222-4222-8222-222222222222';

const institutionId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const termId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const courseId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const offeringId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const blueSectionId = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
const goldSectionId = 'ffffffff-ffff-4fff-8fff-ffffffffffff';
const assignmentA = 'a1111111-1111-4111-8111-111111111111';
const assignmentB = 'b2222222-2222-4222-8222-222222222222';
const holidayAssignmentB = 'b3333333-3333-4333-8333-333333333333';

export const foundationFixtures: FoundationData = {
  courses: [{ id: courseId, institutionId, familyKey: 'EWMBA:209', title: 'Strategic Leadership' }],
  offerings: [{ id: offeringId, courseId, termId, offeringKey: 'primary' }],
  sections: [
    { id: blueSectionId, offeringId, sectionKey: '01B', label: 'Blue' },
    { id: goldSectionId, offeringId, sectionKey: '02B', label: 'Gold' },
  ],
  enrollments: [
    { id: 'e1111111-1111-4111-8111-111111111111', ownerUserId: FIXTURE_USER_A, offeringId, sectionIds: [blueSectionId], status: 'enrolled' },
    { id: 'e2222222-2222-4222-8222-222222222222', ownerUserId: FIXTURE_USER_B, offeringId, sectionIds: [goldSectionId], status: 'enrolled' },
  ],
  assignments: [
    { id: assignmentA, ownerUserId: FIXTURE_USER_A, offeringId, title: 'Week 5 Article Question' },
    { id: assignmentB, ownerUserId: FIXTURE_USER_B, offeringId, title: 'Week 5 Article Question' },
    { id: holidayAssignmentB, ownerUserId: FIXTURE_USER_B, offeringId, title: 'Holiday Week Article Question' },
  ],
  events: [
    { id: 'd1111111-1111-4111-8111-111111111111', ownerUserId: FIXTURE_USER_A, assignmentId: assignmentA, title: 'Week 5 Article Question', eventKind: 'deadline' },
    { id: 'd2222222-2222-4222-8222-222222222222', ownerUserId: FIXTURE_USER_B, assignmentId: assignmentB, title: 'Week 5 Article Question', eventKind: 'deadline' },
    { id: 'd3333333-3333-4333-8333-333333333333', ownerUserId: FIXTURE_USER_B, assignmentId: holidayAssignmentB, title: 'Holiday Week Article Question', eventKind: 'deadline' },
  ],
  observations: [
    { id: 'o1111111-1111-4111-8111-111111111111', ownerUserId: FIXTURE_USER_A, entityId: assignmentA, field: 'due_at', value: '2026-11-11T17:30:00-08:00', basis: 'verified_base', source: 'canvas-fixture', fetchedAt: '2026-11-28T00:00:00Z', revision: 1 },
    { id: 'o2222222-2222-4222-8222-222222222222', ownerUserId: FIXTURE_USER_B, entityId: assignmentB, field: 'due_at', value: '2026-11-11T17:30:00-08:00', basis: 'verified_base', source: 'canvas-fixture', fetchedAt: '2026-11-28T00:00:00Z', revision: 1 },
    { id: 'o3333333-3333-4333-8333-333333333333', ownerUserId: FIXTURE_USER_B, entityId: holidayAssignmentB, field: 'due_at', value: '2026-11-12T17:30:00-08:00', basis: 'verified_base', source: 'canvas-fixture', fetchedAt: '2026-11-28T00:00:00Z', revision: 1 },
  ],
  rules: [
    { id: 'r1111111-1111-4111-8111-111111111111', version: 1, field: 'due_at', sectionId: goldSectionId, operation: 'shift_days', days: 1, acceptedBasis: ['verified_base'], reason: 'Gold section syllabus rule shifts verified base deadlines by one day.' },
    { id: 'r2222222-2222-4222-8222-222222222222', version: 1, field: 'due_at', assignmentId: holidayAssignmentB, operation: 'suppress_shift', acceptedBasis: ['verified_base'], exceptionOf: 'r1111111-1111-4111-8111-111111111111', reason: 'Holiday exception suppresses the general Gold shift for this assignment.' },
  ],
  overrides: [],
  profileByEmail: {
    'mattgross@berkeley.edu': FIXTURE_USER_A,
  },
};
