import { env } from '../env.js';

export const DEFAULT_THRESHOLD_BANDS = {
  heart_rate: { min: 60, max: 100 },
  spo2: { min: 95 },
  temperature: { min: 36.1, max: 37.5 },
} as const;

export const Z_SCORE_STDDEV_FLOOR = 0.01;

export const analyticsConfig = {
  baselineWindowDays: env.BASELINE_WINDOW_DAYS,
  baselineMinSamples: env.BASELINE_MIN_SAMPLES,
  anomalyMildZThreshold: env.ANOMALY_MILD_Z_THRESHOLD,
  anomalyModerateZThreshold: env.ANOMALY_MODERATE_Z_THRESHOLD,
  trendSampleCount: env.TREND_SAMPLE_COUNT,
  trendLookaheadMinutes: env.TREND_LOOKAHEAD_MINUTES,
  correlationConcurrencyMinutes: env.CORRELATION_CONCURRENCY_MINUTES,
} as const;
