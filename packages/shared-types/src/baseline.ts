import type { IsoDateTime } from './iso-date-time.js';
import type { VitalType } from './vital-reading.js';

/**
 * Personalized statistical baseline for one patient + vital.
 * Windowing and update cadence are processing concerns (Phase 1+).
 */
export interface Baseline {
  patientId: string;
  vitalType: VitalType;
  mean: number;
  stddev: number;
  windowSize?: string;
  sampleCount?: number;
  updatedAt?: IsoDateTime;
}
