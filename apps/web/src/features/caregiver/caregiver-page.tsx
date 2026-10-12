import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../shared/auth/auth-context.js';
import { TriageDashboard } from '../../shared/components/triage-dashboard.js';

type LinkRequest = {
  id: string;
  status: string;
  patientConsent: string;
  createdAt: string;
};
export function CaregiverPage() {
  const { token } = useAuth();
  const [patients, setPatients] = useState<unknown[]>([]);
  const [requests, setRequests] = useState<LinkRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [patientEmail, setPatientEmail] = useState('');
  const [relationshipNote, setRelationshipNote] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const refresh = useCallback(async () => {
    if (!token) return;
    const headers = { Authorization: `Bearer ${token}` };
    const [p, r] = await Promise.all([
      fetch('/api/patients', { headers }),
      fetch('/api/caregiver/link-requests', { headers }),
    ]);
    if (p.ok) setPatients(await p.json());
    if (r.ok) setRequests(await r.json());
    setLoading(false);
  }, [token]);
  useEffect(() => {
    void refresh().catch(() => {
      setError('Could not load your linked patients.');
      setLoading(false);
    });
  }, [refresh]);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    setMessage('');
    const response = await fetch('/api/caregiver/link-requests', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ patientEmail, relationshipNote }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) setError(data.message ?? 'Could not submit request');
    else {
      setMessage('Request submitted for administrator review.');
      setPatientEmail('');
      setRelationshipNote('');
      await refresh();
    }
  }
  if (loading)
    return <p className="text-slate-600">Loading caregiver dashboard…</p>;
  if (patients.length > 0)
    return <TriageDashboard title="Caregiver Dashboard" />;
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-3xl font-semibold">Caregiver dashboard</h1>
      <section className="mt-6 rounded-xl border bg-white p-6">
        <h2 className="text-xl font-medium">No linked patients</h2>
        <p className="mt-2 text-sm text-slate-600">
          Request access using the patient’s registered email. Patient
          information stays private until an administrator reviews the request.
        </p>
        {error && (
          <p role="alert" className="mt-3 text-red-700">
            {error}
          </p>
        )}
        {message && <p className="mt-3 text-green-700">{message}</p>}
        <form onSubmit={submit} className="mt-5 space-y-3">
          <label className="block text-sm">
            Patient email
            <input
              required
              type="email"
              value={patientEmail}
              onChange={(e) => setPatientEmail(e.target.value)}
              className="mt-1 w-full rounded border p-2"
            />
          </label>
          <label className="block text-sm">
            Relationship note (optional)
            <textarea
              maxLength={500}
              value={relationshipNote}
              onChange={(e) => setRelationshipNote(e.target.value)}
              className="mt-1 w-full rounded border p-2"
            />
          </label>
          <button className="rounded bg-indigo-600 px-4 py-2 font-medium text-white">
            Request link
          </button>
        </form>
      </section>
      <section className="mt-6 rounded-xl border bg-white p-6">
        <h2 className="text-lg font-medium">Request status</h2>
        {requests.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">No requests yet.</p>
        ) : (
          <ul className="mt-3 divide-y">
            {requests.map((item) => (
              <li className="py-3 text-sm" key={item.id}>
                <span className="font-medium capitalize">
                  {item.status.replaceAll('_', ' ')}
                </span>
                {item.status === 'approved' && (
                  <span className="ml-2 text-slate-600">
                    · patient consent {item.patientConsent}
                  </span>
                )}
                <span className="block text-xs text-slate-500">
                  {new Date(item.createdAt).toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
