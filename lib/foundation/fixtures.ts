import type { FoundationData } from './types';

export const FIXTURE_USER_A = '11111111-1111-4111-8111-111111111111';
export const FIXTURE_USER_B = '22222222-2222-4222-8222-222222222222';

const institutionId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const termId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const strategyCourseId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const operationsCourseId = 'cdcdcdcd-cdcd-4cdc-8cdc-cdcdcdcdcdcd';
const strategyOfferingId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const operationsOfferingId = 'dededede-dede-4ded-8ded-dededededede';
const blueSectionId = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
const goldSectionId = 'ffffffff-ffff-4fff-8fff-ffffffffffff';
const operationsSectionId = 'efefefef-efef-4efe-8efe-efefefefefef';
const assignmentA = 'a1111111-1111-4111-8111-111111111111';
const assignmentB = 'b2222222-2222-4222-8222-222222222222';
const holidayAssignmentB = 'b3333333-3333-4333-8333-333333333333';
const operationsAssignmentB = 'b4444444-4444-4444-8444-444444444444';
const individualAssignmentB = 'b5555555-5555-4555-8555-555555555555';

export const foundationFixtures: FoundationData = {
  courses: [
    { id: strategyCourseId, institutionId, familyKey: 'EWMBA:209', title: 'Strategic Leadership' },
    { id: operationsCourseId, institutionId, familyKey: 'EWMBA:204', title: 'Operations' },
  ],
  offerings: [
    { id: strategyOfferingId, courseId: strategyCourseId, termId, offeringKey: 'primary' },
    { id: operationsOfferingId, courseId: operationsCourseId, termId, offeringKey: 'primary' },
  ],
  sections: [
    { id: blueSectionId, offeringId: strategyOfferingId, sectionKey: '01B', label: 'Blue' },
    { id: goldSectionId, offeringId: strategyOfferingId, sectionKey: '02B', label: 'Gold' },
    { id: operationsSectionId, offeringId: operationsOfferingId, sectionKey: '01A', label: 'Operations' },
  ],
  enrollments: [
    { id: 'e1111111-1111-4111-8111-111111111111', ownerUserId: FIXTURE_USER_A, offeringId: strategyOfferingId, sectionIds: [blueSectionId], status: 'enrolled' },
    { id: 'e2222222-2222-4222-8222-222222222222', ownerUserId: FIXTURE_USER_B, offeringId: strategyOfferingId, sectionIds: [goldSectionId], status: 'enrolled' },
    { id: 'e3333333-3333-4333-8333-333333333333', ownerUserId: FIXTURE_USER_B, offeringId: operationsOfferingId, sectionIds: [operationsSectionId], status: 'enrolled' },
  ],
  assignments: [
    { id: assignmentA, ownerUserId: FIXTURE_USER_A, offeringId: strategyOfferingId, title: 'Week 5 Article Question' },
    { id: assignmentB, ownerUserId: FIXTURE_USER_B, offeringId: strategyOfferingId, title: 'Week 5 Article Question' },
    { id: holidayAssignmentB, ownerUserId: FIXTURE_USER_B, offeringId: strategyOfferingId, title: 'Holiday Week Article Question' },
    { id: operationsAssignmentB, ownerUserId: FIXTURE_USER_B, offeringId: operationsOfferingId, title: 'Operations Lab' },
    { id: individualAssignmentB, ownerUserId: FIXTURE_USER_B, offeringId: strategyOfferingId, title: 'Individual Extension Check' },
  ],
  events: [
    { id: 'd1111111-1111-4111-8111-111111111111', ownerUserId: FIXTURE_USER_A, assignmentId: assignmentA, title: 'Week 5 Article Question', eventKind: 'deadline' },
    { id: 'd2222222-2222-4222-8222-222222222222', ownerUserId: FIXTURE_USER_B, assignmentId: assignmentB, title: 'Week 5 Article Question', eventKind: 'deadline' },
    { id: 'd3333333-3333-4333-8333-333333333333', ownerUserId: FIXTURE_USER_B, assignmentId: holidayAssignmentB, title: 'Holiday Week Article Question', eventKind: 'deadline' },
    { id: 'd4444444-4444-4444-8444-444444444444', ownerUserId: FIXTURE_USER_B, assignmentId: operationsAssignmentB, title: 'Operations Lab', eventKind: 'deadline' },
    { id: 'd5555555-5555-4555-8555-555555555555', ownerUserId: FIXTURE_USER_B, assignmentId: individualAssignmentB, title: 'Individual Extension Check', eventKind: 'deadline' },
  ],
  observations: [
    { id: '01111111-1111-4111-8111-111111111111', ownerUserId: FIXTURE_USER_A, entityId: assignmentA, field: 'due_at', value: '2026-11-11T17:30:00-08:00', basis: 'verified_base', source: 'canvas', sourceAuthority: 100, fetchedAt: '2026-11-28T00:00:00Z', revision: 1 },
    { id: '02222222-2222-4222-8222-222222222222', ownerUserId: FIXTURE_USER_B, entityId: assignmentB, field: 'due_at', value: '2026-11-11T17:30:00-08:00', basis: 'verified_base', source: 'canvas', sourceAuthority: 100, fetchedAt: '2026-11-28T00:00:00Z', revision: 1 },
    { id: '03333333-3333-4333-8333-333333333333', ownerUserId: FIXTURE_USER_B, entityId: holidayAssignmentB, field: 'due_at', value: '2026-11-12T17:30:00-08:00', basis: 'verified_base', source: 'canvas', sourceAuthority: 100, fetchedAt: '2026-11-28T00:00:00Z', revision: 1 },
    { id: '04444444-4444-4444-8444-444444444444', ownerUserId: FIXTURE_USER_B, entityId: operationsAssignmentB, field: 'due_at', value: '2026-11-04T17:30:00-08:00', basis: 'verified_base', source: 'canvas', sourceAuthority: 100, fetchedAt: '2026-11-28T00:00:00Z', revision: 1 },
    { id: '05555555-5555-4555-8555-555555555555', ownerUserId: FIXTURE_USER_B, entityId: individualAssignmentB, field: 'due_at', value: '2026-11-13T17:30:00-08:00', basis: 'verified_individual_effective', source: 'canvas', sourceAuthority: 100, fetchedAt: '2026-11-28T00:00:00Z', revision: 1 },
    { id: '06666666-6666-4666-8666-666666666666', ownerUserId: FIXTURE_USER_B, entityId: assignmentB, field: 'due_at', value: '2026-11-10T17:30:00-08:00', basis: 'verified_base', source: 'legacy-ics', sourceAuthority: 10, fetchedAt: '2026-11-28T00:00:00Z', revision: 99 },
  ],
  rules: [
    { id: '11111111-2222-4333-8444-555555555555', version: 1, field: 'due_at', sectionId: goldSectionId, operation: 'shift_days', days: 1, acceptedBasis: ['verified_base'], expectedValue: '2026-11-11T17:30:00-08:00', expectedRevision: 1, reason: 'Gold section syllabus rule shifts the reviewed verified base deadline by one day.' },
    { id: '22222222-3333-4444-8555-666666666666', version: 1, ownerUserId: FIXTURE_USER_B, field: 'due_at', assignmentId: holidayAssignmentB, operation: 'suppress_shift', acceptedBasis: ['verified_base'], expectedValue: '2026-11-12T17:30:00-08:00', expectedRevision: 1, exceptionOf: '11111111-2222-4333-8444-555555555555', reason: 'Holiday exception suppresses the general Gold shift for this assignment.' },
  ],
  overrides: [],
  profileByEmail: {},
};
