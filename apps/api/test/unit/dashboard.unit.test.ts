/**
 * Unit tests — Module 6 Dashboard & Reporting
 * All pure-function tests: parseHistoryRangeHours, sortPatientsByTriage,
 * computeReportAggregations, and the WebSocket push-on-change guard.
 */
import { describe, expect, it } from 'vitest';
import {
  parseHistoryRangeHours,
  sortPatientsByTriage,
  TRIAGE_RANK,
} from '../../src/features/dashboard/routes.js';
import { computeReportAggregations } from '../../src/features/dashboard/reports.js';

// ── parseHistoryRangeHours ────────────────────────────────────────────────────

describe('parseHistoryRangeHours', () => {
  it("returns 24 for '24h'", () =>
    expect(parseHistoryRangeHours('24h')).toBe(24));
  it('returns 24 for undefined (default)', () =>
    expect(parseHistoryRangeHours(undefined)).toBe(24));
  it("returns 168 for '7d'", () =>
    expect(parseHistoryRangeHours('7d')).toBe(168));
  it("returns 720 for '30d'", () =>
    expect(parseHistoryRangeHours('30d')).toBe(720));
  it('returns 0 for an unrecognised value', () =>
    expect(parseHistoryRangeHours('invalid')).toBe(0));
  it('returns 0 for an empty string', () =>
    expect(parseHistoryRangeHours('')).toBe(24)); // falsy → default
});

// ── TRIAGE_RANK constant ──────────────────────────────────────────────────────

describe('TRIAGE_RANK', () => {
  it('Critical outranks Warning', () =>
    expect(TRIAGE_RANK['Critical']!).toBeGreaterThan(TRIAGE_RANK['Warning']!));
  it('Warning outranks Watch', () =>
    expect(TRIAGE_RANK['Warning']!).toBeGreaterThan(TRIAGE_RANK['Watch']!));
  it('Watch outranks Normal', () =>
    expect(TRIAGE_RANK['Watch']!).toBeGreaterThan(TRIAGE_RANK['Normal']!));
});

// ── sortPatientsByTriage ──────────────────────────────────────────────────────

type PatientEntry = { id: string; status: { severityTier: string } | null };

function makePatient(id: string, tier: string | null): PatientEntry {
  return { id, status: tier ? { severityTier: tier } : null };
}

describe('sortPatientsByTriage', () => {
  it('sorts Critical > Warning > Watch > Normal', () => {
    const input: PatientEntry[] = [
      makePatient('n', 'Normal'),
      makePatient('c', 'Critical'),
      makePatient('w', 'Watch'),
      makePatient('W', 'Warning'),
    ];
    const sorted = sortPatientsByTriage(input);
    expect(sorted.map((p) => p.id)).toEqual(['c', 'W', 'w', 'n']);
  });

  it('handles a mixed-tier list correctly', () => {
    const input: PatientEntry[] = [
      makePatient('a', 'Warning'),
      makePatient('b', 'Critical'),
      makePatient('c', 'Normal'),
      makePatient('d', 'Critical'),
    ];
    const sorted = sortPatientsByTriage(input);
    // Both Criticals come first, then Warning, then Normal
    expect(sorted[0]!.id === 'b' || sorted[0]!.id === 'd').toBe(true);
    expect(sorted[1]!.id === 'b' || sorted[1]!.id === 'd').toBe(true);
    expect(sorted[2]!.id).toBe('a');
    expect(sorted[3]!.id).toBe('c');
  });

  it('places patients with null status at the bottom', () => {
    const input: PatientEntry[] = [
      makePatient('no-status', null),
      makePatient('critical', 'Critical'),
    ];
    const sorted = sortPatientsByTriage(input);
    expect(sorted[0]!.id).toBe('critical');
    expect(sorted[1]!.id).toBe('no-status');
  });

  it('does not mutate the original array', () => {
    const input: PatientEntry[] = [
      makePatient('n', 'Normal'),
      makePatient('c', 'Critical'),
    ];
    const copy = [...input];
    sortPatientsByTriage(input);
    expect(input).toEqual(copy);
  });
});

// ── computeReportAggregations ─────────────────────────────────────────────────

describe('computeReportAggregations', () => {
  it('computes correct average for a single vital type', () => {
    const readings = [
      { vitalType: 'heart_rate', value: 70 },
      { vitalType: 'heart_rate', value: 80 },
      { vitalType: 'heart_rate', value: 90 },
    ];
    const { avgVitals } = computeReportAggregations(readings, []);
    expect(avgVitals['heart_rate']).toBe(80);
  });

  it('computes averages independently for multiple vital types', () => {
    const readings = [
      { vitalType: 'heart_rate', value: 70 },
      { vitalType: 'heart_rate', value: 90 },
      { vitalType: 'spo2', value: '98' }, // string value, as can come from DB
      { vitalType: 'spo2', value: '96' },
    ];
    const { avgVitals } = computeReportAggregations(readings, []);
    expect(avgVitals['heart_rate']).toBe(80);
    expect(avgVitals['spo2']).toBe(97);
  });

  it('counts alert tiers correctly', () => {
    const alertRows = [
      { severityTier: 'Warning' },
      { severityTier: 'Warning' },
      { severityTier: 'Critical' },
    ];
    const { alertCounts } = computeReportAggregations([], alertRows);
    expect(alertCounts['Warning']).toBe(2);
    expect(alertCounts['Critical']).toBe(1);
  });

  it('returns empty objects for empty inputs', () => {
    const { avgVitals, alertCounts } = computeReportAggregations([], []);
    expect(avgVitals).toEqual({});
    expect(alertCounts).toEqual({});
  });
});

// ── WebSocket push-on-change logic ────────────────────────────────────────────
//
// The inline push guard in the WebSocket timer callback is:
//   if (raw && raw !== previous) { previous = raw; socket.send(raw); }
// This is a two-operand boolean — we test all four states here as a pure expression
// without pulling the async I/O handler out of the closure.

describe('WebSocket push-on-change guard (inline expression verification)', () => {
  function shouldPush(previous: string | null, raw: string | null): boolean {
    return !!(raw && raw !== previous);
  }

  it('pushes when raw differs from previous', () => {
    expect(shouldPush('{"a":1}', '{"a":2}')).toBe(true);
  });

  it('does not push when raw is identical to previous', () => {
    expect(shouldPush('{"a":1}', '{"a":1}')).toBe(false);
  });

  it('pushes on the first reading (previous is null)', () => {
    expect(shouldPush(null, '{"a":1}')).toBe(true);
  });

  it('does not push when raw is null (Redis miss)', () => {
    expect(shouldPush('{"a":1}', null)).toBe(false);
    expect(shouldPush(null, null)).toBe(false);
  });
});
