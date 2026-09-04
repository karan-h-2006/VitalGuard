/**
 * Mirrors schemas/vital-sample.schema.json, the source of truth shared by
 * Python edge code and future Node ingestion. Keep this type in sync with
 * that schema until schema-to-TypeScript generation is introduced.
 */
export type SignalQuality = 'clean' | 'noisy' | 'implausible';

export interface QualifiedVitalValue {
  value: number;
  quality: SignalQuality;
}

export interface HeartRateSample extends QualifiedVitalValue {
  unit: 'bpm';
}

export interface Spo2Sample extends QualifiedVitalValue {
  unit: 'percent';
}

export interface TemperatureSample {
  value: number;
  unit: 'celsius';
}

export interface MotionSample {
  roll: number;
  pitch: number;
  accel_magnitude: number;
  fall_detected: boolean;
}

export interface VitalSample {
  device_id: string;
  patient_id: string;
  timestamp: string;
  heart_rate: HeartRateSample;
  spo2: Spo2Sample;
  temperature: TemperatureSample;
  motion: MotionSample;
  gap: boolean;
}
