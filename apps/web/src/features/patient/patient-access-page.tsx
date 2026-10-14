import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, UserCheck, Trash2, Check, X } from 'lucide-react';
import { useAuth } from '../../shared/auth/auth-context.js';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Badge,
  Alert,
  Button,
} from '../../components/ui/index.js';

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
    <div className="mx-auto max-w-4xl space-y-6">
      <Link to="/patient">
        <Button
          variant="ghost"
          size="sm"
          icon={<ChevronLeft className="h-4 w-4" />}
        >
          Back to dashboard
        </Button>
      </Link>

      <div className="flex flex-col gap-1">
        <Badge variant="bracketed">Consent &amp; Privacy</Badge>
        <h1 className="font-sans text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
          Who can see my data?
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Caregivers can view your biometric telemetry only after administrator
          verification and your explicit authorization.
        </p>
      </div>

      {error && (
        <Alert variant="error" title="Access management error">
          {error}
        </Alert>
      )}

      {message && (
        <Alert variant="success" title="Success">
          {message}
        </Alert>
      )}

      {/* Pending Consent Requests */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Pending Consent Requests</CardTitle>
            <Badge variant="bracketed">{consents.length} pending</Badge>
          </div>
          <CardDescription>
            These caregivers have been verified by administrators and require
            your permission before telemetry is unlocked.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {consents.length === 0 ? (
            <p className="text-sm text-slate-500 py-3">
              No pending requests need your response.
            </p>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {consents.map(({ request, caregiverEmail }) => (
                <li
                  key={request.id}
                  className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div>
                    <div className="font-semibold text-sm text-slate-900 dark:text-slate-100">
                      {caregiverEmail}
                    </div>
                    {request.relationshipNote && (
                      <p className="text-xs text-slate-500 mt-1">
                        Note: {request.relationshipNote}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      size="sm"
                      variant="primary"
                      icon={<Check className="h-3.5 w-3.5" />}
                      onClick={() => void consent(request.id, 'grant')}
                    >
                      Grant access
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      icon={<X className="h-3.5 w-3.5" />}
                      onClick={() => void consent(request.id, 'deny')}
                    >
                      Deny
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Active Caregivers with Access */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">
              Caregivers with Active Access
            </CardTitle>
            <Badge variant="teal">{access.length} active</Badge>
          </div>
          <CardDescription>
            These individuals have authorized real-time view rights to your
            vitals.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {access.length === 0 ? (
            <p className="text-sm text-slate-500 py-3">
              No caregivers currently have access to your telemetry.
            </p>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {access.map((item) => (
                <li
                  key={item.caregiverId}
                  className="flex items-center justify-between py-3.5"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                      <UserCheck className="h-4 w-4" />
                    </div>
                    <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
                      {item.email}
                    </span>
                  </div>
                  <Button
                    size="sm"
                    variant="danger"
                    icon={<Trash2 className="h-3.5 w-3.5" />}
                    onClick={() => void revoke(item.caregiverId)}
                  >
                    Revoke access
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
