import { describe, expect, it } from 'vitest';
import { assessDoctorAssignment } from '../../src/features/governance/admin-routes.js';

describe('doctor assignment eligibility', () => {
  it.each(['pending', 'rejected', 'suspended'] as const)(
    'denies a %s doctor',
    (status) => {
      expect(
        assessDoctorAssignment(status, 'active', null, 'inst-1', false),
      ).toBe('doctor_ineligible');
    },
  );

  it('requires an active institution for approved doctors', () => {
    expect(
      assessDoctorAssignment('approved', 'inactive', null, 'inst-1', false),
    ).toBe('doctor_ineligible');
  });

  it('enforces patient institution preference unless override is supplied', () => {
    expect(
      assessDoctorAssignment('approved', 'active', 'inst-1', 'inst-2', false),
    ).toBe('preference_mismatch');
    expect(
      assessDoctorAssignment('approved', 'active', 'inst-1', 'inst-2', true),
    ).toBe('eligible');
    expect(
      assessDoctorAssignment('approved', 'active', 'inst-1', 'inst-1', false),
    ).toBe('eligible');
  });
});
