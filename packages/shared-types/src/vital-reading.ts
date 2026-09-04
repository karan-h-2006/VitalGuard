import type { IsoDateTime } from './iso-date-time.js';

/**
 * Vital kinds the edge simulator and ingestion pipeline emit.
 * `respiratory_rate` is reserved in the OpenAPI contract for a later
 * sensor; Phase 0 simulator emits the four listed in the SRS narrative.
 */
export const VITAL_TYPES = [
  'heart_rate',
  'spo2',
  'temperature',
  'respiratory_rate',
  'motion',
] as const;

export type VitalType = (typeof VITAL_TYPES)[number];

/**
 * Per-sample classification. Watch/Warning/Critical are retained even
 * when a later rule might downgrade — a missed deterioration (false
 * negative) is worse than an extra Watch flag.
 */
export const VITAL_SEVERITY_TIERS = [
  'Normal',
  'Watch',
  'Warning',
  'Critical',
] as const;

export type VitalSeverityTier = (typeof VITAL_SEVERITY_TIERS)[number];

export interface VitalReading {
  patientId: string;
  vitalType: VitalType;
  value: number;
  timestamp: IsoDateTime;
  severityTier?: VitalSeverityTier;
}
