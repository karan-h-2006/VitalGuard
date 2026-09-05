import type { IsoDateTime } from './iso-date-time.js';

/**
 * Alert severity is Warning or Critical only. Lower-tier vital flags
 * (Normal/Watch) do not open an alert record — but once an alert exists
 * it stays `open` until a human acknowledges or resolves it.
 */
export const ALERT_SEVERITY_TIERS = ['Warning', 'Critical'] as const;

export type AlertSeverityTier = (typeof ALERT_SEVERITY_TIERS)[number];

export const ALERT_STATUSES = [
  'open',
  'acknowledged',
  'escalated',
  'resolved',
] as const;

export type AlertStatus = (typeof ALERT_STATUSES)[number];

export interface Alert {
  id: string;
  patientId: string;
  severityTier: AlertSeverityTier;
  triggeringVitals?: string[];
  explanation: string;
  status: AlertStatus;
  openedAt: IsoDateTime;
  ackDeadline?: IsoDateTime | null;
  acknowledgedAt?: IsoDateTime | null;
  acknowledgedBy?: string | null;
  escalationLevel: number;
  resolvedAt?: IsoDateTime | null;
}
