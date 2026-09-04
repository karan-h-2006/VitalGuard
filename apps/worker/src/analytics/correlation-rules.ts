import type { CorrelationRuleDefinition } from './types.js';

export const correlationRules: CorrelationRuleDefinition[] = [
  {
    id: 'correlated-deterioration',
    label: 'correlated deterioration pattern',
    conditions: [
      {
        vitalType: 'heart_rate',
        direction: 'rising',
        minimumAnomalyFlag: 'anomalous',
      },
      {
        vitalType: 'spo2',
        direction: 'falling',
        minimumAnomalyFlag: 'anomalous',
      },
      {
        vitalType: 'temperature',
        direction: 'rising',
        minimumAnomalyFlag: 'anomalous',
      },
    ],
  },
];
