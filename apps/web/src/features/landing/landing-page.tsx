import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  Heart,
  Thermometer,
  ShieldCheck,
  Users,
  Building2,
  Clock,
  ArrowRight,
  Menu,
  X,
  Radio,
  FileText,
  Lock,
  CheckCircle2,
} from 'lucide-react';
import {
  Button,
  Badge,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
  Stat,
} from '../../components/ui/index.js';

const ROTATING_WORDS = [
  'heart rate',
  'blood oxygen (SpO2)',
  'temperature',
  'motion & orientation',
];

const MARQUEE_ITEMS = [
  {
    label: 'Continuous Heart Rate',
    icon: <Heart className="h-4 w-4 text-rose-500" />,
  },
  {
    label: 'SpO2 Pulse Oximetry',
    icon: <Activity className="h-4 w-4 text-blue-500" />,
  },
  {
    label: 'Core Temperature',
    icon: <Thermometer className="h-4 w-4 text-amber-500" />,
  },
  {
    label: '3-Axis Motion Telemetry',
    icon: <Activity className="h-4 w-4 text-purple-500" />,
  },
  {
    label: 'MQTT Stream Ingestion',
    icon: <Radio className="h-4 w-4 text-teal-500" />,
  },
  {
    label: 'Sub-5s Alert Dispatch',
    icon: <Clock className="h-4 w-4 text-sky-500" />,
  },
  {
    label: 'Weekly Clinical PDF Reports',
    icon: <FileText className="h-4 w-4 text-indigo-500" />,
  },
  {
    label: 'Patient Consent Governance',
    icon: <Lock className="h-4 w-4 text-emerald-500" />,
  },
  {
    label: 'Verified Doctor Onboarding',
    icon: <ShieldCheck className="h-4 w-4 text-blue-600" />,
  },
];

export function LandingPage() {
  const [wordIndex, setWordIndex] = useState(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setWordIndex((prev) => (prev + 1) % ROTATING_WORDS.length);
    }, 2800);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="min-h-screen bg-canvas text-slate-900 selection:bg-brand/20 dark:bg-canvas-dark dark:text-slate-100">
      {/* 1. TOP NAVIGATION */}
      <header
        className={`sticky top-0 z-40 w-full transition-all duration-300 ${
          isScrolled
            ? 'border-b border-slate-200/80 bg-white/90 shadow-sm backdrop-blur-md dark:border-slate-800/80 dark:bg-slate-950/90'
            : 'border-b border-transparent bg-transparent'
        }`}
      >
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          {/* Logo */}
          <Link
            to="/"
            className="flex items-center gap-2.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand rounded-lg"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand text-white shadow-sm">
              <Activity className="h-5 w-5" />
            </div>
            <div className="flex flex-col">
              <span className="font-sans text-lg font-bold tracking-tight text-slate-900 dark:text-white">
                VitalGuard
              </span>
              <span className="font-mono text-[9px] uppercase tracking-widest text-slate-500">
                Patient Telemetry
              </span>
            </div>
          </Link>

          {/* Desktop Nav Links */}
          <nav className="hidden md:flex items-center gap-8">
            <a
              href="#features"
              className="font-mono text-xs uppercase tracking-wider text-slate-600 transition-colors hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
            >
              Features
            </a>
            <a
              href="#how-it-works"
              className="font-mono text-xs uppercase tracking-wider text-slate-600 transition-colors hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
            >
              How It Works
            </a>
            <a
              href="#roles"
              className="font-mono text-xs uppercase tracking-wider text-slate-600 transition-colors hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
            >
              Roles
            </a>
            <a
              href="#faq"
              className="font-mono text-xs uppercase tracking-wider text-slate-600 transition-colors hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
            >
              FAQ
            </a>
          </nav>

          {/* Desktop Auth Actions */}
          <div className="hidden md:flex items-center gap-3">
            <Link to="/login">
              <Button variant="ghost" size="sm">
                Sign in
              </Button>
            </Link>
            <Link to="/register">
              <Button variant="primary" size="sm" rollEffect>
                Get started
              </Button>
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(true)}
            className="md:hidden rounded-lg p-2 text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
            aria-label="Open main menu"
          >
            <Menu className="h-6 w-6" />
          </button>
        </div>
      </header>

      {/* Mobile Full-Screen Overlay Navigation */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex flex-col bg-white p-6 dark:bg-slate-950 md:hidden animate-fade-in-up">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand text-white">
                <Activity className="h-5 w-5" />
              </div>
              <span className="font-sans text-lg font-bold tracking-tight text-slate-900 dark:text-white">
                VitalGuard
              </span>
            </div>
            <button
              type="button"
              onClick={() => setMobileMenuOpen(false)}
              className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
              aria-label="Close menu"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          <nav className="mt-12 flex flex-col space-y-6">
            <a
              href="#features"
              onClick={() => setMobileMenuOpen(false)}
              className="font-mono text-lg uppercase tracking-wider text-slate-800 dark:text-slate-200"
            >
              Features
            </a>
            <a
              href="#how-it-works"
              onClick={() => setMobileMenuOpen(false)}
              className="font-mono text-lg uppercase tracking-wider text-slate-800 dark:text-slate-200"
            >
              How It Works
            </a>
            <a
              href="#roles"
              onClick={() => setMobileMenuOpen(false)}
              className="font-mono text-lg uppercase tracking-wider text-slate-800 dark:text-slate-200"
            >
              For Doctors & Caregivers
            </a>
            <a
              href="#faq"
              onClick={() => setMobileMenuOpen(false)}
              className="font-mono text-lg uppercase tracking-wider text-slate-800 dark:text-slate-200"
            >
              FAQ
            </a>
          </nav>

          <div className="mt-auto flex flex-col gap-3 pt-6 border-t border-slate-100 dark:border-slate-800">
            <Link to="/login" onClick={() => setMobileMenuOpen(false)}>
              <Button variant="outline" className="w-full">
                Sign in
              </Button>
            </Link>
            <Link to="/register" onClick={() => setMobileMenuOpen(false)}>
              <Button variant="primary" className="w-full">
                Get started
              </Button>
            </Link>
          </div>
        </div>
      )}

      {/* 2. HERO SECTION */}
      <section className="relative overflow-hidden pt-12 pb-20 sm:pt-20 sm:pb-28">
        {/* Soft Ambient Radial Glow */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-40 left-1/2 -z-10 h-[550px] w-[800px] -translate-x-1/2 rounded-full bg-gradient-to-tr from-sky-400/20 via-brand/20 to-teal-400/10 blur-3xl opacity-75"
        />

        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center space-y-6">
            {/* Disclaimer pill */}
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-300 bg-amber-50 px-3.5 py-1 text-xs text-amber-900 shadow-sm dark:border-amber-700/60 dark:bg-amber-950/40 dark:text-amber-200">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
              <span>
                Project Demonstration · Not a certified medical device
              </span>
            </div>

            {/* Three-Beat Headline */}
            <h1 className="font-sans text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-slate-900 dark:text-slate-50 leading-[1.08]">
              Every vital. <br />
              <span className="text-brand">Every second.</span> <br />
              Zero blind spots.
            </h1>

            {/* Rotating Bracketed Word Sentence */}
            <p className="font-mono text-sm sm:text-base text-slate-600 dark:text-slate-300">
              Continuous monitoring for{' '}
              <span className="inline-flex items-center rounded-lg border border-brand/30 bg-brand/5 px-2.5 py-0.5 font-semibold text-brand dark:border-brand/40 dark:bg-brand/10 transition-all duration-300">
                [ {ROTATING_WORDS[wordIndex]} ]
              </span>{' '}
              around the clock.
            </p>

            {/* Subhead */}
            <p className="mx-auto max-w-2xl text-base sm:text-lg text-slate-600 dark:text-slate-400 font-normal leading-relaxed">
              Clinical-grade real-time telemetry ingestion, automated rule
              evaluation, and instant hierarchical alerting for patients,
              caregivers, and medical teams.
            </p>

            {/* Dual CTAs */}
            <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link to="/register">
                <Button
                  variant="primary"
                  size="lg"
                  rollEffect
                  icon={<ArrowRight className="h-4 w-4" />}
                >
                  Get started
                </Button>
              </Link>
              <a href="#how-it-works">
                <Button variant="outline" size="lg">
                  See how it works
                </Button>
              </a>
            </div>

            {/* Academic Capstone Attribution */}
            <div className="pt-6 flex justify-center">
              <div className="inline-flex flex-wrap items-center justify-center gap-x-2 gap-y-1 rounded-full border border-slate-200/80 bg-white/70 px-4 py-2 text-xs text-slate-600 shadow-sm backdrop-blur-sm dark:border-slate-800/80 dark:bg-slate-900/60 dark:text-slate-400">
                <span className="font-mono text-brand font-semibold">
                  [ IT303 · Software Engineering ]
                </span>
                <span className="hidden sm:inline text-slate-300 dark:text-slate-700">
                  •
                </span>
                <span>
                  Project built by{' '}
                  <strong className="font-semibold text-slate-800 dark:text-slate-200">
                    Rohan G
                  </strong>{' '}
                  (241IT064),{' '}
                  <strong className="font-semibold text-slate-800 dark:text-slate-200">
                    Karan H
                  </strong>{' '}
                  (241IT037) &amp;{' '}
                  <strong className="font-semibold text-slate-800 dark:text-slate-200">
                    DM Vikas
                  </strong>{' '}
                  (241IT018)
                </span>
                <span className="hidden sm:inline text-slate-300 dark:text-slate-700">
                  •
                </span>
                <span>
                  Under the guidance of{' '}
                  <strong className="font-semibold text-slate-800 dark:text-slate-200">
                    Prof. Jaidhar C. D.
                  </strong>
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. VITALS MARQUEE */}
      <section className="border-y border-slate-200/80 bg-white py-6 dark:border-slate-800/80 dark:bg-slate-900/60 overflow-hidden">
        <div className="flex w-max animate-marquee pause-on-hover gap-6">
          {[...MARQUEE_ITEMS, ...MARQUEE_ITEMS].map((item, idx) => (
            <div
              key={idx}
              className="flex items-center gap-2.5 rounded-full border border-slate-200/80 bg-slate-50 px-4 py-2 font-mono text-xs uppercase tracking-wider text-slate-700 transition-colors hover:border-slate-400 hover:bg-white dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-300 dark:hover:border-slate-600"
            >
              {item.icon}
              <span className="font-medium">{item.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* 4. PROBLEM SECTION */}
      <section id="features" className="py-20 sm:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="text-center space-y-3">
            <Badge variant="bracketed">The Clinical Challenge</Badge>
            <h2 className="font-sans text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              Why Traditional Monitoring Leaves Gaps
            </h2>
            <p className="mx-auto max-w-xl text-sm sm:text-base text-slate-600 dark:text-slate-400">
              Periodic checks miss deterioration. Modern care requires
              uninterrupted telemetry and verified collaboration.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <Card hoverEffect className="border-t-4 border-t-amber-500">
              <CardHeader>
                <Badge variant="bracketed" className="mb-2">
                  Obstacle 01
                </Badge>
                <CardTitle>Delayed Detection</CardTitle>
                <CardDescription>
                  Intermittent vital sign checks
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                  Manual spot-checks every 4 to 8 hours allow acute hypoxemia or
                  tachycardia to go unnoticed between nursing rounds, converting
                  preventable degradation into ICU transfers.
                </p>
              </CardContent>
            </Card>

            <Card hoverEffect className="border-t-4 border-t-rose-500">
              <CardHeader>
                <Badge variant="bracketed" className="mb-2">
                  Obstacle 02
                </Badge>
                <CardTitle>Alert Fatigue</CardTitle>
                <CardDescription>Uncalibrated raw telemetry</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                  Excessive false alarms desensitize on-duty physicians.
                  VitalGuard uses multi-vital correlation and hierarchical
                  triage tiers (Watch, Warning, Critical) to surface genuine
                  risks.
                </p>
              </CardContent>
            </Card>

            <Card hoverEffect className="border-t-4 border-t-sky-500">
              <CardHeader>
                <Badge variant="bracketed" className="mb-2">
                  Obstacle 03
                </Badge>
                <CardTitle>Fragmented Access</CardTitle>
                <CardDescription>
                  Siloed caregiver communication
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                  Family caregivers remain excluded from patient telemetry,
                  while physicians lack verified institutional assignment.
                  VitalGuard unites both under robust administrative governance.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* 5. HOW IT WORKS / NUMBERED FEATURE CARDS */}
      <section
        id="how-it-works"
        className="border-t border-slate-200/80 bg-slate-50/50 py-20 sm:py-28 dark:border-slate-800/80 dark:bg-slate-900/40"
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="text-center space-y-3">
            <Badge variant="bracketed">Telemetry Pipeline</Badge>
            <h2 className="font-sans text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              Engineered for Continuous Reliability
            </h2>
            <p className="mx-auto max-w-xl text-sm sm:text-base text-slate-600 dark:text-slate-400">
              From hardware sensor reading to immediate physician alert in under
              five seconds.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="flex flex-col justify-between rounded-2xl border border-slate-200/80 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div>
                <span className="font-mono text-4xl font-bold tracking-tight text-brand">
                  01
                </span>
                <h3 className="mt-4 font-sans text-xl font-bold text-slate-900 dark:text-slate-100">
                  Capture & Transmit
                </h3>
                <p className="mt-3 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                  IoT edge sensors sample heart rate, SpO2, core temperature,
                  and accelerometer motion, transmitting payload packets over
                  secure TLS MQTT brokers.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 font-mono text-xs text-slate-500">
                [ ~5s sample interval ]
              </div>
            </div>

            <div className="flex flex-col justify-between rounded-2xl border border-slate-200/80 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div>
                <span className="font-mono text-4xl font-bold tracking-tight text-teal-600">
                  02
                </span>
                <h3 className="mt-4 font-sans text-xl font-bold text-slate-900 dark:text-slate-100">
                  Analyze & Score
                </h3>
                <p className="mt-3 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                  Streaming worker services evaluate telemetry against
                  physiological decision tables, detecting thresholds, sustained
                  anomalies, and acute physiological deterioration.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 font-mono text-xs text-slate-500">
                [ 3 severity triage levels ]
              </div>
            </div>

            <div className="flex flex-col justify-between rounded-2xl border border-slate-200/80 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div>
                <span className="font-mono text-4xl font-bold tracking-tight text-indigo-600">
                  03
                </span>
                <h3 className="mt-4 font-sans text-xl font-bold text-slate-900 dark:text-slate-100">
                  Alert & Coordinate
                </h3>
                <p className="mt-3 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                  Real-time notification dispatches instantly to assigned
                  physicians and authorized caregivers with unread indicators,
                  sparkline trends, and triage queues.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 font-mono text-xs text-slate-500">
                [ WebSocket push alerts ]
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 6. LIVE DASHBOARD PREVIEW */}
      <section className="py-20 sm:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-8">
          <div className="text-center space-y-3">
            <Badge variant="bracketed">Interface Preview</Badge>
            <h2 className="font-sans text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              Clinical Telemetry at a Glance
            </h2>
            <p className="mx-auto max-w-xl text-sm sm:text-base text-slate-600 dark:text-slate-400">
              High-density physician workstation previewing live patient cards,
              triage indicators, and trend sparklines.
            </p>
          </div>

          {/* Styled Dashboard Preview Window */}
          <div className="overflow-hidden rounded-2xl border border-slate-300/80 bg-slate-900 text-white shadow-2xl dark:border-slate-700">
            {/* Window chrome header */}
            <div className="flex items-center justify-between border-b border-slate-800 bg-slate-950 px-5 py-3">
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-rose-500" />
                <span className="h-3 w-3 rounded-full bg-amber-500" />
                <span className="h-3 w-3 rounded-full bg-emerald-500" />
                <span className="ml-3 font-mono text-xs text-slate-400">
                  vitalguard.clinical.internal/doctor/triage
                </span>
              </div>
              <Badge variant="bracketed" className="text-[10px] text-slate-400">
                Preview Fixture · Synthetic Data
              </Badge>
            </div>

            {/* Dashboard content preview */}
            <div className="p-6 sm:p-8 space-y-6">
              {/* Patient Banner */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-slate-800 bg-slate-950/60 p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand/20 text-brand font-bold">
                    PT
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-sans font-bold text-base">
                        Jane Doe (PT-8402)
                      </span>
                      <Badge severity="normal" />
                    </div>
                    <span className="text-xs text-slate-400">
                      Assigned: Dr. Robert Vance · Memorial Hospital
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-3 font-mono text-xs text-slate-400">
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                    Live stream
                  </span>
                  <span>Updated 2s ago</span>
                </div>
              </div>

              {/* Vitals Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-4">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs uppercase text-slate-400">
                      Heart Rate
                    </span>
                    <Heart className="h-4 w-4 text-rose-400" />
                  </div>
                  <div className="mt-2 font-mono text-3xl font-bold text-white">
                    74{' '}
                    <span className="text-xs text-slate-400 font-normal">
                      bpm
                    </span>
                  </div>
                  <span className="mt-1 inline-block text-[11px] text-emerald-400">
                    Normal sinus rhythm
                  </span>
                </div>

                <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-4">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs uppercase text-slate-400">
                      SpO2
                    </span>
                    <Activity className="h-4 w-4 text-sky-400" />
                  </div>
                  <div className="mt-2 font-mono text-3xl font-bold text-white">
                    98{' '}
                    <span className="text-xs text-slate-400 font-normal">
                      %
                    </span>
                  </div>
                  <span className="mt-1 inline-block text-[11px] text-emerald-400">
                    Optimal oxygenation
                  </span>
                </div>

                <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-4">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs uppercase text-slate-400">
                      Temperature
                    </span>
                    <Thermometer className="h-4 w-4 text-amber-400" />
                  </div>
                  <div className="mt-2 font-mono text-3xl font-bold text-white">
                    36.8{' '}
                    <span className="text-xs text-slate-400 font-normal">
                      °C
                    </span>
                  </div>
                  <span className="mt-1 inline-block text-[11px] text-emerald-400">
                    Normothermic
                  </span>
                </div>

                <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-4">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs uppercase text-slate-400">
                      Motion Status
                    </span>
                    <ShieldCheck className="h-4 w-4 text-emerald-400" />
                  </div>
                  <div className="mt-2 font-mono text-3xl font-bold text-white">
                    Active
                  </div>
                  <span className="mt-1 inline-block text-[11px] text-slate-400">
                    3-Axis motion normal
                  </span>
                </div>
              </div>

              {/* Sparkline Graphic (SVG) */}
              <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-4 space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
                  <span>
                    Continuous 24-Hour Trendline (Heart Rate &amp; SpO2)
                  </span>
                  <span>Range: 60 - 100 bpm</span>
                </div>
                <div className="h-28 w-full">
                  <svg
                    className="h-full w-full"
                    viewBox="0 0 600 100"
                    preserveAspectRatio="none"
                  >
                    {/* Grid lines */}
                    <line
                      x1="0"
                      y1="25"
                      x2="600"
                      y2="25"
                      stroke="#1e293b"
                      strokeDasharray="4 4"
                    />
                    <line
                      x1="0"
                      y1="50"
                      x2="600"
                      y2="50"
                      stroke="#1e293b"
                      strokeDasharray="4 4"
                    />
                    <line
                      x1="0"
                      y1="75"
                      x2="600"
                      y2="75"
                      stroke="#1e293b"
                      strokeDasharray="4 4"
                    />
                    {/* HR Wave */}
                    <path
                      d="M0,55 Q30,48 60,52 T120,40 T180,60 T240,45 T300,50 T360,38 T420,52 T480,48 T540,42 T600,45"
                      fill="none"
                      stroke="#0284c7"
                      strokeWidth="2.5"
                    />
                    {/* SpO2 Line */}
                    <path
                      d="M0,20 Q40,22 80,18 T160,20 T240,22 T320,19 T400,20 T480,21 T560,19 T600,20"
                      fill="none"
                      stroke="#0d9488"
                      strokeWidth="2"
                    />
                  </svg>
                </div>
                <div className="flex items-center gap-6 text-[11px] text-slate-400 font-mono pt-1">
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-brand" /> Heart
                    Rate (bpm)
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-teal-500" /> SpO2
                    (%)
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 7. ROLES SECTION */}
      <section
        id="roles"
        className="border-t border-slate-200/80 bg-slate-50/50 py-20 sm:py-28 dark:border-slate-800/80 dark:bg-slate-900/40"
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="text-center space-y-3">
            <Badge variant="bracketed">Role-Based Access</Badge>
            <h2 className="font-sans text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              Designed for the Entire Care Ecosystem
            </h2>
            <p className="mx-auto max-w-xl text-sm sm:text-base text-slate-600 dark:text-slate-400">
              Strict access segregation protects patient privacy while
              empowering clinicians and family members.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card hoverEffect>
              <CardHeader>
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400 mb-2">
                  <Heart className="h-5 w-5" />
                </div>
                <Badge variant="bracketed">Role 01</Badge>
                <CardTitle className="text-xl">Patient</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-xs text-slate-600 dark:text-slate-400">
                  <li className="flex items-start gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5 text-brand shrink-0 mt-0.5" />
                    <span>
                      Real-time personal telemetry &amp; severity history
                    </span>
                  </li>
                  <li className="flex items-start gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5 text-brand shrink-0 mt-0.5" />
                    <span>
                      Granular caregiver consent authorization &amp; revocation
                    </span>
                  </li>
                  <li className="flex items-start gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5 text-brand shrink-0 mt-0.5" />
                    <span>Preferred healthcare institution affiliation</span>
                  </li>
                </ul>
              </CardContent>
            </Card>

            <Card hoverEffect>
              <CardHeader>
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-50 text-teal-600 dark:bg-teal-950 dark:text-teal-400 mb-2">
                  <Users className="h-5 w-5" />
                </div>
                <Badge variant="bracketed">Role 02</Badge>
                <CardTitle className="text-xl">Caregiver</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-xs text-slate-600 dark:text-slate-400">
                  <li className="flex items-start gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5 text-teal-600 shrink-0 mt-0.5" />
                    <span>
                      Consent-verified access to loved one's vital trends
                    </span>
                  </li>
                  <li className="flex items-start gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5 text-teal-600 shrink-0 mt-0.5" />
                    <span>
                      Automated alerts on critical vital threshold breaches
                    </span>
                  </li>
                  <li className="flex items-start gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5 text-teal-600 shrink-0 mt-0.5" />
                    <span>
                      Audited linking requests submitted to administrators
                    </span>
                  </li>
                </ul>
              </CardContent>
            </Card>

            <Card hoverEffect>
              <CardHeader>
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400 mb-2">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <Badge variant="bracketed">Role 03</Badge>
                <CardTitle className="text-xl">Doctor</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-xs text-slate-600 dark:text-slate-400">
                  <li className="flex items-start gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5 text-indigo-600 shrink-0 mt-0.5" />
                    <span>
                      Prioritized triage queue sorted by clinical severity
                    </span>
                  </li>
                  <li className="flex items-start gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5 text-indigo-600 shrink-0 mt-0.5" />
                    <span>
                      Interactive 24h &amp; 7d telemetry history charts
                    </span>
                  </li>
                  <li className="flex items-start gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5 text-indigo-600 shrink-0 mt-0.5" />
                    <span>
                      Instant downloadable weekly PDF clinical reports
                    </span>
                  </li>
                  <li className="flex items-start gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5 text-indigo-600 shrink-0 mt-0.5" />
                    <span>
                      Admin-verified medical licensing &amp; hospital lock
                    </span>
                  </li>
                </ul>
              </CardContent>
            </Card>

            <Card hoverEffect>
              <CardHeader>
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-50 text-purple-600 dark:bg-purple-950 dark:text-purple-400 mb-2">
                  <Building2 className="h-5 w-5" />
                </div>
                <Badge variant="bracketed">Role 04</Badge>
                <CardTitle className="text-xl">Administrator</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-xs text-slate-600 dark:text-slate-400">
                  <li className="flex items-start gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5 text-purple-600 shrink-0 mt-0.5" />
                    <span>
                      Institutional entity management &amp; doctor review
                    </span>
                  </li>
                  <li className="flex items-start gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5 text-purple-600 shrink-0 mt-0.5" />
                    <span>
                      Primary doctor assignment &amp; patient transfer
                    </span>
                  </li>
                  <li className="flex items-start gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5 text-purple-600 shrink-0 mt-0.5" />
                    <span>
                      Caregiver link approval with consent policy checks
                    </span>
                  </li>
                  <li className="flex items-start gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5 text-purple-600 shrink-0 mt-0.5" />
                    <span>
                      Tamper-evident system audit log and event filtering
                    </span>
                  </li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* 8. PROCESS TIMELINE */}
      <section className="py-20 sm:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="text-center space-y-3">
            <Badge variant="bracketed">System Journey</Badge>
            <h2 className="font-sans text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              From Registration to Live Telemetry
            </h2>
            <p className="mx-auto max-w-xl text-sm sm:text-base text-slate-600 dark:text-slate-400">
              A 5-step verified pathway ensuring clinical safety and explicit
              authorization.
            </p>
          </div>

          <div className="mx-auto max-w-3xl space-y-8">
            {[
              {
                step: 'step 01',
                title: 'User Registration',
                desc: 'Patients register with institution preferences, caregivers specify link targets, and doctors submit license details.',
              },
              {
                step: 'step 02',
                title: 'Administrative Doctor Verification',
                desc: 'Admins verify medical credentials and hospital affiliation before clinical triage tools and patient records unlock.',
              },
              {
                step: 'step 03',
                title: 'Clinical Assignment',
                desc: 'Admins assign patients to verified primary physicians, creating an active clinical care relationship.',
              },
              {
                step: 'step 04',
                title: 'Caregiver Consent Verification',
                desc: 'Admins review caregiver requests, requiring secondary explicit approval from the patient before granting view rights.',
              },
              {
                step: 'step 05',
                title: 'Live Real-Time Telemetry',
                desc: 'MQTT sensor streams activate, continuously delivering automated threshold analysis and weekly summaries.',
              },
            ].map((item, index) => (
              <div key={index} className="flex gap-4 sm:gap-6 items-start">
                <div className="flex flex-col items-center">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-brand bg-white font-mono text-xs font-bold text-brand shadow-sm dark:bg-slate-900">
                    {index + 1}
                  </div>
                  {index < 4 && (
                    <div className="h-14 w-0.5 bg-slate-200 dark:bg-slate-800" />
                  )}
                </div>
                <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 flex-1">
                  <Badge variant="bracketed" size="sm">
                    {item.step}
                  </Badge>
                  <h3 className="mt-1 font-sans text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100">
                    {item.title}
                  </h3>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                    {item.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 9. STATS ROW (Strictly truthful facts only) */}
      <section className="border-y border-slate-200/80 bg-white py-16 dark:border-slate-800/80 dark:bg-slate-900/60">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
            <Stat
              value={4}
              tag="metrics"
              label="Continuous vital streams tracked"
              animate
            />
            <Stat
              value={5}
              unit="s"
              tag="frequency"
              label="Target MQTT telemetry ingest interval"
              animate
            />
            <Stat
              value={4}
              tag="roles"
              label="Granular role governance tiers"
              animate
            />
            <Stat
              value={3}
              tag="alerting"
              label="Hierarchical triage severity levels"
              animate
            />
          </div>
        </div>
      </section>

      {/* 10. FAQ ACCORDION */}
      <section id="faq" className="py-20 sm:py-28">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="text-center space-y-3">
            <Badge variant="bracketed">Questions &amp; Answers</Badge>
            <h2 className="font-sans text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              Frequently Asked Questions
            </h2>
            <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400">
              Clear information regarding architecture, security, and project
              scope.
            </p>
          </div>

          <Accordion
            type="single"
            defaultValue="faq-1"
            className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900"
          >
            <AccordionItem value="faq-1">
              <AccordionTrigger>
                What vital signs are tracked by the system?
              </AccordionTrigger>
              <AccordionContent>
                VitalGuard captures four essential biometric channels:
                continuous heart rate in beats per minute (BPM), peripheral
                blood oxygen saturation (SpO2 percentage), body temperature in
                degrees Celsius, and 3-axis accelerometer movement for posture
                and physical activity tracking.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="faq-2">
              <AccordionTrigger>
                Who has access to view patient telemetry?
              </AccordionTrigger>
              <AccordionContent>
                Only authorized roles may view patient telemetry: the patient
                themselves, their assigned verified doctor, and designated
                caregivers whose link requests have received explicit
                administrative approval and patient consent.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="faq-3">
              <AccordionTrigger>
                How does the automated alerting pipeline work?
              </AccordionTrigger>
              <AccordionContent>
                Telemetry payloads stream into analytical worker services that
                evaluate incoming measurements against clinical decision tables.
                When values exceed normal boundaries, alerts are stamped with
                Watch, Warning, or Critical severity and pushed to triage
                dashboards.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="faq-4">
              <AccordionTrigger>
                Why must doctor accounts be verified by an administrator?
              </AccordionTrigger>
              <AccordionContent>
                To maintain patient confidentiality and prevent unauthorized
                access, newly registered doctors are placed into a pending
                status. Clinical features and patient rosters remain locked
                until a system administrator reviews license numbers and
                institution affiliations.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="faq-5">
              <AccordionTrigger>
                Can caregivers view data without patient approval?
              </AccordionTrigger>
              <AccordionContent>
                No. In accordance with healthcare privacy standards, caregiver
                requests undergo a two-phase check: first approved by an
                administrator, and then explicitly consented to by the patient
                via the 'Who can see my data' portal.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="faq-6">
              <AccordionTrigger>
                Is VitalGuard a certified medical device?
              </AccordionTrigger>
              <AccordionContent>
                <strong>No.</strong> VitalGuard is an academic software
                engineering project developed by Team 27 at NITK Surathkal. It
                is not approved by regulatory bodies (such as Health Canada or
                the FDA) and must never be used for clinical diagnoses or
                life-critical medical decisions.
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </section>

      {/* 11. CLOSING CTA */}
      <section className="border-t border-slate-200/80 bg-slate-900 py-20 text-white dark:border-slate-800">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 text-center space-y-6">
          <Badge variant="bracketed" className="text-slate-400">
            Ready to Experience VitalGuard?
          </Badge>
          <h2 className="font-sans text-3xl sm:text-5xl font-extrabold tracking-tight">
            Real-time biometric vigilance, zero compromise.
          </h2>
          <p className="mx-auto max-w-xl text-sm sm:text-base text-slate-300">
            Sign up to explore patient monitoring, doctor triage queues, and
            administrative governance firsthand.
          </p>
          <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link to="/register">
              <Button variant="primary" size="lg" rollEffect>
                Create an account
              </Button>
            </Link>
            <Link to="/login">
              <Button
                variant="outline"
                size="lg"
                className="border-slate-700 bg-slate-800 text-white hover:bg-slate-700"
              >
                Sign in to dashboard
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* 12. FOOTER */}
      <footer className="border-t border-slate-200 bg-white py-16 dark:border-slate-800 dark:bg-slate-950">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {/* Column 1 */}
            <div className="space-y-4">
              <span className="font-mono text-xs uppercase tracking-wider text-slate-400">
                [{' '}
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  Explore
                </span>{' '}
                ]
              </span>
              <ul className="space-y-2 text-xs text-slate-600 dark:text-slate-400">
                <li>
                  <a href="#features" className="hover:text-brand">
                    Vitals Ingestion
                  </a>
                </li>
                <li>
                  <a href="#how-it-works" className="hover:text-brand">
                    Analytical Worker
                  </a>
                </li>
                <li>
                  <a href="#roles" className="hover:text-brand">
                    Role Workstations
                  </a>
                </li>
                <li>
                  <a href="#faq" className="hover:text-brand">
                    Frequently Asked Questions
                  </a>
                </li>
              </ul>
            </div>

            {/* Column 2 */}
            <div className="space-y-4">
              <span className="font-mono text-xs uppercase tracking-wider text-slate-400">
                [{' '}
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  System
                </span>{' '}
                ]
              </span>
              <ul className="space-y-2 text-xs text-slate-600 dark:text-slate-400">
                <li>
                  <Link to="/login" className="hover:text-brand">
                    Sign In Portal
                  </Link>
                </li>
                <li>
                  <Link to="/register" className="hover:text-brand">
                    Doctor Application
                  </Link>
                </li>
                <li>
                  <Link to="/register" className="hover:text-brand">
                    Patient Enrollment
                  </Link>
                </li>
                <li>
                  <Link to="/register" className="hover:text-brand">
                    Caregiver Portal
                  </Link>
                </li>
              </ul>
            </div>

            {/* Column 3 */}
            <div className="space-y-4">
              <span className="font-mono text-xs uppercase tracking-wider text-slate-400">
                [{' '}
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  Governance
                </span>{' '}
                ]
              </span>
              <ul className="space-y-2 text-xs text-slate-600 dark:text-slate-400">
                <li>
                  <span className="text-slate-500">
                    Institution Verification
                  </span>
                </li>
                <li>
                  <span className="text-slate-500">
                    Caregiver Consent Audit
                  </span>
                </li>
                <li>
                  <span className="text-slate-500">Tamper-Evident Logs</span>
                </li>
                <li>
                  <span className="text-slate-500">Session Controls</span>
                </li>
              </ul>
            </div>

            {/* Column 4 */}
            <div className="space-y-4">
              <span className="font-mono text-xs uppercase tracking-wider text-slate-400">
                [{' '}
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  Course Project
                </span>{' '}
                ]
              </span>
              <p className="text-xs leading-relaxed text-slate-500">
                Built by <strong>Rohan G</strong> (241IT064),{' '}
                <strong>Karan H</strong> (241IT037), and{' '}
                <strong>DM Vikas</strong> (241IT018) for the course{' '}
                <strong>IT303 — Software Engineering</strong> under the guidance
                of <strong>Prof. Jaidhar C. D.</strong>, NITK Surathkal.
              </p>
              <p className="text-[11px] leading-relaxed text-slate-400">
                VitalGuard is a student demonstration project and is not a
                certified medical device.
              </p>
            </div>
          </div>

          {/* Large Architectural Wordmark */}
          <div className="border-t border-slate-100 pt-8 dark:border-slate-800/80 flex flex-col md:flex-row items-center justify-between gap-4">
            <span className="font-sans text-2xl font-black tracking-tighter text-slate-300 dark:text-slate-800 select-none">
              VITALGUARD
            </span>
            <p className="text-xs text-slate-500 text-center md:text-right">
              © {new Date().getFullYear()} Team 27 · NITK Surathkal · IT303
              Software Engineering
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
