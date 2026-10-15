import { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { Activity, ShieldCheck, Clock, ArrowRight } from 'lucide-react';
import { useAuth } from '../../shared/auth/auth-context.js';
import { Button, Input, Badge, Alert } from '../../components/ui/index.js';

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();

  const searchParams = new URLSearchParams(location.search);
  const isExpired =
    searchParams.get('expired') === 'true' ||
    Boolean((location.state as { sessionExpired?: boolean })?.sessionExpired);
  const returnUrl =
    searchParams.get('returnUrl') ||
    (location.state as { from?: string })?.from ||
    '/';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to login');
      }

      login(data.token);
      navigate(returnUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to login');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-4rem)] flex-1 items-stretch bg-canvas dark:bg-canvas-dark">
      {/* Split Layout: Brand Panel (Desktop) */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between bg-slate-950 p-12 text-white relative overflow-hidden border-r border-slate-800">
        {/* Soft Radial Gradient Glow */}
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
              Biometric Vigilance
            </Badge>
            <h2 className="mt-4 font-sans text-3xl xl:text-4xl font-extrabold tracking-tight leading-snug">
              Every vital. Every second. Zero blind spots.
            </h2>
            <p className="mt-4 text-base text-slate-400 leading-relaxed max-w-md">
              Clinical-grade telemetry streaming, automated rule evaluation, and
              instant hierarchical alerting for patients, caregivers, and
              medical teams.
            </p>
          </div>
        </div>

        <div className="relative z-10 space-y-4 pt-8 border-t border-slate-800/80">
          <div className="flex items-center gap-3 text-xs text-slate-300">
            <Clock className="h-4 w-4 text-brand shrink-0" />
            <span>~5-second MQTT telemetry ingestion frequency</span>
          </div>
          <div className="flex items-center gap-3 text-xs text-slate-300">
            <ShieldCheck className="h-4 w-4 text-teal-400 shrink-0" />
            <span>Role-based clinical triage and patient privacy controls</span>
          </div>
          <div className="pt-2 text-[11px] text-slate-500">
            VitalGuard is a student/team project and not a certified medical
            device.
          </div>
        </div>
      </div>

      {/* Form Panel (Desktop & Mobile) */}
      <div className="flex w-full lg:w-1/2 flex-col justify-center px-4 py-12 sm:px-8 md:px-16 lg:px-20">
        <div className="mx-auto w-full max-w-md space-y-8">
          <div>
            <div className="flex items-center justify-between">
              <Badge variant="bracketed">Authentication</Badge>
              <Link
                to="/"
                className="font-mono text-xs uppercase tracking-wider text-slate-500 hover:text-slate-900 dark:hover:text-slate-100"
              >
                ← Back to home
              </Link>
            </div>
            <h1 className="mt-3 font-sans text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              Sign in to VitalGuard
            </h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Enter your credentials to access your personalized workstation.
            </p>
          </div>

          {isExpired && !error && (
            <Alert variant="warning" title="Session expired">
              Your session has expired. Please log in again to continue to your
              workstation.
            </Alert>
          )}

          {error && (
            <Alert variant="error" title="Sign in failed">
              {error}
            </Alert>
          )}

          <form className="space-y-5" onSubmit={handleSubmit}>
            <Input
              id="email"
              name="email"
              type="email"
              label="Email address"
              placeholder="user@example.test"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />

            <Input
              id="password"
              name="password"
              type="password"
              label="Password"
              placeholder="••••••••••••"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />

            <Button
              type="submit"
              variant="primary"
              size="lg"
              loading={loading}
              rollEffect
              className="w-full"
              icon={<ArrowRight className="h-4 w-4" />}
            >
              Sign in
            </Button>
          </form>

          <div className="pt-4 text-center border-t border-slate-200/80 dark:border-slate-800">
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Don't have an account?{' '}
              <Link
                to="/register"
                className="font-medium text-brand hover:text-brand-700 dark:text-brand-400 underline underline-offset-4"
              >
                Register here
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
