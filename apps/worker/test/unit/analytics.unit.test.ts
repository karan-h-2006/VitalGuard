/**
 * Unit tests — Module 3 Analytics Engine (gaps not covered by decision-table.test.ts)
 *
 * The existing decision-table.test.ts covers all six severity rows, the z-score
 * zero-stddev edge case, correlation rules, and trend projection (rising + flat).
 * This file fills the remaining gaps.
 */
import { describe, expect, it } from 'vitest';
import {
  isThresholdBreached,
  thresholdBreachText,
  computeDirection,
  evaluateTrend,
} from '../../src/analytics/service.js';
import { analyticsConfig } from '../../src/analytics/config.js';

// ── Threshold breach ──────────────────────────────────────────────────────────

describe('isThresholdBreached — override source', () => {
  it('returns false when value is inside the band', () => {
    expect(
      isThresholdBreached(75, { min: 60, max: 100, source: 'override' }),
    ).toBe(false);
  });

  it('returns true when value is below min', () => {
    expect(
      isThresholdBreached(59, { min: 60, max: 100, source: 'override' }),
    ).toBe(true);
  });

  it('returns true when value is above max', () => {
    expect(
      isThresholdBreached(101, { min: 60, max: 100, source: 'override' }),
    ).toBe(true);
  });
});

describe('isThresholdBreached — default source', () => {
  it('returns false when value is inside the band (source has no effect on logic)', () => {
    expect(isThresholdBreached(97, { min: 95, source: 'default' })).toBe(false);
  });

  it('returns true when value is below min with default source', () => {
    expect(isThresholdBreached(94, { min: 95, source: 'default' })).toBe(true);
  });
});

// ── Threshold breach text ─────────────────────────────────────────────────────

describe('thresholdBreachText', () => {
  it('returns a below-min message when value is under the minimum', () => {
    const text = thresholdBreachText('heart_rate', 55, {
      min: 60,
      max: 100,
      source: 'default',
    });
    expect(text).toBeDefined();
    expect(text).toContain('below');
    expect(text).toContain('60 bpm');
  });

  it('returns an above-max message when value exceeds the maximum', () => {
    const text = thresholdBreachText('temperature', 38.0, {
      min: 36.1,
      max: 37.5,
      source: 'default',
    });
    expect(text).toBeDefined();
    expect(text).toContain('above');
    expect(text).toContain('37.5 C');
  });

  it('returns undefined when value is within the band', () => {
    const text = thresholdBreachText('spo2', 97, {
      min: 95,
      source: 'default',
    });
    expect(text).toBeUndefined();
  });
});

// ── Direction computation ─────────────────────────────────────────────────────

describe('computeDirection', () => {
  const minSamples = analyticsConfig.baselineMinSamples; // 20 from setup-env

  it("returns 'unknown' when sample count is below the minimum", () => {
    expect(computeDirection(75, 70, minSamples - 1)).toBe('unknown');
  });

  it("returns 'rising' when value is above the mean", () => {
    expect(computeDirection(75, 70, minSamples)).toBe('rising');
  });

  it("returns 'falling' when value is below the mean", () => {
    expect(computeDirection(65, 70, minSamples)).toBe('falling');
  });

  it("returns 'stable' when value equals the mean exactly", () => {
    expect(computeDirection(70, 70, minSamples)).toBe('stable');
  });
});

// ── Trend projection — falling case ──────────────────────────────────────────

describe('evaluateTrend — falling sequence', () => {
  it('detects a falling trend heading toward a minimum threshold', () => {
    // 10 values falling from 100 toward min=95 — they are still above 95 but
    // approaching it, so evaluateTrend should project a future crossing.
    const trendSampleCount = analyticsConfig.trendSampleCount; // 10
    const values = Array.from({ length: trendSampleCount }, (_, i) => ({
      timestampSeconds: i * 60,
      // 100.0, 99.5, 99.0 ... 95.5 — all above 95 but clearly falling
      value: 100 - i * 0.5,
    }));

    const result = evaluateTrend(values, { min: 95, source: 'default' });

    expect(result).not.toBeNull();
    expect(result!.direction).toBe('falling');
    expect(result!.minutesToThreshold).toBeGreaterThan(0);
    expect(result!.minutesToThreshold).toBeLessThanOrEqual(
      analyticsConfig.trendLookaheadMinutes,
    );
  });
});

describe('evaluateTrend — insufficient samples', () => {
  it('returns null when fewer than trendSampleCount values are provided', () => {
    const tooFew = Array.from(
      { length: analyticsConfig.trendSampleCount - 1 },
      (_, i) => ({
        timestampSeconds: i * 60,
        value: 90 + i,
      }),
    );

    expect(
      evaluateTrend(tooFew, { min: 60, max: 100, source: 'default' }),
    ).toBeNull();
  });
});

describe('evaluateTrend — trend does not cross threshold within lookahead', () => {
  it('returns null for a gentle rise far from the max threshold', () => {
    const values = Array.from(
      { length: analyticsConfig.trendSampleCount },
      (_, i) => ({
        timestampSeconds: i * 60,
        value: 70 + i * 0.01, // barely rising, max=100 is far away
      }),
    );

    // The crossing would happen far beyond the lookahead window
    expect(
      evaluateTrend(values, { min: 60, max: 100, source: 'default' }),
    ).toBeNull();
  });
});
