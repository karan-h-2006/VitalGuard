import { describe, expect, it } from 'vitest';
import { patientAdminQuery } from '../../src/features/governance/admin-routes.js';

describe('admin patient list filters', () => {
  it('returns all patients when assignment is omitted', () => {
    expect(patientAdminQuery.parse({}).assignment).toBeUndefined();
  });

  it.each(['unassigned', 'assigned'] as const)(
    'accepts the %s assignment filter',
    (assignment) => {
      expect(patientAdminQuery.parse({ assignment }).assignment).toBe(
        assignment,
      );
    },
  );

  it('accepts a valid institution filter and rejects invalid values', () => {
    expect(
      patientAdminQuery.safeParse({
        institutionId: '33333333-3333-4333-8333-333333333333',
      }).success,
    ).toBe(true);
    expect(
      patientAdminQuery.safeParse({ institutionId: 'not-an-id' }).success,
    ).toBe(false);
  });
});
