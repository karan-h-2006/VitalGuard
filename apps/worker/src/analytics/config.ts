import { env } from '../env.js';

export const analyticsConfig = {
  baselineWindowDays: env.BASELINE_WINDOW_DAYS,
  baselineMinSamples: env.BASELINE_MIN_SAMPLES,
  anomalyMildZThreshold: env.ANOMALY_MILD_Z_THRESHOLD,
  anomalyModerateZThreshold: env.ANOMALY_MODERATE_Z_THRESHOLD,
  trendSampleCount: env.TREND_SAMPLE_COUNT,
  trendLookaheadMinutes: env.TREND_LOOKAHEAD_MINUTES,
  correlationConcurrencyMinutes: env.CORRELATION_CONCURRENCY_MINUTES,
  zScoreStddevFloor: env.Z_SCORE_STDDEV_FLOOR,
  defaultThresholdBands: {
    heart_rate: {
      min: env.HEART_RATE_THRESHOLD_MIN,
      max: env.HEART_RATE_THRESHOLD_MAX,
    },
    spo2: { min: env.SPO2_THRESHOLD_MIN },
    temperature: {
      min: env.TEMPERATURE_THRESHOLD_MIN,
      max: env.TEMPERATURE_THRESHOLD_MAX,
    },
  },
} as const;
