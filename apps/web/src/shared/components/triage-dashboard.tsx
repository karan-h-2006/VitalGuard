import { useEffect, useState } from 'react';
import { useAuth } from '../auth/auth-context.js';
import { PatientDetail } from '../../features/patient/patient-detail.js';
import { Clock, Activity, Download, ChevronLeft, Users } from 'lucide-react';
import type { PatientTriageEntry } from '@vitalguard/shared-types';
import {
  Badge,
  Button,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  Skeleton,
  EmptyState,
} from '../../components/ui/index.js';
import type { SeverityLevel } from '../../components/ui/badge.js';
import { useDoctorAvailability } from '../../features/doctor/use-availability.js';
import { AvailabilityControl } from '../../features/doctor/availability-control.js';

export function TriageDashboard({
  title,
  showAvailability,
}: {
  title: string;
  showAvailability?: boolean;
}) {
  const { token } = useAuth();
  const avail = useDoctorAvailability();
  const [patients, setPatients] = useState<PatientTriageEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(
    null,
  );
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (!token) return;

    fetch('/api/patients', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setPatients(data);
        }
      })
      .finally(() => setLoading(false));
  }, [token]);

  const handleDownloadReport = async (patientId: string) => {
    if (!token) return;
    setDownloading(true);
    try {
      const postRes = await fetch(`/api/patients/${patientId}/reports`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!postRes.ok) throw new Error('Failed to generate report');

      const listRes = await fetch(`/api/patients/${patientId}/reports`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const reports = await listRes.json();

      const report = reports[reports.length - 1];
      if (!report?.id) throw new Error('Generated report was not returned');
      const downloadRes = await fetch(
        `/api/patients/${patientId}/reports/${report.id}/download`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (!downloadRes.ok) throw new Error('Failed to download report');
      const url = URL.createObjectURL(await downloadRes.blob());
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `vitalguard-${patientId}-weekly-report.pdf`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert('Error generating report: ' + String(err));
    } finally {
      setDownloading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-96" />
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-6 space-y-4 dark:border-slate-800 dark:bg-slate-900">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      </div>
    );
  }

  if (selectedPatientId) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <Button
            variant="ghost"
            onClick={() => setSelectedPatientId(null)}
            icon={<ChevronLeft className="h-4 w-4" />}
          >
            Back to Triage List
          </Button>

          <Button
            variant="primary"
            loading={downloading}
            rollEffect
            onClick={() => handleDownloadReport(selectedPatientId)}
            icon={<Download className="h-4 w-4" />}
          >
            Generate Weekly Report
          </Button>
        </div>

        <PatientDetail patientId={selectedPatientId} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="bracketed">Clinical Triage</Badge>
            {showAvailability && avail.availability && (
              <Badge
                variant={
                  avail.availability.effectiveStatus === 'available'
                    ? 'teal'
                    : 'default'
                }
                size="sm"
              >
                {avail.availability.effectiveStatus === 'available'
                  ? 'Available'
                  : 'Unavailable'}
              </Badge>
            )}
          </div>
          <h1 className="font-sans text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            {title}
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Prioritized clinical telemetry roster sorted by active severity
            tier.
          </p>
        </div>
      </div>

      {showAvailability && !avail.loading && avail.availability && (
        <AvailabilityControl
          availability={avail.availability}
          saving={avail.saving}
          toast={avail.toast}
          onClearToast={() => avail.setToast(null)}
          onUpdate={avail.update}
        />
      )}

      {patients.length === 0 ? (
        <EmptyState
          icon={<Users className="h-8 w-8" />}
          title="No patients associated with your account"
          description="Assigned patients will appear here once linked by an administrator or after consent confirmation."
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Patient</TableHead>
              <TableHead>Clinical Severity</TableHead>
              <TableHead>Open Alerts</TableHead>
              <TableHead>Last Ingested Reading</TableHead>
              <TableHead className="text-right">Workstation</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {patients.map((p) => {
              const tier = (p.status?.severityTier ?? 'Normal') as string;
              const severityProp = (
                tier.toLowerCase() in
                { normal: 1, watch: 1, warning: 1, critical: 1 }
                  ? tier.toLowerCase()
                  : 'normal'
              ) as SeverityLevel;

              let timeSince = 'Never';
              if (p.lastReadingAt) {
                const diffMs = Date.now() - new Date(p.lastReadingAt).getTime();
                const mins = Math.floor(diffMs / 60000);
                timeSince =
                  mins < 1
                    ? 'Just now'
                    : mins < 60
                      ? `${mins}m ago`
                      : `${Math.floor(mins / 60)}h ${mins % 60}m ago`;
              }

              return (
                <TableRow
                  key={p.patientId}
                  className="cursor-pointer"
                  onClick={() => setSelectedPatientId(p.patientId)}
                >
                  <TableCell className="font-medium">
                    <span className="block text-slate-900 dark:text-slate-100">
                      {p.patientEmail ?? 'Unknown patient'}
                    </span>
                    <span className="block font-mono text-[11px] text-slate-400">
                      {p.patientId.slice(0, 8)}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge severity={severityProp}>{tier}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5 font-mono text-xs">
                      <Activity
                        className={`h-4 w-4 ${p.openAlertCount > 0 ? 'text-rose-500' : 'text-slate-400'}`}
                      />
                      <span
                        className={
                          p.openAlertCount > 0
                            ? 'font-bold text-slate-900 dark:text-slate-100'
                            : 'text-slate-500'
                        }
                      >
                        {p.openAlertCount}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5 font-mono text-xs text-slate-500 dark:text-slate-400">
                      <Clock className="h-3.5 w-3.5 text-slate-400" />
                      {timeSince}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="outline">
                      View Details &rarr;
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
