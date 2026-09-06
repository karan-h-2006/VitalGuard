import { useAuth } from '../../shared/auth/auth-context.js';
import { PatientDetail } from './patient-detail.js';

export function PatientPage() {
  const { user } = useAuth();
  
  if (!user) return null;

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">My Dashboard</h1>
        <p className="mt-2 text-sm text-gray-600">
          Real-time vitals and historical trends.
        </p>
      </div>

      <PatientDetail patientId={user.userId} />
    </div>
  );
}
