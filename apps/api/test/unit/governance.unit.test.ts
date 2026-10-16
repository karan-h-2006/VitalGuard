import { describe, expect, it } from 'vitest';
import {
  assessDoctorAssignment,
  resolveAuditLogLabels,
} from '../../src/features/governance/admin-routes.js';

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

  it('rejects an approved doctor whose effective availability is unavailable', () => {
    expect(
      assessDoctorAssignment(
        'approved',
        'active',
        null,
        'inst-1',
        false,
        'unavailable',
        null,
      ),
    ).toBe('doctor_unavailable');
  });

  it('allows an approved doctor who is unavailable but whose unavailableUntil has passed (auto-return)', () => {
    const past = new Date(Date.now() - 60_000);
    expect(
      assessDoctorAssignment(
        'approved',
        'active',
        null,
        'inst-1',
        false,
        'unavailable',
        past,
      ),
    ).toBe('eligible');
  });

  it('institution override does NOT bypass unavailability', () => {
    expect(
      assessDoctorAssignment(
        'approved',
        'active',
        'inst-1',
        'inst-2',
        true,
        'unavailable',
        null,
      ),
    ).toBe('doctor_unavailable');
  });
});

describe('audit log display labels', () => {
  it('resolves actor, user targets, and institution targets in a batch map', () => {
    const rows = resolveAuditLogLabels(
      [
        {
          actorId: 'admin-id',
          targetId: 'patient-id',
          targetType: 'patient',
        },
        {
          actorId: 'admin-id',
          targetId: 'institution-id',
          targetType: 'institution',
        },
      ],
      new Map([
        ['admin-id', { email: 'admin@example.test', role: 'administrator' }],
        ['patient-id', { email: 'patient@example.test', role: 'patient' }],
      ]),
      new Map([['institution-id', 'North Clinic']]),
    );
    expect(rows[0]).toMatchObject({
      actorEmail: 'admin@example.test',
      actorRole: 'administrator',
      targetLabel: 'patient: patient@example.test',
    });
    expect(rows[1]?.targetLabel).toBe('institution: North Clinic');
  });

  it('falls back to target ID when the target record was deleted', () => {
    const [row] = resolveAuditLogLabels(
      [
        {
          actorId: 'missing-actor',
          targetId: 'deleted-id',
          targetType: 'user',
        },
      ],
      new Map(),
      new Map(),
    );
    expect(row).toMatchObject({
      actorEmail: null,
      actorRole: null,
      targetLabel: 'deleted-id',
    });
  });
});
