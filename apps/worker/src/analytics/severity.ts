import type {
  AnomalyFlag,
  ClassificationContext,
  ClassificationResult,
  VitalAssessment,
} from './types.js';

type SeverityDecision = {
  tier: ClassificationResult['tier'];
  matches: (context: ClassificationContext) => boolean;
  explain: (context: ClassificationContext) => string;
};

function anomalyRank(flag: AnomalyFlag): number {
  switch (flag) {
    case 'anomalous':
      return 2;
    case 'watch-level':
      return 1;
    default:
      return 0;
  }
}

function formatVitalName(vitalType: VitalAssessment['vitalType']): string {
  switch (vitalType) {
    case 'heart_rate':
      return 'Heart rate';
    case 'spo2':
      return 'SpO2';
    case 'temperature':
      return 'Temperature';
  }
}

function findThresholdBreaches(assessments: VitalAssessment[]) {
  return assessments.filter((assessment) => assessment.thresholdBreached);
}

function findAnomalies(
  assessments: VitalAssessment[],
  minimum: Extract<AnomalyFlag, 'watch-level' | 'anomalous'>,
) {
  return assessments.filter(
    (assessment) => anomalyRank(assessment.anomalyFlag) >= anomalyRank(minimum),
  );
}

function firstTrendWarning(assessments: VitalAssessment[]) {
  return assessments.find((assessment) => assessment.trendWarning !== null);
}

const severityDecisionTable: SeverityDecision[] = [
  {
    tier: 'Critical',
    matches: (context) => context.fallDetected,
    explain: () =>
      'Motion indicates a detected fall, which is treated as critical immediately.',
  },
  {
    tier: 'Critical',
    matches: (context) => context.correlationMatch !== null,
    explain: (context) => {
      const match = context.correlationMatch!;
      const names = match.matchedVitals.map(formatVitalName).join(', ');
      return `${names} together match the ${match.label}.`;
    },
  },
  {
    tier: 'Critical',
    matches: (context) =>
      context.assessments.some(
        (assessment) =>
          assessment.thresholdBreached &&
          assessment.anomalyFlag === 'anomalous',
      ),
    explain: (context) => {
      const assessment = context.assessments.find(
        (entry) => entry.thresholdBreached && entry.anomalyFlag === 'anomalous',
      )!;
      return `${formatVitalName(assessment.vitalType)} ${assessment.thresholdBreachText}, and it is also anomalous versus the patient's baseline.`;
    },
  },
  {
    tier: 'Warning',
    matches: (context) =>
      findThresholdBreaches(context.assessments).length > 0 ||
      findAnomalies(context.assessments, 'anomalous').length > 0 ||
      firstTrendWarning(context.assessments) !== undefined,
    explain: (context) => {
      const thresholdBreach = findThresholdBreaches(context.assessments)[0];
      if (thresholdBreach) {
        return `${formatVitalName(thresholdBreach.vitalType)} ${thresholdBreach.thresholdBreachText}.`;
      }

      const anomaly = findAnomalies(context.assessments, 'anomalous')[0];
      if (anomaly) {
        return `${formatVitalName(anomaly.vitalType)} is statistically anomalous relative to the patient's recent baseline.`;
      }

      const trend = firstTrendWarning(context.assessments)!;
      return `${formatVitalName(trend.vitalType)} is trending ${trend.trendWarning!.direction} and is projected to cross a threshold in about ${Math.round(trend.trendWarning!.minutesToThreshold)} minutes.`;
    },
  },
  {
    tier: 'Watch',
    matches: (context) =>
      findAnomalies(context.assessments, 'watch-level').length > 0,
    explain: (context) => {
      const assessment = findAnomalies(context.assessments, 'watch-level')[0];
      if (!assessment) {
        return "One vital is drifting away from the patient's recent baseline and should be watched.";
      }
      return `${formatVitalName(assessment.vitalType)} is drifting away from the patient's recent baseline and should be watched.`;
    },
  },
  {
    tier: 'Normal',
    matches: () => true,
    explain: () =>
      'Current heart rate, SpO2, and temperature are within expected range for this patient.',
  },
];

export function classifySeverity(
  context: ClassificationContext,
): ClassificationResult {
  const match = severityDecisionTable.find((decision) =>
    decision.matches(context),
  );
  if (!match) {
    return {
      tier: 'Normal',
      explanation:
        'Current heart rate, SpO2, and temperature are within expected range for this patient.',
    };
  }

  return {
    tier: match.tier,
    explanation: match.explain(context),
  };
}
