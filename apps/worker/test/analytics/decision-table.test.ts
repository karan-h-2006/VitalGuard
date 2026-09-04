import { describe, expect, it } from 'vitest';
import { classifySeverity } from '../../src/analytics/severity.js';
import {
  analyticsInternals,
  computeMean,
  computePopulationStddev,
} from '../../src/analytics/service.js';
import type {
  ClassificationContext,
  CorrelationMatch,
  VitalAssessment,
} from '../../src/analytics/types.js';

function makeAssessment(
  overrides: Partial<VitalAssessment> & Pick<VitalAssessment, 'vitalType'>,
): VitalAssessment {
  return {
    vitalType: overrides.vitalType,
    value: 70,
    threshold: { min: 60, max: 100, source: 'default' },
    thresholdBreached: false,
    baseline: {
      mean: 70,
      stddev: 1,
      sampleCount: 20,
      windowSize: '7d',
      sufficientData: true,
    },
    anomalyFlag: 'normal',
    zScore: 0,
    direction: 'stable',
    trendWarning: null,
    ...overrides,
  };
}

function makeContext(
  overrides: Partial<ClassificationContext> = {},
): ClassificationContext {
  return {
    fallDetected: false,
    assessments: [
      makeAssessment({ vitalType: 'heart_rate' }),
      makeAssessment({
        vitalType: 'spo2',
        value: 98,
        threshold: { min: 95, source: 'default' },
      }),
      makeAssessment({
        vitalType: 'temperature',
        value: 36.8,
        threshold: { min: 36.1, max: 37.5, source: 'default' },
      }),
    ],
    correlationMatch: null,
    ...overrides,
  };
}

describe('analytics decision table', () => {
  it('marks a detected fall as Critical above all else', () => {
    const result = classifySeverity(
      makeContext({
        fallDetected: true,
        correlationMatch: {
          ruleId: 'rule',
          label: 'correlated deterioration pattern',
          matchedVitals: ['heart_rate', 'spo2', 'temperature'],
        },
      }),
    );

    expect(result.tier).toBe('Critical');
    expect(result.explanation).toContain('detected fall');
  });

  it('marks a correlation-rule match as Critical', () => {
    const correlationMatch: CorrelationMatch = {
      ruleId: 'rule',
      label: 'correlated deterioration pattern',
      matchedVitals: ['heart_rate', 'spo2', 'temperature'],
    };

    const result = classifySeverity(makeContext({ correlationMatch }));
    expect(result.tier).toBe('Critical');
    expect(result.explanation).toContain('correlated deterioration pattern');
  });

  it('marks a threshold breach plus anomalous z-score as Critical', () => {
    const result = classifySeverity(
      makeContext({
        assessments: [
          makeAssessment({
            vitalType: 'spo2',
            value: 91,
            threshold: { min: 95, source: 'default' },
            thresholdBreached: true,
            thresholdBreachText: 'at 91% is below the 95% threshold',
            anomalyFlag: 'anomalous',
          }),
        ],
      }),
    );

    expect(result.tier).toBe('Critical');
    expect(result.explanation).toContain('below the 95% threshold');
  });

  it('marks threshold-only, anomaly-only, and trend-only cases as Warning', () => {
    const thresholdWarning = classifySeverity(
      makeContext({
        assessments: [
          makeAssessment({
            vitalType: 'temperature',
            value: 37.8,
            threshold: { min: 36.1, max: 37.5, source: 'default' },
            thresholdBreached: true,
            thresholdBreachText: 'at 37.8 C is above the 37.5 C threshold',
            anomalyFlag: 'normal',
          }),
        ],
      }),
    );
    expect(thresholdWarning.tier).toBe('Warning');

    const anomalyWarning = classifySeverity(
      makeContext({
        assessments: [
          makeAssessment({
            vitalType: 'heart_rate',
            anomalyFlag: 'anomalous',
          }),
        ],
      }),
    );
    expect(anomalyWarning.tier).toBe('Warning');

    const trendWarning = classifySeverity(
      makeContext({
        assessments: [
          makeAssessment({
            vitalType: 'heart_rate',
            trendWarning: {
              threshold: 100,
              direction: 'rising',
              minutesToThreshold: 12,
            },
          }),
        ],
      }),
    );
    expect(trendWarning.tier).toBe('Warning');
  });

  it('marks watch-level anomalies as Watch', () => {
    const result = classifySeverity(
      makeContext({
        assessments: [
          makeAssessment({
            vitalType: 'heart_rate',
            anomalyFlag: 'watch-level',
          }),
        ],
      }),
    );

    expect(result.tier).toBe('Watch');
  });

  it('marks otherwise stable readings as Normal', () => {
    const result = classifySeverity(makeContext());
    expect(result.tier).toBe('Normal');
  });
});

describe('analytics helpers', () => {
  it('evaluates threshold boundaries for each vital type', () => {
    expect(
      analyticsInternals.isThresholdBreached(59, {
        min: 60,
        max: 100,
        source: 'default',
      }),
    ).toBe(true);
    expect(
      analyticsInternals.isThresholdBreached(97, {
        min: 95,
        source: 'default',
      }),
    ).toBe(false);
    expect(
      analyticsInternals.isThresholdBreached(37.6, {
        min: 36.1,
        max: 37.5,
        source: 'default',
      }),
    ).toBe(true);
  });

  it('computes mean and population stddev correctly', () => {
    const values = [70, 71, 69, 72];
    const mean = computeMean(values);
    const stddev = computePopulationStddev(values, mean);

    expect(mean).toBeCloseTo(70.5, 6);
    expect(stddev).toBeCloseTo(1.1180339887, 6);
  });

  it('handles the zero-stddev z-score edge case with a floor', () => {
    const result = analyticsInternals.computeAnomalyFlag(71, {
      mean: 70,
      stddev: 0,
      sampleCount: 20,
      windowSize: '7d',
      sufficientData: true,
    });

    expect(result.anomalyFlag).toBe('anomalous');
    expect(result.zScore).toBeGreaterThan(50);
  });

  it('returns insufficient-data until the baseline is warm', () => {
    const result = analyticsInternals.computeAnomalyFlag(75, {
      mean: 70,
      stddev: 1,
      sampleCount: 4,
      windowSize: '7d',
      sufficientData: false,
    });

    expect(result.anomalyFlag).toBe('insufficient-data');
    expect(result.zScore).toBeNull();
  });

  it('fires and suppresses correlation rules correctly', () => {
    const hit = analyticsInternals.evaluateCorrelation(
      'patient-1',
      {
        heart_rate: {
          vitalType: 'heart_rate',
          anomalyFlag: 'anomalous',
          direction: 'rising',
          timestamp: '2024-01-01T00:00:00.000Z',
          value: 110,
        },
        spo2: {
          vitalType: 'spo2',
          anomalyFlag: 'anomalous',
          direction: 'falling',
          timestamp: '2024-01-01T00:00:00.000Z',
          value: 90,
        },
        temperature: {
          vitalType: 'temperature',
          anomalyFlag: 'anomalous',
          direction: 'rising',
          timestamp: '2024-01-01T00:00:00.000Z',
          value: 38.4,
        },
      },
      new Date('2024-01-01T00:05:00.000Z'),
    );
    expect(hit?.label).toBe('correlated deterioration pattern');

    const miss = analyticsInternals.evaluateCorrelation(
      'patient-1',
      {
        heart_rate: {
          vitalType: 'heart_rate',
          anomalyFlag: 'anomalous',
          direction: 'rising',
          timestamp: '2024-01-01T00:00:00.000Z',
          value: 110,
        },
      },
      new Date('2024-01-01T00:05:00.000Z'),
    );
    expect(miss).toBeNull();
  });

  it('projects a rising trend and ignores flat data', () => {
    const rising = analyticsInternals.evaluateTrend(
      Array.from({ length: 10 }, (_, index) => ({
        timestampSeconds: index * 60,
        value: 90 + index,
      })),
      { min: 60, max: 100, source: 'default' },
    );
    expect(rising?.direction).toBe('rising');
    expect(rising?.minutesToThreshold).toBeLessThanOrEqual(30);

    const flat = analyticsInternals.evaluateTrend(
      Array.from({ length: 10 }, (_, index) => ({
        timestampSeconds: index * 60,
        value: 98,
      })),
      { min: 95, source: 'default' },
    );
    expect(flat).toBeNull();
  });
});
