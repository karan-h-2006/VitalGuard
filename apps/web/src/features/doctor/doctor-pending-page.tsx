import { useEffect, useState } from 'react';
import { useAuth } from '../../shared/auth/auth-context.js';

type Institution = {
  id: string;
  name: string;
  city: string | null;
  type: string;
};
export function DoctorPendingPage() {
  const { token, doctorApplication } = useAuth();
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [institutionId, setInstitutionId] = useState('');
  const [medicalLicenseNo, setMedicalLicenseNo] = useState('');
  const [specialization, setSpecialization] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    void fetch('/api/institutions')
      .then((r) => r.json())
      .then((rows) => {
        if (Array.isArray(rows)) {
          setInstitutions(rows);
          setInstitutionId(rows[0]?.id ?? '');
        }
      })
      .catch(() => setError('Could not load institutions.'));
  }, []);
  async function reapply(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    setMessage('');
    const response = await fetch('/api/doctors/me/reapply', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ institutionId, medicalLicenseNo, specialization }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok)
      setError(data.message ?? 'Could not resubmit application');
    else
      setMessage('Application resubmitted. The administrator will review it.');
  }
  const status = doctorApplication?.status ?? 'pending';
  return (
    <div className="mx-auto max-w-2xl rounded-xl bg-white p-8 shadow-sm">
      <p className="text-sm font-semibold uppercase tracking-wide text-indigo-600">
        Doctor application
      </p>
      <h1 className="mt-2 text-2xl font-semibold capitalize">
        {status} review
      </h1>
      <p className="mt-3 text-slate-600">
        {status === 'pending'
          ? 'Your application is waiting for administrator approval. Patient information and clinical tools stay locked until approval.'
          : status === 'rejected'
            ? 'Your application was rejected.'
            : 'Your doctor account is suspended.'}
      </p>
      {doctorApplication?.rejectionReason && (
        <div className="mt-4 rounded border border-amber-200 bg-amber-50 p-4">
          <strong>Administrator note</strong>
          <p className="mt-1">{doctorApplication.rejectionReason}</p>
        </div>
      )}
      {message && <p className="mt-4 text-green-700">{message}</p>}
      {error && (
        <p role="alert" className="mt-4 text-red-700">
          {error}
        </p>
      )}
      {doctorApplication?.mayReapply && (
        <form className="mt-6 space-y-4" onSubmit={reapply}>
          <h2 className="font-medium">Submit a new application</h2>
          <label className="block text-sm">
            Institution
            <select
              required
              value={institutionId}
              onChange={(e) => setInstitutionId(e.target.value)}
              className="mt-1 w-full rounded border p-2"
            >
              {institutions.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                  {item.city ? ` · ${item.city}` : ''}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            Medical license number
            <input
              required
              maxLength={128}
              value={medicalLicenseNo}
              onChange={(e) => setMedicalLicenseNo(e.target.value)}
              className="mt-1 w-full rounded border p-2"
            />
          </label>
          <label className="block text-sm">
            Specialization
            <input
              required
              maxLength={255}
              value={specialization}
              onChange={(e) => setSpecialization(e.target.value)}
              className="mt-1 w-full rounded border p-2"
            />
          </label>
          <button className="rounded bg-indigo-600 px-4 py-2 font-medium text-white">
            Resubmit application
          </button>
        </form>
      )}
    </div>
  );
}
