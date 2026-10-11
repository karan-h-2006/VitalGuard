import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../shared/auth/auth-context.js';

type Access = { caregiverId: string; email: string };
type Consent = {
  request: { id: string; relationshipNote: string | null };
  caregiverEmail: string;
};
export function PatientAccessPage() {
  const { token } = useAuth();
  const [access, setAccess] = useState<Access[]>([]);
  const [consents, setConsents] = useState<Consent[]>([]);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const refresh = useCallback(async () => {
    if (!token) return;
    const headers = { Authorization: `Bearer ${token}` };
    const [a, c] = await Promise.all([
      fetch('/api/patients/me/access', { headers }),
      fetch('/api/patients/me/caregiver-consents', { headers }),
    ]);
    if (a.ok) setAccess(await a.json());
    if (c.ok) setConsents(await c.json());
  }, [token]);
  useEffect(() => {
    void refresh().catch(() => setError('Could not load access information.'));
  }, [refresh]);
  async function consent(id: string, decision: 'grant' | 'deny') {
    setError('');
    const response = await fetch(`/api/patients/me/caregiver-consents/${id}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ decision }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) setError(data.message ?? 'Could not save consent');
    else {
      setMessage(
        decision === 'grant' ? 'Caregiver access granted.' : 'Request denied.',
      );
      await refresh();
    }
  }
  async function revoke(id: string) {
    setError('');
    const response = await fetch(`/api/patients/me/caregivers/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) setError('Could not revoke access.');
    else {
      setMessage('Caregiver access revoked.');
      await refresh();
    }
  }
  return (
    <section className="mx-auto max-w-3xl rounded-xl bg-white p-6 shadow-sm">
      <Link to="/patient" className="text-sm text-indigo-700 hover:underline">
        ← Back to dashboard
      </Link>
      <h1 className="mt-3 text-2xl font-semibold">Who can see my data?</h1>
      <p className="mt-2 text-sm text-slate-600">
        Caregivers see your information only after administrator review and your
        consent.
      </p>
      {error && (
        <p role="alert" className="mt-4 text-red-700">
          {error}
        </p>
      )}
      {message && <p className="mt-4 text-green-700">{message}</p>}
      <h2 className="mt-7 font-medium">Pending consent requests</h2>
      {consents.length === 0 ? (
        <p className="mt-2 text-sm text-slate-500">
          No requests need your response.
        </p>
      ) : (
        <ul className="mt-2 divide-y">
          {consents.map(({ request, caregiverEmail }) => (
            <li key={request.id} className="py-4">
              <p className="text-sm">
                <strong>{caregiverEmail}</strong> is requesting access.
              </p>
              {request.relationshipNote && (
                <p className="mt-1 text-sm text-slate-600">
                  Note: {request.relationshipNote}
                </p>
              )}
              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => void consent(request.id, 'grant')}
                  className="rounded bg-indigo-600 px-3 py-1.5 text-sm text-white"
                >
                  Grant access
                </button>
                <button
                  onClick={() => void consent(request.id, 'deny')}
                  className="rounded border px-3 py-1.5 text-sm"
                >
                  Deny
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <h2 className="mt-7 font-medium">Caregivers with access</h2>
      {access.length === 0 ? (
        <p className="mt-2 text-sm text-slate-500">
          No caregivers currently have access.
        </p>
      ) : (
        <ul className="mt-2 divide-y">
          {access.map((item) => (
            <li
              key={item.caregiverId}
              className="flex items-center justify-between py-3"
            >
              <span className="text-sm">{item.email}</span>
              <button
                onClick={() => void revoke(item.caregiverId)}
                className="text-sm font-medium text-red-700 hover:underline"
              >
                Revoke access
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
