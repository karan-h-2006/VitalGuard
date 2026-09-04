import type { VitalType } from './vital-reading.js';

export interface StaticBand {
  min?: number;
  max?: number;
}

/**
 * Static (and optional clinician-overridden) bands. Missing min/max means
 * "not configured for this side" — evaluation must treat an unconfigured
 * bound as "do not suppress" rather than "always in range".
 */
export interface Threshold {
  patientId: string;
  vitalType: VitalType;
  staticBand?: StaticBand;
  clinicianOverride?: boolean;
}
