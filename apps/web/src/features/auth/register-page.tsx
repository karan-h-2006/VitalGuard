import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../shared/auth/auth-context.js';

type Role = 'patient' | 'caregiver' | 'doctor';
type Institution = {
  id: string;
  name: string;
  type: string;
  city: string | null;
};
const inputClass =
  'mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900 focus:border-indigo-600 focus:outline-none';

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
    const body: Record<string, string> = { email, password, role };
    if (role === 'doctor')
      Object.assign(body, { institutionId, medicalLicenseNo, specialization });
    if (role === 'patient' && institutionId)
      body.preferredInstitutionId = institutionId;
    if (role === 'caregiver' && patientEmail) body.patientEmail = patientEmail;
    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.message ?? 'Could not create account');
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
    <div className="flex flex-1 items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-lg space-y-6 rounded-xl bg-white p-8 shadow-lg">
        <header className="text-center">
          <h1 className="text-3xl font-bold text-slate-900">VitalGuard</h1>
          <p className="mt-2 text-sm text-slate-600">Create a new account</p>
        </header>
        {error && (
          <p
            role="alert"
            className="rounded bg-red-50 p-3 text-sm text-red-700"
          >
            {error}
          </p>
        )}
        <form onSubmit={submit} className="space-y-4">
          <label className="block text-sm font-medium">
            Account type
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as Role)}
              className={inputClass}
            >
              <option value="patient">Patient</option>
              <option value="caregiver">Caregiver</option>
              <option value="doctor">Doctor</option>
            </select>
          </label>
          <label className="block text-sm font-medium">
            Email address
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputClass}
            />
          </label>
          <label className="block text-sm font-medium">
            Password
            <input
              type="password"
              minLength={10}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputClass}
            />
          </label>
          {(role === 'patient' || role === 'doctor') && (
            <label className="block text-sm font-medium">
              {role === 'patient'
                ? 'Preferred institution (optional)'
                : 'Institution'}
              <select
                required={role === 'doctor'}
                value={institutionId}
                onChange={(e) => setInstitutionId(e.target.value)}
                className={inputClass}
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
              </select>
            </label>
          )}
          {role === 'doctor' && (
            <>
              <label className="block text-sm font-medium">
                Medical license number
                <input
                  required
                  maxLength={128}
                  value={medicalLicenseNo}
                  onChange={(e) => setMedicalLicenseNo(e.target.value)}
                  className={inputClass}
                />
              </label>
              <label className="block text-sm font-medium">
                Specialization
                <input
                  required
                  maxLength={255}
                  value={specialization}
                  onChange={(e) => setSpecialization(e.target.value)}
                  className={inputClass}
                />
              </label>
              <p className="text-sm text-amber-700">
                Doctor accounts remain pending until an administrator reviews
                the application.
              </p>
            </>
          )}
          {role === 'caregiver' && (
            <label className="block text-sm font-medium">
              Patient email to request a link (optional)
              <input
                type="email"
                value={patientEmail}
                onChange={(e) => setPatientEmail(e.target.value)}
                className={inputClass}
              />
              <span className="mt-1 block text-xs font-normal text-slate-500">
                You will not see patient information until the administrator
                approves and the patient consents.
              </span>
            </label>
          )}
          <button
            disabled={loading}
            className="w-full rounded-md bg-indigo-600 px-4 py-2 font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
          >
            {loading ? 'Creating account…' : 'Create account'}
          </button>
        </form>
        <p className="text-center text-sm text-slate-600">
          Already have an account?{' '}
          <Link to="/login" className="font-semibold text-indigo-600">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
