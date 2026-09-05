import { and, eq, gte, lt } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import type { VitalSample, VitalSeverityTier } from '@vitalguard/shared-types';
import { baselines, devices, thresholds, vitalReadings } from '../schema.js';
import { onSeverityTransition } from '../alerting/service.js';
import { analyticsConfig } from './config.js';
import { correlationRules } from './correlation-rules.js';
import { classifySeverity } from './severity.js';
import type { redis as sharedRedisClient } from '../redis.js';
import type {
  AnalyticVitalType,
  AnomalyFlag,
  BaselineSnapshot,
  CorrelationMatch,
  RecentVitalState,
  ThresholdBand,
  TrendWarning,
  VitalAssessment,
} from './types.js';

type AnalyticsResult = {
  patientId: string;
  tier: VitalSeverityTier;
  explanation: string;
  assessments: VitalAssessment[];
};

type RedisClient = typeof sharedRedisClient;

const ONE_DAY_SECONDS = 24 * 60 * 60;

function getWindowSizeLabel(): string {
  return `${analyticsConfig.baselineWindowDays}d`;
}

function baselineWindowKey(
  patientId: string,
  vitalType: AnalyticVitalType,
): string {
  return `baseline:window:${patientId}:${vitalType}`;
}

function recentStateKey(patientId: string): string {
  return `patient:${patientId}:recent-readings`;
}

function statusKey(patientId: string): string {
  return `patient:${patientId}:status`;
}

function asNumber(value: string | number | null | undefined): number {
  return Number(value);
}

function formatValue(vitalType: AnalyticVitalType, value: number): string {
  switch (vitalType) {
    case 'heart_rate':
      return `${value} bpm`;
    case 'spo2':
      return `${value}%`;
    case 'temperature':
      return `${value} C`;
  }
}

export function thresholdBreachText(
  vitalType: AnalyticVitalType,
  value: number,
  threshold: ThresholdBand,
): string | undefined {
  if (threshold.min !== undefined && value < threshold.min) {
    return `at ${formatValue(vitalType, value)} is below the ${formatValue(vitalType, threshold.min)} threshold`;
  }

  if (threshold.max !== undefined && value > threshold.max) {
    return `at ${formatValue(vitalType, value)} is above the ${formatValue(vitalType, threshold.max)} threshold`;
  }

  return undefined;
}

export function computeMean(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function computePopulationStddev(
  values: number[],
  mean: number,
): number {
  const variance =
    values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

export function computeDirection(
  value: number,
  mean: number,
  sampleCount: number,
) {
  if (sampleCount < analyticsConfig.baselineMinSamples) {
    return 'unknown' as const;
  }

  if (value > mean) {
    return 'rising' as const;
  }

  if (value < mean) {
    return 'falling' as const;
  }

  return 'stable' as const;
}

export function computeAnomalyFlag(
  value: number,
  baseline: BaselineSnapshot,
): { anomalyFlag: AnomalyFlag; zScore: number | null } {
  if (!baseline.sufficientData) {
    return { anomalyFlag: 'insufficient-data', zScore: null };
  }

  // A patient with near-perfectly constant readings produces stddev ~ 0.
  // Flooring it avoids division-by-zero while still flagging meaningful drift.
  const stddev = Math.max(baseline.stddev, analyticsConfig.zScoreStddevFloor);
  const zScore = (value - baseline.mean) / stddev;
  const absZ = Math.abs(zScore);

  if (absZ >= analyticsConfig.anomalyModerateZThreshold) {
    return { anomalyFlag: 'anomalous', zScore };
  }

  if (absZ >= analyticsConfig.anomalyMildZThreshold) {
    return { anomalyFlag: 'watch-level', zScore };
  }

  return { anomalyFlag: 'normal', zScore };
}

export function evaluateTrend(
  values: Array<{ timestampSeconds: number; value: number }>,
  threshold: ThresholdBand,
): TrendWarning | null {
  if (values.length < analyticsConfig.trendSampleCount) {
    return null;
  }

  const sorted = [...values].sort(
    (a, b) => a.timestampSeconds - b.timestampSeconds,
  );
  const x0 = sorted[0]!.timestampSeconds;
  const points = sorted.map((entry) => ({
    x: (entry.timestampSeconds - x0) / 60,
    y: entry.value,
  }));

  const meanX = computeMean(points.map((point) => point.x));
  const meanY = computeMean(points.map((point) => point.y));
  const numerator = points.reduce(
    (sum, point) => sum + (point.x - meanX) * (point.y - meanY),
    0,
  );
  const denominator = points.reduce(
    (sum, point) => sum + (point.x - meanX) ** 2,
    0,
  );

  if (denominator === 0) {
    return null;
  }

  const slope = numerator / denominator;
  if (slope === 0) {
    return null;
  }

  const intercept = meanY - slope * meanX;
  const lastX = points.at(-1)!.x;
  const lookaheadX = lastX + analyticsConfig.trendLookaheadMinutes;

  if (threshold.max !== undefined && slope > 0) {
    const crossingX = (threshold.max - intercept) / slope;
    if (crossingX >= lastX && crossingX <= lookaheadX) {
      return {
        threshold: threshold.max,
        direction: 'rising',
        minutesToThreshold: crossingX - lastX,
      };
    }
  }

  if (threshold.min !== undefined && slope < 0) {
    const crossingX = (threshold.min - intercept) / slope;
    if (crossingX >= lastX && crossingX <= lookaheadX) {
      return {
        threshold: threshold.min,
        direction: 'falling',
        minutesToThreshold: crossingX - lastX,
      };
    }
  }

  return null;
}

export function isThresholdBreached(
  value: number,
  threshold: ThresholdBand,
): boolean {
  return (
    (threshold.min !== undefined && value < threshold.min) ||
    (threshold.max !== undefined && value > threshold.max)
  );
}

async function resolvePatientId(
  database: PostgresJsDatabase,
  sample: VitalSample,
): Promise<string> {
  const [device] = await database
    .select({ patientId: devices.patientId })
    .from(devices)
    .where(eq(devices.id, sample.device_id))
    .limit(1);

  return device?.patientId ?? sample.patient_id;
}

async function resolveThreshold(
  database: PostgresJsDatabase,
  patientId: string,
  vitalType: AnalyticVitalType,
): Promise<ThresholdBand> {
  const [row] = await database
    .select({
      minimum: thresholds.minimum,
      maximum: thresholds.maximum,
    })
    .from(thresholds)
    .where(
      and(
        eq(thresholds.patientId, patientId),
        eq(thresholds.vitalType, vitalType),
      ),
    )
    .limit(1);

  if (!row) {
    const defaults = analyticsConfig.defaultThresholdBands[vitalType];
    return {
      min: defaults.min,
      max: 'max' in defaults ? defaults.max : undefined,
      source: 'default',
    };
  }

  return {
    min: row.minimum === null ? undefined : asNumber(row.minimum),
    max: row.maximum === null ? undefined : asNumber(row.maximum),
    source: 'override',
  };
}

type BaselineWindowEntry = { timestampSeconds: number; value: number };

function buildBaselineSnapshot(
  entries: BaselineWindowEntry[],
): BaselineSnapshot {
  const values = entries.map((entry) => entry.value);
  const mean = values.length > 0 ? computeMean(values) : 0;
  const stddev = values.length > 0 ? computePopulationStddev(values, mean) : 0;
  const sampleCount = values.length;

  return {
    mean,
    stddev,
    sampleCount,
    windowSize: getWindowSizeLabel(),
    sufficientData: sampleCount >= analyticsConfig.baselineMinSamples,
  };
}

function parseBaselineWindowEntries(
  members: Array<{ value: string; score: number }>,
): BaselineWindowEntry[] {
  return members.map((member) => {
    const payload = JSON.parse(member.value) as { ts: number; value: number };
    return {
      timestampSeconds: payload.ts,
      value: payload.value,
    };
  });
}

async function loadHistoricalBaselineEntries(
  redis: RedisClient,
  database: PostgresJsDatabase,
  patientId: string,
  vitalType: AnalyticVitalType,
  timestamp: Date,
): Promise<BaselineWindowEntry[]> {
  const key = baselineWindowKey(patientId, vitalType);
  const cachedEntries = parseBaselineWindowEntries(
    await redis.zRangeWithScores(key, 0, -1),
  );
  if (cachedEntries.length > 0) {
    return cachedEntries;
  }

  // Redis holds working state, not the only baseline copy. Rebuild an empty
  // cache from durable classified readings after a Redis restart/eviction.
  const windowStart = new Date(
    timestamp.getTime() -
      analyticsConfig.baselineWindowDays * ONE_DAY_SECONDS * 1000,
  );
  const rows = await database
    .select({ timestamp: vitalReadings.timestamp, value: vitalReadings.value })
    .from(vitalReadings)
    .where(
      and(
        eq(vitalReadings.patientId, patientId),
        eq(vitalReadings.vitalType, vitalType),
        gte(vitalReadings.timestamp, windowStart),
        // The current sample is stored before analytics; never let it dilute
        // its own historical baseline during cache recovery.
        lt(vitalReadings.timestamp, timestamp),
      ),
    );
  const recoveredEntries = rows.map((row) => ({
    timestampSeconds: Math.floor(row.timestamp.getTime() / 1000),
    value: asNumber(row.value),
  }));

  if (recoveredEntries.length > 0) {
    await redis.zAdd(
      key,
      recoveredEntries.map((entry) => ({
        score: entry.timestampSeconds,
        value: JSON.stringify({
          ts: entry.timestampSeconds,
          value: entry.value,
        }),
      })),
    );
  }

  return recoveredEntries;
}

async function updateBaselineWindow(
  redis: RedisClient,
  database: PostgresJsDatabase,
  patientId: string,
  vitalType: AnalyticVitalType,
  value: number,
  timestamp: Date,
): Promise<{
  baseline: BaselineSnapshot;
  trendSeries: Array<{ timestampSeconds: number; value: number }>;
}> {
  const key = baselineWindowKey(patientId, vitalType);
  const timestampSeconds = Math.floor(timestamp.getTime() / 1000);
  const oldestAllowed =
    timestampSeconds - analyticsConfig.baselineWindowDays * ONE_DAY_SECONDS;
  const historicalEntries = await loadHistoricalBaselineEntries(
    redis,
    database,
    patientId,
    vitalType,
    timestamp,
  );
  // Classify the new measurement against its prior history. Including it in
  // its own baseline would pull the mean toward an outlier and hide drift.
  const baseline = buildBaselineSnapshot(historicalEntries);
  const trendSeries = [...historicalEntries, { timestampSeconds, value }]
    .sort((left, right) => left.timestampSeconds - right.timestampSeconds)
    .slice(-analyticsConfig.trendSampleCount);
  const member = JSON.stringify({
    ts: timestampSeconds,
    value,
  });

  await redis.zAdd(key, [{ score: timestampSeconds, value: member }]);
  await redis.zRemRangeByScore(key, 0, oldestAllowed - 1);

  const persistedBaseline = buildBaselineSnapshot(
    parseBaselineWindowEntries(await redis.zRangeWithScores(key, 0, -1)),
  );

  await database
    .insert(baselines)
    .values({
      patientId,
      vitalType,
      mean: persistedBaseline.mean.toFixed(4),
      stddev: persistedBaseline.stddev.toFixed(4),
      windowSize: persistedBaseline.windowSize,
      sampleCount: persistedBaseline.sampleCount,
      updatedAt: timestamp,
    })
    .onConflictDoUpdate({
      target: [baselines.patientId, baselines.vitalType],
      set: {
        mean: persistedBaseline.mean.toFixed(4),
        stddev: persistedBaseline.stddev.toFixed(4),
        windowSize: persistedBaseline.windowSize,
        sampleCount: persistedBaseline.sampleCount,
        updatedAt: timestamp,
      },
    });

  return {
    baseline,
    trendSeries,
  };
}

async function loadRecentStates(
  redis: RedisClient,
  patientId: string,
): Promise<Record<string, RecentVitalState>> {
  const raw = await redis.get(recentStateKey(patientId));
  if (!raw) {
    return {};
  }

  return JSON.parse(raw) as Record<string, RecentVitalState>;
}

async function storeRecentStates(
  redis: RedisClient,
  patientId: string,
  updates: VitalAssessment[],
  timestamp: Date,
): Promise<Record<string, RecentVitalState>> {
  const states = await loadRecentStates(redis, patientId);
  const timestampIso = timestamp.toISOString();

  for (const assessment of updates) {
    states[assessment.vitalType] = {
      vitalType: assessment.vitalType,
      anomalyFlag: assessment.anomalyFlag,
      direction: assessment.direction,
      timestamp: timestampIso,
      value: assessment.value,
    };
  }

  await redis.set(recentStateKey(patientId), JSON.stringify(states));
  return states;
}

export function anomalySatisfied(
  actual: RecentVitalState['anomalyFlag'],
  minimum: 'watch-level' | 'anomalous',
) {
  const rank = actual === 'anomalous' ? 2 : actual === 'watch-level' ? 1 : 0;
  const minimumRank = minimum === 'anomalous' ? 2 : 1;
  return rank >= minimumRank;
}

export function evaluateCorrelation(
  patientId: string,
  states: Record<string, RecentVitalState>,
  timestamp: Date,
): CorrelationMatch {
  const currentTimestamp = timestamp.getTime();
  const allowedSkewMs =
    analyticsConfig.correlationConcurrencyMinutes * 60 * 1000;

  for (const rule of correlationRules) {
    const matched = rule.conditions.every((condition) => {
      const state = states[condition.vitalType];
      if (!state) {
        return false;
      }

      const age = Math.abs(
        currentTimestamp - new Date(state.timestamp).getTime(),
      );
      return (
        age <= allowedSkewMs &&
        state.direction === condition.direction &&
        anomalySatisfied(state.anomalyFlag, condition.minimumAnomalyFlag)
      );
    });

    if (matched) {
      return {
        ruleId: `${patientId}:${rule.id}`,
        label: rule.label,
        matchedVitals: rule.conditions.map((condition) => condition.vitalType),
      };
    }
  }

  return null;
}

export const analyticsInternals = {
  computeMean,
  computePopulationStddev,
  computeDirection,
  computeAnomalyFlag,
  evaluateTrend,
  isThresholdBreached,
  thresholdBreachText,
  anomalySatisfied,
  evaluateCorrelation,
  buildBaselineSnapshot,
};

async function updatePatientStatusCache(
  redis: RedisClient,
  database: PostgresJsDatabase,
  patientId: string,
  sample: VitalSample,
  assessments: VitalAssessment[],
  tier: VitalSeverityTier,
  explanation: string,
): Promise<void> {
  const previousRaw = await redis.get(statusKey(patientId));
  const previous = previousRaw
    ? (JSON.parse(previousRaw) as { severityTier?: VitalSeverityTier })
    : null;
  const latestVitals = Object.fromEntries(
    assessments.map((assessment) => [
      assessment.vitalType,
      {
        value: assessment.value,
        anomalyFlag: assessment.anomalyFlag,
        zScore: assessment.zScore,
      },
    ]),
  );
  const triggeringVitals: string[] = assessments
    .filter(
      (assessment) =>
        assessment.thresholdBreached ||
        assessment.anomalyFlag === 'anomalous' ||
        assessment.trendWarning !== null,
    )
    .map((assessment) => assessment.vitalType);
  if (sample.motion.fall_detected) {
    triggeringVitals.push('motion');
  }

  await onSeverityTransition(
    database,
    patientId,
    previous?.severityTier ?? null,
    tier,
    explanation,
    triggeringVitals,
  );

  await redis.set(
    statusKey(patientId),
    JSON.stringify({
      patientId,
      deviceId: sample.device_id,
      timestamp: sample.timestamp,
      severityTier: tier,
      previousSeverityTier: previous?.severityTier ?? null,
      explanation,
      fallDetected: sample.motion.fall_detected,
      latestVitals,
    }),
  );
}

export async function analyzeAndPersistSample(
  sample: VitalSample,
  database: PostgresJsDatabase,
  redis: RedisClient,
): Promise<AnalyticsResult> {
  const patientId = await resolvePatientId(database, sample);
  const timestamp = new Date(sample.timestamp);

  const valuesByVital: Record<AnalyticVitalType, number> = {
    heart_rate: sample.heart_rate.value,
    spo2: sample.spo2.value,
    temperature: sample.temperature.value,
  };

  const assessments: VitalAssessment[] = [];

  for (const vitalType of Object.keys(valuesByVital) as AnalyticVitalType[]) {
    const value = valuesByVital[vitalType];
    const threshold = await resolveThreshold(database, patientId, vitalType);
    const { baseline, trendSeries } = await updateBaselineWindow(
      redis,
      database,
      patientId,
      vitalType,
      value,
      timestamp,
    );
    const { anomalyFlag, zScore } = computeAnomalyFlag(value, baseline);
    const assessment: VitalAssessment = {
      vitalType,
      value,
      threshold,
      thresholdBreached: isThresholdBreached(value, threshold),
      thresholdBreachText: thresholdBreachText(vitalType, value, threshold),
      baseline,
      anomalyFlag,
      zScore,
      direction: computeDirection(value, baseline.mean, baseline.sampleCount),
      trendWarning: evaluateTrend(trendSeries, threshold),
    };
    assessments.push(assessment);
  }

  const states = await storeRecentStates(
    redis,
    patientId,
    assessments,
    timestamp,
  );
  const correlationMatch = evaluateCorrelation(patientId, states, timestamp);
  const classification = classifySeverity({
    fallDetected: sample.motion.fall_detected,
    assessments,
    correlationMatch,
  });

  // Write Redis before marking the durable rows classified. If the cache
  // update fails, a redelivery still sees NULL severity and retries the
  // idempotent analytics work instead of permanently leaving stale status.
  await updatePatientStatusCache(
    redis,
    database,
    patientId,
    sample,
    assessments,
    classification.tier,
    classification.explanation,
  );

  await database
    .update(vitalReadings)
    .set({
      patientId,
      severityTier: classification.tier,
    })
    .where(
      and(
        eq(vitalReadings.deviceId, sample.device_id),
        eq(vitalReadings.timestamp, timestamp),
      ),
    );

  return {
    patientId,
    tier: classification.tier,
    explanation: classification.explanation,
    assessments,
  };
}
