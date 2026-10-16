import type { doctorProfiles } from '../../db/schema.js';

export type DoctorProfileRow = typeof doctorProfiles.$inferSelect;

/**
 * Computes the *effective* availability of a doctor:
 * - Non-approved doctors are always 'unavailable' for assignment.
 * - If the stored status is 'unavailable' but `unavailableUntil` is set and
 *   is in the past, the doctor has auto-returned to 'available'.
 */
export function getEffectiveAvailability(
  profile: Pick<
    DoctorProfileRow,
    'status' | 'availabilityStatus' | 'unavailableUntil'
  >,
  now: Date = new Date(),
): 'available' | 'unavailable' {
  if (profile.status !== 'approved') return 'unavailable';
  if (profile.availabilityStatus === 'available') return 'available';
  // Doctor is marked unavailable — check auto-return
  if (profile.unavailableUntil && profile.unavailableUntil <= now)
    return 'available';
  return 'unavailable';
}

/** Shape returned in availability sub-objects on API responses. */
export function formatAvailability(
  profile: Pick<
    DoctorProfileRow,
    | 'availabilityStatus'
    | 'availabilityNote'
    | 'availabilityUpdatedAt'
    | 'unavailableUntil'
    | 'status'
  >,
  now: Date = new Date(),
) {
  return {
    status: profile.availabilityStatus,
    effectiveStatus: getEffectiveAvailability(profile, now),
    note: profile.availabilityNote,
    unavailableUntil: profile.unavailableUntil?.toISOString() ?? null,
    updatedAt: profile.availabilityUpdatedAt.toISOString(),
  };
}
