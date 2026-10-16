import { describe, expect, it } from 'vitest';
import { getEffectiveAvailability } from '../../src/features/governance/availability.js';

const baseProfile = {
  status: 'approved' as const,
  availabilityStatus: 'available' as const,
  unavailableUntil: null as Date | null,
};

describe('getEffectiveAvailability', () => {
  it('returns available for an approved doctor with status=available', () => {
    expect(getEffectiveAvailability(baseProfile)).toBe('available');
  });

  it('returns unavailable for a non-approved doctor regardless of flag', () => {
    for (const status of ['pending', 'rejected', 'suspended'] as const) {
      expect(
        getEffectiveAvailability({
          ...baseProfile,
          status,
          availabilityStatus: 'available',
        }),
      ).toBe('unavailable');
    }
  });

  it('returns unavailable when status=unavailable and no return time', () => {
    expect(
      getEffectiveAvailability({
        ...baseProfile,
        availabilityStatus: 'unavailable',
        unavailableUntil: null,
      }),
    ).toBe('unavailable');
  });

  it('auto-returns to available when unavailableUntil is in the past', () => {
    const past = new Date(Date.now() - 5 * 60_000); // 5 min ago
    expect(
      getEffectiveAvailability(
        {
          ...baseProfile,
          availabilityStatus: 'unavailable',
          unavailableUntil: past,
        },
        new Date(), // now
      ),
    ).toBe('available');
  });

  it('stays unavailable when unavailableUntil is in the future', () => {
    const future = new Date(Date.now() + 60 * 60_000); // 1 hour ahead
    expect(
      getEffectiveAvailability(
        {
          ...baseProfile,
          availabilityStatus: 'unavailable',
          unavailableUntil: future,
        },
        new Date(),
      ),
    ).toBe('unavailable');
  });

  it('treats a non-approved doctor with future unavailableUntil as unavailable', () => {
    const future = new Date(Date.now() + 60 * 60_000);
    expect(
      getEffectiveAvailability({
        status: 'suspended',
        availabilityStatus: 'unavailable',
        unavailableUntil: future,
      }),
    ).toBe('unavailable');
  });
});
