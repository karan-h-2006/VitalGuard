import { useCallback, useEffect, useState } from 'react';
import { Users, Send, Clock } from 'lucide-react';
import { useAuth } from '../../shared/auth/auth-context.js';
import { TriageDashboard } from '../../shared/components/triage-dashboard.js';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Badge,
  Alert,
  Input,
  Textarea,
  Button,
  Skeleton,
} from '../../components/ui/index.js';

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
  const [submitting, setSubmitting] = useState(false);

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
    setSubmitting(true);
    try {
      const response = await fetch('/api/caregiver/link-requests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ patientEmail, relationshipNote }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.message ?? 'Could not submit request');
      } else {
        setMessage('Request submitted for administrator review.');
        setPatientEmail('');
        setRelationshipNote('');
        await refresh();
      }
    } catch {
      setError('Network error while submitting link request.');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    );
  }

  if (patients.length > 0) {
    return <TriageDashboard title="Caregiver Dashboard" />;
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <Badge variant="bracketed" className="mb-1">
          Proxy Access
        </Badge>
        <h1 className="font-sans text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
          Caregiver Workstation
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Monitor biometric telemetry for your family members and dependents.
        </p>
      </div>

      {error && (
        <Alert variant="error" title="Caregiver link error">
          {error}
        </Alert>
      )}

      {message && (
        <Alert variant="success" title="Success">
          {message}
        </Alert>
      )}

      {/* Request Access Form */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-brand" />
            <CardTitle className="text-lg">Request Patient Access</CardTitle>
          </div>
          <CardDescription>
            Request view access using the patient's registered email address.
            Patient information remains confidential until approved by an
            administrator and consented to by the patient.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <Input
              id="patientEmail"
              type="email"
              label="Patient Email Address"
              placeholder="patient@example.test"
              required
              value={patientEmail}
              onChange={(e) => setPatientEmail(e.target.value)}
            />

            <Textarea
              id="relationshipNote"
              label="Relationship note (optional)"
              placeholder="Explain your relationship (e.g., Parent, Spouse, Guardian)..."
              maxLength={500}
              helperText="Maximum 500 characters"
              value={relationshipNote}
              onChange={(e) => setRelationshipNote(e.target.value)}
            />

            <Button
              type="submit"
              variant="primary"
              loading={submitting}
              rollEffect
              icon={<Send className="h-3.5 w-3.5" />}
            >
              Request link
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Request Status List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Access Request History</CardTitle>
            <Badge variant="bracketed">{requests.length} requests</Badge>
          </div>
        </CardHeader>

        <CardContent>
          {requests.length === 0 ? (
            <p className="text-sm text-slate-500 py-3">
              No access requests submitted yet.
            </p>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {requests.map((item) => (
                <li
                  key={item.id}
                  className="py-3.5 flex items-center justify-between"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <Badge
                        severity={
                          item.status === 'approved'
                            ? 'normal'
                            : item.status === 'rejected'
                              ? 'critical'
                              : 'watch'
                        }
                      >
                        {item.status.replaceAll('_', ' ')}
                      </Badge>
                      {item.status === 'approved' && (
                        <span className="font-mono text-xs text-slate-500">
                          · patient consent: {item.patientConsent}
                        </span>
                      )}
                    </div>
                    <span className="mt-1 flex items-center gap-1 font-mono text-[11px] text-slate-400">
                      <Clock className="h-3 w-3" />
                      {new Date(item.createdAt).toLocaleString()}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
