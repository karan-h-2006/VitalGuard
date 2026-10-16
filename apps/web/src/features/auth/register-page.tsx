import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Activity,
  ShieldCheck,
  UserCheck,
  ArrowRight,
  Building2,
} from 'lucide-react';
import { useAuth } from '../../shared/auth/auth-context.js';
import {
  Button,
  Input,
  Select,
  Badge,
  Alert,
} from '../../components/ui/index.js';

type Role = 'patient' | 'caregiver' | 'doctor';
type Institution = {
  id: string;
  name: string;
  type: string;
  city: string | null;
};

export function RegisterPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<Role>('patient');
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [institutionId, setInstitutionId] = useState('');
  const [medicalLicenseNo, setMedicalLicenseNo] = useState('');
  const [specialization, setSpecialization] = useState('');
  const [patientEmail, setPatientEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuth();

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

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    setLoading(true);

    if (
      password.length < 8 ||
      !/[A-Z]/.test(password) ||
      !/[a-z]/.test(password) ||
      !/\d/.test(password)
    ) {
      setError(
        'Password must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, and one number',
      );
      setLoading(false);
      return;
    }

    const body: Record<string, string> = { email, password, role };
    if (role === 'doctor') {
      Object.assign(body, { institutionId, medicalLicenseNo, specialization });
    }
    if (role === 'patient' && institutionId) {
      body.preferredInstitutionId = institutionId;
    }
    if (role === 'caregiver' && patientEmail) {
      body.patientEmail = patientEmail;
    }

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message ?? 'Could not create account');
      }
      login(data.token);
      navigate('/');
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Could not create account',
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-[calc(100vh-4rem)] flex-1 items-stretch bg-canvas dark:bg-canvas-dark">
      {/* Split Layout: Brand Panel (Desktop) */}
      <div className="hidden lg:flex lg:w-5/12 flex-col justify-between bg-slate-950 p-12 text-white relative overflow-hidden border-r border-slate-800">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-24 -left-24 h-96 w-96 rounded-full bg-brand/20 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-24 -right-24 h-96 w-96 rounded-full bg-teal-500/10 blur-3xl"
        />

        <div className="relative z-10 space-y-6">
          <Link to="/" className="inline-flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand text-white shadow-sm">
              <Activity className="h-5 w-5" />
            </div>
            <div className="flex flex-col">
              <span className="font-sans text-xl font-bold tracking-tight text-white">
                VitalGuard
              </span>
              <span className="font-mono text-[9px] uppercase tracking-widest text-slate-400">
                Patient Telemetry
              </span>
            </div>
          </Link>

          <div className="pt-8">
            <Badge variant="bracketed" className="text-slate-400">
              Role Onboarding
            </Badge>
            <h2 className="mt-4 font-sans text-3xl xl:text-4xl font-extrabold tracking-tight leading-snug">
              Secure access for every participant in care.
            </h2>
            <p className="mt-4 text-sm text-slate-400 leading-relaxed max-w-sm">
              Whether you are monitoring your own recovery, caring for a family
              member, or managing clinical triage, VitalGuard keeps you
              connected.
            </p>
          </div>
        </div>

        <div className="relative z-10 space-y-4 pt-8 border-t border-slate-800/80">
          <div className="flex items-center gap-3 text-xs text-slate-300">
            <ShieldCheck className="h-4 w-4 text-brand shrink-0" />
            <span>Doctors verified by institutional administrators</span>
          </div>
          <div className="flex items-center gap-3 text-xs text-slate-300">
            <UserCheck className="h-4 w-4 text-teal-400 shrink-0" />
            <span>Two-phase caregiver consent policy</span>
          </div>
          <div className="flex items-center gap-3 text-xs text-slate-300">
            <Building2 className="h-4 w-4 text-indigo-400 shrink-0" />
            <span>Affiliated with regional healthcare institutions</span>
          </div>
          <div className="pt-2 text-[11px] text-slate-500">
            VitalGuard is a student/team project and not a certified medical
            device.
          </div>
        </div>
      </div>

      {/* Form Panel (Desktop & Mobile) */}
      <div className="flex w-full lg:w-7/12 flex-col justify-center px-4 py-12 sm:px-8 md:px-16 lg:px-20 overflow-y-auto">
        <div className="mx-auto w-full max-w-lg space-y-8">
          <div>
            <div className="flex items-center justify-between">
              <Badge variant="bracketed">Registration</Badge>
              <Link
                to="/"
                className="font-mono text-xs uppercase tracking-wider text-slate-500 hover:text-slate-900 dark:hover:text-slate-100"
              >
                ← Back to home
              </Link>
            </div>
            <h1 className="mt-3 font-sans text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              Create your VitalGuard account
            </h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Select your role and provide credentials to enroll.
            </p>
          </div>

          {error && (
            <Alert variant="error" title="Registration error">
              {error}
            </Alert>
          )}

          <form onSubmit={submit} className="space-y-5">
            <Select
              id="role"
              label="Account type"
              value={role}
              onChange={(e) => setRole(e.target.value as Role)}
              options={[
                { label: 'Patient (Self-Monitoring)', value: 'patient' },
                { label: 'Caregiver (Family / Proxy)', value: 'caregiver' },
                { label: 'Doctor (Clinical Staff)', value: 'doctor' },
              ]}
            />

            <Input
              id="email"
              type="email"
              label="Email address"
              placeholder="user@example.test"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />

            <Input
              id="password"
              type="password"
              label="Password"
              placeholder="••••••••••••"
              minLength={8}
              required
              helperText="Must be at least 8 characters with at least one uppercase letter, one lowercase letter, and one number"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />

            {(role === 'patient' || role === 'doctor') && (
              <Select
                id="institution"
                label={
                  role === 'patient'
                    ? 'Preferred institution (optional)'
                    : 'Institution'
                }
                required={role === 'doctor'}
                value={institutionId}
                onChange={(e) => setInstitutionId(e.target.value)}
              >
                <option value="">
                  {role === 'patient'
                    ? 'No preference'
                    : 'Select an institution'}
                </option>
                {institutions.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                    {item.city ? ` · ${item.city}` : ''}
                  </option>
                ))}
              </Select>
            )}

            {role === 'doctor' && (
              <div className="space-y-4 rounded-xl border border-blue-200/80 bg-blue-50/50 p-4 dark:border-blue-900/50 dark:bg-blue-950/20">
                <Input
                  id="license"
                  label="Medical license number"
                  placeholder="e.g. MED-89412-ON"
                  required
                  maxLength={128}
                  value={medicalLicenseNo}
                  onChange={(e) => setMedicalLicenseNo(e.target.value)}
                />

                <Input
                  id="specialization"
                  label="Clinical Specialization"
                  placeholder="e.g. Cardiology, Internal Medicine"
                  required
                  maxLength={255}
                  value={specialization}
                  onChange={(e) => setSpecialization(e.target.value)}
                />

                <p className="font-mono text-xs text-blue-800 dark:text-blue-300">
                  Notice: Doctor accounts remain locked in pending status until
                  an administrator reviews and approves the application.
                </p>
              </div>
            )}

            {role === 'caregiver' && (
              <div className="space-y-2 rounded-xl border border-teal-200/80 bg-teal-50/50 p-4 dark:border-teal-900/50 dark:bg-teal-950/20">
                <Input
                  id="patientEmail"
                  type="email"
                  label="Patient email to request link (optional)"
                  placeholder="patient@example.test"
                  value={patientEmail}
                  onChange={(e) => setPatientEmail(e.target.value)}
                  helperText="You will not see patient telemetry until an administrator approves and the patient explicitly consents."
                />
              </div>
            )}

            <Button
              type="submit"
              variant="primary"
              size="lg"
              loading={loading}
              rollEffect
              className="w-full"
              icon={<ArrowRight className="h-4 w-4" />}
            >
              Create account
            </Button>
          </form>

          <div className="pt-4 text-center border-t border-slate-200/80 dark:border-slate-800">
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Already have an account?{' '}
              <Link
                to="/login"
                className="font-medium text-brand hover:text-brand-700 dark:text-brand-400 underline underline-offset-4"
              >
                Sign in here
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
