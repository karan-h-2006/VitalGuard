export interface PatientTriageEntry {
  patientId: string;
  patientEmail: string | null;
  source: 'redis' | 'database' | 'none';
  status: {
    severityTier: string | null;
    timestamp?: string;
    [key: string]: unknown;
  } | null;
  openAlertCount: number;
  lastReadingAt: string | null;
}
