import { useAuth } from '../../shared/auth/auth-context.js';
import { PatientDetail } from './patient-detail.js';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

export function PatientPage() {
  const { user } = useAuth();
  const { token } = useAuth();
  const [unassigned, setUnassigned] = useState(false);
  useEffect(() => {
    if (token)
      void fetch('/api/patients/me/profile', {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((profile) =>
          setUnassigned(profile?.assignmentStatus === 'unassigned'),
        )
        .catch(() => undefined);
  }, [token]);

  if (!user) return null;

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">My Dashboard</h1>
        <p className="mt-2 text-sm text-gray-600">
          Real-time vitals and historical trends.
        </p>
      </div>
      {unassigned && (
        <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-900">
          <strong>Awaiting doctor assignment</strong>
          <p className="mt-1 text-sm">
            Your account is active. An administrator will assign an approved
            doctor to your care.
          </p>
        </div>
      )}
      <p className="mb-4">
        <Link
          to="/patient/access"
          className="text-sm font-medium text-indigo-700 hover:underline"
        >
          Who can see my data?
        </Link>
      </p>

      <PatientDetail patientId={user.userId} />
    </div>
  );
}
