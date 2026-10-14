import { useEffect, useState } from 'react';
import { Send } from 'lucide-react';
import { useAuth } from '../../shared/auth/auth-context.js';
import {
  Card,
  CardHeader,
  CardDescription,
  CardContent,
  Badge,
  Alert,
  Input,
  Select,
  Button,
} from '../../components/ui/index.js';

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
  const [submitting, setSubmitting] = useState(false);

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
    setSubmitting(true);
    try {
      const response = await fetch('/api/doctors/me/reapply', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          institutionId,
          medicalLicenseNo,
          specialization,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.message ?? 'Could not resubmit application');
      } else {
        setMessage(
          'Application resubmitted. The administrator will review it.',
        );
      }
    } catch {
      setError('Network error while resubmitting application.');
    } finally {
      setSubmitting(false);
    }
  }

  const status = doctorApplication?.status ?? 'pending';

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <Badge variant="bracketed">Clinical Verification</Badge>
            <Badge
              severity={
                status === 'approved'
                  ? 'normal'
                  : status === 'pending'
                    ? 'watch'
                    : 'critical'
              }
            >
              {status} review
            </Badge>
          </div>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 capitalize">
            {status} review
          </h1>
          <CardDescription>
            {status === 'pending'
              ? 'Your application is waiting for administrator approval. Patient information and clinical tools stay locked until approval.'
              : status === 'rejected'
                ? 'Your application was rejected by an administrator.'
                : 'Your doctor account is currently suspended.'}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {doctorApplication?.rejectionReason && (
            <Alert variant="warning" title="Administrator Review Note">
              {doctorApplication.rejectionReason}
            </Alert>
          )}

          {message && (
            <Alert variant="success" title="Success">
              {message}
            </Alert>
          )}

          {error && (
            <Alert variant="error" title="Submission Error">
              {error}
            </Alert>
          )}

          {doctorApplication?.mayReapply && (
            <form
              className="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-800"
              onSubmit={reapply}
            >
              <h2 className="font-sans text-base font-semibold text-slate-900 dark:text-slate-100">
                Submit a new application
              </h2>

              <Select
                id="institution"
                label="Institution"
                required
                value={institutionId}
                onChange={(e) => setInstitutionId(e.target.value)}
              >
                {institutions.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                    {item.city ? ` · ${item.city}` : ''}
                  </option>
                ))}
              </Select>

              <Input
                id="license"
                label="Medical license number"
                required
                maxLength={128}
                value={medicalLicenseNo}
                onChange={(e) => setMedicalLicenseNo(e.target.value)}
              />

              <Input
                id="specialization"
                label="Specialization"
                required
                maxLength={255}
                value={specialization}
                onChange={(e) => setSpecialization(e.target.value)}
              />

              <Button
                type="submit"
                variant="primary"
                loading={submitting}
                rollEffect
                icon={<Send className="h-3.5 w-3.5" />}
              >
                Resubmit application
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
