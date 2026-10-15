import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Users } from 'lucide-react';
import { useAuth } from '../../shared/auth/auth-context.js';
import { PatientDetail } from './patient-detail.js';
import { Badge, Alert, Button } from '../../components/ui/index.js';

export function PatientPage() {
  const { user, token } = useAuth();
  const [unassigned, setUnassigned] = useState(false);

  useEffect(() => {
    if (token) {
      void fetch('/api/patients/me/profile', {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((profile) =>
          setUnassigned(profile?.assignmentStatus === 'unassigned'),
        )
        .catch(() => undefined);
    }
  }, [token]);

  if (!user) return null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <Badge variant="bracketed" className="mb-1">
            Patient Portal
          </Badge>
          <h1 className="font-sans text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            My Vitals Workstation
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Continuous biometric telemetry and physiological history.
          </p>
        </div>

        <Link to="/patient/access">
          <Button
            variant="outline"
            size="sm"
            icon={<Users className="h-3.5 w-3.5" />}
          >
            Who can see my data?
          </Button>
        </Link>
      </div>

      {unassigned && (
        <Alert variant="warning" title="Awaiting Physician Assignment">
          Your account is active. An administrator will review your profile and
          assign an approved doctor to oversee your clinical telemetry.
        </Alert>
      )}

      <PatientDetail patientId={user.userId} />
    </div>
  );
}
