import type { VitalSeverityTier } from '@vitalguard/shared-types';

export const ANALYTIC_VITAL_TYPES = [
  'heart_rate',
  'spo2',
  'temperature',
] as const;

export type AnalyticVitalType = (typeof ANALYTIC_VITAL_TYPES)[number];

export type ThresholdBand = {
  min?: number;
  max?: number;
  source: 'default' | 'override';
};

export type BaselineSnapshot = {
  mean: number;
  stddev: number;
  sampleCount: number;
  windowSize: string;
  sufficientData: boolean;
};

export type AnomalyFlag =
  'normal' | 'watch-level' | 'anomalous' | 'insufficient-data';

export type TrendWarning = {
  threshold: number;
  direction: 'rising' | 'falling';
  minutesToThreshold: number;
};

export type VitalAssessment = {
  vitalType: AnalyticVitalType;
  value: number;
  threshold: ThresholdBand;
  thresholdBreached: boolean;
  thresholdBreachText?: string;
  baseline: BaselineSnapshot;
  anomalyFlag: AnomalyFlag;
  zScore: number | null;
  direction: 'rising' | 'falling' | 'stable' | 'unknown';
  trendWarning: TrendWarning | null;
};

export type RecentVitalState = {
  vitalType: AnalyticVitalType;
  anomalyFlag: AnomalyFlag;
  direction: 'rising' | 'falling' | 'stable' | 'unknown';
  timestamp: string;
  value: number;
};

export type CorrelationRuleCondition = {
  vitalType: AnalyticVitalType;
  direction: 'rising' | 'falling';
  minimumAnomalyFlag: Extract<AnomalyFlag, 'watch-level' | 'anomalous'>;
};

export type CorrelationRuleDefinition = {
  id: string;
  label: string;
  conditions: CorrelationRuleCondition[];
};

export type CorrelationMatch = {
  ruleId: string;
  label: string;
  matchedVitals: AnalyticVitalType[];
} | null;

export type ClassificationContext = {
  fallDetected: boolean;
  assessments: VitalAssessment[];
  correlationMatch: CorrelationMatch;
};

export type ClassificationResult = {
  tier: VitalSeverityTier;
  explanation: string;
};
