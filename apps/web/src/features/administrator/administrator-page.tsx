import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  ShieldCheck,
  Building2,
  Users,
  UserCheck,
  FileText,
  Activity,
  Plus,
  Search,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';
import { useAuth } from '../../shared/auth/auth-context.js';
import { apiFetch } from '../../shared/api-fetch.js';
import {
  Button,
  Badge,
  Input,
  Select,
  Alert,
  Skeleton,
  EmptyState,
  Table as UITable,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '../../components/ui/index.js';

export type Tab =
  | 'overview'
  | 'doctor-requests'
  | 'institutions'
  | 'doctors'
  | 'patients'
  | 'caregivers'
  | 'users'
  | 'audit';

export type Institution = {
  id: string;
  name: string;
  type: string;
  city: string | null;
  status: string;
};

export type Doctor = {
  profile: {
    userId: string;
    status: string;
    specialization: string;
    medicalLicenseNo?: string;
    rejectionReason: string | null;
    institutionId: string;
  };
  email: string;
  institutionName: string;
  institutionStatus: string;
  patientCount?: number;
};

export type Patient = {
  profile: {
    userId: string;
    assignmentStatus: string;
    preferredInstitutionId: string | null;
  };
  email: string;
  doctorIds: string[];
  doctors: { doctorId: string; email: string; isPrimary: boolean }[];
};

export type LinkRequest = {
  request: {
    id: string;
    caregiverId: string;
    requestedPatientEmail: string | null;
    status: string;
    patientConsent: string;
  };
  caregiverEmail: string;
};

const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'overview', label: 'Overview', icon: <Activity className="h-4 w-4" /> },
  {
    id: 'doctor-requests',
    label: 'Doctor requests',
    icon: <UserCheck className="h-4 w-4" />,
  },
  {
    id: 'institutions',
    label: 'Institutions',
    icon: <Building2 className="h-4 w-4" />,
  },
  {
    id: 'doctors',
    label: 'Doctors',
    icon: <ShieldCheck className="h-4 w-4" />,
  },
  { id: 'patients', label: 'Patients', icon: <Users className="h-4 w-4" /> },
  {
    id: 'caregivers',
    label: 'Caregiver links',
    icon: <Users className="h-4 w-4" />,
  },
  { id: 'users', label: 'Users', icon: <Users className="h-4 w-4" /> },
  { id: 'audit', label: 'Audit log', icon: <FileText className="h-4 w-4" /> },
];

export function AdministratorPage() {
  const { token } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab') as Tab | null;
  const tab: Tab =
    tabParam && tabs.some((t) => t.id === tabParam) ? tabParam : 'overview';

  const [page, setPage] = useState(1);
  const [query, setQuery] = useState('');
  const [auditActor, setAuditActor] = useState('');
  const [auditAction, setAuditAction] = useState('');
  const [auditFrom, setAuditFrom] = useState('');
  const [auditTo, setAuditTo] = useState('');
  const [doctorStatus, setDoctorStatus] = useState<'approved' | 'suspended'>(
    'approved',
  );
  const [patientAssignment, setPatientAssignment] = useState<
    'all' | 'unassigned' | 'assigned'
  >('all');
  const [patientInstitution, setPatientInstitution] = useState('');
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});
  const [overrideReasons, setOverrideReasons] = useState<
    Record<string, string>
  >({});

  // Store data per tab so switching tabs never exposes stale or mismatched schemas
  const [tabData, setTabData] = useState<
    Partial<Record<Tab, Record<string, unknown>>>
  >({});
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyActions, setBusyActions] = useState<Record<string, boolean>>({});
  const pendingActions = useRef(new Set<string>());
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [institutionForm, setInstitutionForm] = useState({
    name: '',
    type: 'hospital',
    city: '',
  });
  const [assignments, setAssignments] = useState<Record<string, string>>({});
  const [fromDoctors, setFromDoctors] = useState<Record<string, string>>({});
  const [directLink, setDirectLink] = useState({
    patientId: '',
    caregiverId: '',
  });

  const headers = useMemo(
    () => ({
      Authorization: `Bearer ${token}`,
    }),
    [token],
  );

  const switchTab = useCallback(
    (nextTab: Tab) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        if (nextTab === 'overview') {
          next.delete('tab');
        } else {
          next.set('tab', nextTab);
        }
        return next;
      });
      setPage(1);
      setQuery('');
      setMessage('');
      setError('');
      setLoading(true);
    },
    [setSearchParams],
  );

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError('');

    const paths: Record<Tab, string> = {
      overview: '/api/admin/overview',
      'doctor-requests': `/api/admin/doctor-requests?status=pending&page=${page}&limit=25&q=${encodeURIComponent(query)}`,
      institutions: `/api/admin/institutions?page=${page}&limit=25&q=${encodeURIComponent(query)}`,
      doctors: `/api/admin/doctors?status=${doctorStatus}&page=${page}&limit=25&q=${encodeURIComponent(query)}`,
      patients: `/api/admin/patients?${new URLSearchParams(
        Object.fromEntries(
          Object.entries({
            assignment: patientAssignment === 'all' ? '' : patientAssignment,
            institutionId: patientInstitution,
            page: String(page),
            limit: '25',
            q: query,
          }).filter(([, value]) => value),
        ),
      )}`,
      caregivers: `/api/admin/caregiver-requests?status=pending&page=${page}&limit=25&q=${encodeURIComponent(query)}`,
      users: `/api/admin/users?page=${page}&limit=25&q=${encodeURIComponent(query)}`,
      audit: `/api/admin/audit-log?${new URLSearchParams(
        Object.fromEntries(
          Object.entries({
            page: String(page),
            limit: '25',
            q: query,
            actor: auditActor,
            action: auditAction,
            from: auditFrom,
            to: auditTo,
          }).filter(([, value]) => value),
        ),
      )}`,
    };

    try {
      const [mainRes, instRes, docRes] = await Promise.all([
        apiFetch(paths[tab], { headers }),
        tab === 'patients' || tab === 'institutions'
          ? apiFetch('/api/institutions', { headers })
          : Promise.resolve(null),
        tab === 'patients'
          ? apiFetch('/api/admin/doctors?status=approved&limit=100', {
              headers,
            })
          : Promise.resolve(null),
      ]);

      if (!mainRes.ok) throw new Error('Could not load data.');
      const mainJson = await mainRes.json();
      setTabData((prev) => ({
        ...prev,
        [tab]: mainJson && typeof mainJson === 'object' ? mainJson : {},
      }));

      if (instRes && instRes.ok) {
        const instData = await instRes.json();
        setInstitutions(
          Array.isArray(instData) ? instData : (instData?.items ?? []),
        );
      }
      if (docRes && docRes.ok) {
        const docData = await docRes.json();
        setDoctors(Array.isArray(docData?.items) ? docData.items : []);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load data.');
    } finally {
      setLoading(false);
    }
  }, [
    token,
    tab,
    page,
    query,
    doctorStatus,
    patientAssignment,
    patientInstitution,
    auditActor,
    auditAction,
    auditFrom,
    auditTo,
    headers,
  ]);

  useEffect(() => {
    void load();
  }, [load]);

  async function action(path: string, method = 'POST', body?: unknown) {
    if (pendingActions.current.has(path)) return;
    pendingActions.current.add(path);
    setBusyActions((current) => ({ ...current, [path]: true }));
    setError('');
    setMessage('');
    try {
      const response = await apiFetch(path, {
        method,
        headers,
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      const result =
        response.status === 204
          ? null
          : await response.json().catch(() => null);
      if (!response.ok) throw new Error(result?.message ?? 'Action failed');
      setMessage(
        result?.warning
          ? `${result.warning} ${result.affectedDoctors ?? 0} doctor(s), ${result.affectedPatients ?? 0} patient(s).`
          : 'Saved.',
      );
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Action failed');
    } finally {
      pendingActions.current.delete(path);
      setBusyActions((current) => ({ ...current, [path]: false }));
    }
  }

  async function createInstitution(event: FormEvent) {
    event.preventDefault();
    await action('/api/admin/institutions', 'POST', institutionForm);
    setInstitutionForm({ name: '', type: 'hospital', city: '' });
  }

  // Active tab's isolated data
  const currentData = tabData[tab] ?? {};
  const rawItems = (currentData?.items ??
    (Array.isArray(currentData) ? currentData : [])) as unknown[];
  const items = Array.isArray(rawItems)
    ? (rawItems as Record<string, unknown>[])
    : [];
  const total = Number(currentData?.total ?? items.length);
  const pages = Math.max(1, Math.ceil(total / 25));

  return (
    <div className="grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
      {/* Sidebar Navigation */}
      <aside className="rounded-2xl border border-slate-200/80 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="px-3 py-2">
          <Badge variant="bracketed" size="sm">
            Governance
          </Badge>
          <h1 className="mt-1 font-sans text-base font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Administrator
          </h1>
        </div>

        <nav aria-label="Administrator sections" className="mt-2 space-y-1">
          {tabs.map((item) => {
            const isActive = tab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => switchTab(item.id)}
                className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left font-mono text-xs uppercase tracking-wider transition-colors ${
                  isActive
                    ? 'bg-brand/10 font-bold text-brand dark:bg-brand/20 dark:text-brand-300'
                    : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
                }`}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </aside>

      {/* Main Content Area */}
      <section className="min-w-0 rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-6">
        {/* Header & Filter Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4 dark:border-slate-800">
          <div>
            <Badge variant="bracketed" size="sm">
              Workspace Area
            </Badge>
            <h2 className="mt-1 font-sans text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              {tabs.find((item) => item.id === tab)?.label}
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {tab === 'doctors' && (
              <Select
                aria-label="Doctor status"
                value={doctorStatus}
                onChange={(e) =>
                  setDoctorStatus(e.target.value as 'approved' | 'suspended')
                }
                className="w-36 py-1.5 text-xs font-mono"
                options={[
                  { label: 'Approved', value: 'approved' },
                  { label: 'Suspended', value: 'suspended' },
                ]}
              />
            )}

            {tab === 'patients' && (
              <>
                <Select
                  aria-label="Patient assignment"
                  value={patientAssignment}
                  onChange={(e) => {
                    setPatientAssignment(
                      e.target.value as 'all' | 'assigned' | 'unassigned',
                    );
                    setPage(1);
                  }}
                  className="w-36 py-1.5 text-xs font-mono"
                  options={[
                    { label: 'All patients', value: 'all' },
                    { label: 'Unassigned', value: 'unassigned' },
                    { label: 'Assigned', value: 'assigned' },
                  ]}
                />
                <Select
                  aria-label="Preferred institution"
                  value={patientInstitution}
                  onChange={(e) => {
                    setPatientInstitution(e.target.value);
                    setPage(1);
                  }}
                  className="w-44 py-1.5 text-xs"
                  options={[
                    { label: 'All institutions', value: '' },
                    ...institutions.map((i) => ({
                      label: i.name,
                      value: i.id,
                    })),
                  ]}
                />
              </>
            )}

            {tab === 'audit' && (
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  aria-label="Filter actor email or UUID"
                  placeholder="Actor (email / ID)"
                  value={auditActor}
                  onChange={(e) => {
                    setAuditActor(e.target.value);
                    setPage(1);
                  }}
                  className="w-36 py-1.5 text-xs"
                />
                <Input
                  aria-label="Filter action"
                  placeholder="Action"
                  value={auditAction}
                  onChange={(e) => {
                    setAuditAction(e.target.value);
                    setPage(1);
                  }}
                  className="w-32 py-1.5 text-xs"
                />
                <label className="flex items-center gap-1 font-mono text-xs text-slate-500">
                  From
                  <input
                    aria-label="Audit from date"
                    type="date"
                    value={auditFrom}
                    onChange={(e) => {
                      setAuditFrom(e.target.value);
                      setPage(1);
                    }}
                    className="rounded-lg border border-slate-300 px-2 py-1 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  />
                </label>
                <label className="flex items-center gap-1 font-mono text-xs text-slate-500">
                  To
                  <input
                    aria-label="Audit to date"
                    type="date"
                    value={auditTo}
                    onChange={(e) => {
                      setAuditTo(e.target.value);
                      setPage(1);
                    }}
                    className="rounded-lg border border-slate-300 px-2 py-1 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  />
                </label>
              </div>
            )}

            {tab !== 'overview' && (
              <div className="relative">
                <Input
                  aria-label="Search"
                  placeholder="Search..."
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setPage(1);
                  }}
                  leftIcon={<Search className="h-3.5 w-3.5" />}
                  className="w-48 py-1.5 text-xs"
                />
              </div>
            )}
          </div>
        </div>

        {/* Feedback Banners */}
        {error && (
          <Alert variant="error" title="Error" onClose={() => setError('')}>
            <div className="flex items-center justify-between gap-4">
              <span>{error}</span>
              <Button
                size="sm"
                variant="outline"
                onClick={() => void load()}
                icon={<RefreshCw className="h-3.5 w-3.5" />}
              >
                Retry
              </Button>
            </div>
          </Alert>
        )}

        {message && (
          <Alert
            variant="success"
            title="Success"
            onClose={() => setMessage('')}
          >
            {message}
          </Alert>
        )}

        {/* Tab Contents with Loading Skeletons & Inline Error Recovery */}
        {loading ? (
          <div className="space-y-4 py-4 animate-pulse">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
          </div>
        ) : error && items.length === 0 && tab !== 'overview' ? (
          <div className="my-8 flex flex-col items-center justify-center p-6 text-center">
            <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-rose-50 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <h3 className="font-sans text-base font-bold text-slate-900 dark:text-slate-100">
              Unable to load {tabs.find((t) => t.id === tab)?.label}
            </h3>
            <p className="mt-1 max-w-sm text-xs text-slate-500 dark:text-slate-400">
              {error}
            </p>
            <div className="mt-4">
              <Button
                size="sm"
                variant="primary"
                onClick={() => void load()}
                icon={<RefreshCw className="h-3.5 w-3.5" />}
              >
                Retry
              </Button>
            </div>
          </div>
        ) : tab === 'overview' ? (
          <Overview data={currentData} />
        ) : tab === 'institutions' ? (
          <div className="space-y-6">
            <form
              onSubmit={createInstitution}
              className="grid gap-3 rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-800/40 sm:grid-cols-4 items-end"
            >
              <Input
                required
                label="Institution name"
                placeholder="e.g. Memorial Hospital"
                value={institutionForm.name}
                onChange={(e) =>
                  setInstitutionForm({
                    ...institutionForm,
                    name: e.target.value,
                  })
                }
              />
              <Select
                label="Type"
                value={institutionForm.type}
                onChange={(e) =>
                  setInstitutionForm({
                    ...institutionForm,
                    type: e.target.value,
                  })
                }
                options={[
                  { label: 'Hospital', value: 'hospital' },
                  { label: 'Clinic', value: 'clinic' },
                  { label: 'Institute', value: 'institute' },
                ]}
              />
              <Input
                label="City"
                placeholder="City (optional)"
                value={institutionForm.city}
                onChange={(e) =>
                  setInstitutionForm({
                    ...institutionForm,
                    city: e.target.value,
                  })
                }
              />
              <Button
                type="submit"
                variant="primary"
                icon={<Plus className="h-3.5 w-3.5" />}
              >
                Create
              </Button>
            </form>

            <AdminTable
              headers={['Institution', 'Type', 'City', 'Status', 'Action']}
              rows={items
                .map((row) => {
                  const i = row as unknown as Partial<Institution>;
                  if (!i || typeof i !== 'object') return [];
                  return [
                    <span className="font-medium text-slate-900 dark:text-slate-100">
                      {i.name ?? '—'}
                    </span>,
                    <span className="capitalize font-mono text-xs text-slate-600 dark:text-slate-400">
                      {i.type ?? '—'}
                    </span>,
                    <span className="text-slate-500">{i.city ?? '—'}</span>,
                    <Badge variant={i.status === 'active' ? 'teal' : 'default'}>
                      {i.status ?? 'unknown'}
                    </Badge>,
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={!i.id}
                        onClick={() => {
                          const name = window.prompt(
                            'Institution name',
                            i.name ?? '',
                          );
                          if (name && i.id) {
                            void action(
                              `/api/admin/institutions/${i.id}`,
                              'PATCH',
                              { name },
                            );
                          }
                        }}
                      >
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={!i.id}
                        onClick={() => {
                          if (!i.id) return;
                          void action(
                            `/api/admin/institutions/${i.id}`,
                            'PATCH',
                            {
                              status:
                                i.status === 'active' ? 'inactive' : 'active',
                            },
                          );
                        }}
                      >
                        {i.status === 'active' ? 'Deactivate' : 'Activate'}
                      </Button>
                    </div>,
                  ];
                })
                .filter((r) => r.length > 0)}
            />
          </div>
        ) : tab === 'doctor-requests' ? (
          <AdminTable
            headers={[
              'Doctor',
              'Institution',
              'Specialization',
              'License',
              'Action',
            ]}
            rows={items
              .map((row) => {
                const d = row as unknown as Partial<Doctor> & {
                  profile?: Partial<Doctor['profile']>;
                  email?: string;
                  institutionName?: string;
                };
                if (!d || typeof d !== 'object' || !d.profile?.userId)
                  return [];
                const approvePath = `/api/admin/doctor-requests/${d.profile.userId}/approve`;
                const rejectPath = `/api/admin/doctor-requests/${d.profile.userId}/reject`;
                return [
                  <span className="font-medium text-slate-900 dark:text-slate-100">
                    {d.email ?? '—'}
                  </span>,
                  <span className="text-slate-600 dark:text-slate-400">
                    {d.institutionName ?? '—'}
                  </span>,
                  <span>{d.profile.specialization ?? '—'}</span>,
                  <span className="font-mono text-xs text-slate-500">
                    {d.profile.medicalLicenseNo ?? '—'}
                  </span>,
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="primary"
                      disabled={Boolean(busyActions[approvePath]) || loading}
                      onClick={() => void action(approvePath)}
                    >
                      {busyActions[approvePath] ? 'Approving…' : 'Approve'}
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      disabled={Boolean(busyActions[rejectPath]) || loading}
                      onClick={() => {
                        const reason = window.prompt('Reason for rejection');
                        if (reason) void action(rejectPath, 'POST', { reason });
                      }}
                    >
                      {busyActions[rejectPath] ? 'Rejecting…' : 'Reject'}
                    </Button>
                  </div>,
                ];
              })
              .filter((r) => r.length > 0)}
          />
        ) : tab === 'doctors' ? (
          <AdminTable
            headers={[
              'Doctor',
              'Institution',
              'Specialization',
              'Patients',
              'Action',
            ]}
            rows={items
              .map((row) => {
                const d = row as unknown as Partial<Doctor> & {
                  profile?: Partial<Doctor['profile']>;
                  email?: string;
                  institutionName?: string;
                  patientCount?: number;
                };
                if (!d || typeof d !== 'object' || !d.profile?.userId)
                  return [];
                return [
                  <span className="font-medium text-slate-900 dark:text-slate-100">
                    {d.email ?? '—'}
                  </span>,
                  <span className="text-slate-600 dark:text-slate-400">
                    {d.institutionName ?? '—'}
                  </span>,
                  <span>{d.profile.specialization ?? '—'}</span>,
                  <span className="font-mono text-xs font-semibold">
                    {String(d.patientCount ?? 0)}
                  </span>,
                  d.profile.status === 'approved' ? (
                    <Button
                      size="sm"
                      variant="danger"
                      disabled={
                        Boolean(
                          busyActions[
                            `/api/admin/doctors/${d.profile.userId}/suspend`
                          ],
                        ) || loading
                      }
                      onClick={() => {
                        const reason = window.prompt('Reason for suspension');
                        if (reason && d.profile?.userId) {
                          void action(
                            `/api/admin/doctors/${d.profile.userId}/suspend`,
                            'POST',
                            { reason },
                          );
                        }
                      }}
                    >
                      Suspend
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="primary"
                      disabled={
                        Boolean(
                          busyActions[
                            `/api/admin/doctors/${d.profile.userId}/reinstate`
                          ],
                        ) || loading
                      }
                      onClick={() => {
                        if (d.profile?.userId) {
                          void action(
                            `/api/admin/doctors/${d.profile.userId}/reinstate`,
                          );
                        }
                      }}
                    >
                      Reinstate
                    </Button>
                  ),
                ];
              })
              .filter((r) => r.length > 0)}
          />
        ) : tab === 'patients' ? (
          <AdminTable
            headers={[
              'Patient',
              'Preferred institution',
              'Current doctor(s)',
              'Device & Simulation',
              'Assign / transfer to',
              'Action',
            ]}
            rows={items
              .map((row) => {
                const p = row as unknown as Partial<Patient> & {
                  profile?: Partial<Patient['profile']>;
                  email?: string;
                  doctors?: {
                    doctorId: string;
                    email: string;
                    isPrimary: boolean;
                  }[];
                  doctorIds?: string[];
                  device?: {
                    id: string;
                    isSimulated: boolean;
                    simScenario: 'normal' | 'deteriorating' | 'noisy';
                    registrationStatus: string;
                  } | null;
                };
                if (!p || typeof p !== 'object' || !p.profile?.userId)
                  return [];
                const patientUserId = p.profile.userId;
                const assigned = p.profile.assignmentStatus === 'assigned';
                const pDoctors = Array.isArray(p.doctors) ? p.doctors : [];
                const sourceDoctor =
                  fromDoctors[patientUserId] ??
                  pDoctors.find((doctor) => doctor.isPrimary)?.doctorId ??
                  pDoctors[0]?.doctorId ??
                  '';
                const assignmentPath = assigned
                  ? `/api/admin/patients/${patientUserId}/transfer`
                  : `/api/admin/patients/${patientUserId}/assign-doctor`;

                return [
                  <div>
                    <span className="font-medium text-slate-900 dark:text-slate-100">
                      {p.email ?? '—'}
                    </span>
                    <label className="mt-2 flex items-center gap-2 font-mono text-[11px] text-slate-500">
                      <input
                        type="checkbox"
                        checked={Boolean(overrides[patientUserId])}
                        onChange={(e) =>
                          setOverrides({
                            ...overrides,
                            [patientUserId]: e.target.checked,
                          })
                        }
                        className="rounded border-slate-300 text-brand focus:ring-brand"
                      />
                      Override institution preference
                    </label>
                    {overrides[patientUserId] && (
                      <Input
                        aria-label="Override reason"
                        required
                        placeholder="Reason for override"
                        value={overrideReasons[patientUserId] ?? ''}
                        onChange={(e) =>
                          setOverrideReasons({
                            ...overrideReasons,
                            [patientUserId]: e.target.value,
                          })
                        }
                        className="mt-2 text-xs py-1"
                      />
                    )}
                  </div>,
                  institutions.find(
                    (i) => i.id === p.profile?.preferredInstitutionId,
                  )?.name ?? '—',
                  <div className="min-w-48 space-y-2">
                    {pDoctors.length === 0 ? (
                      <span className="font-mono text-xs text-slate-400">
                        Unassigned
                      </span>
                    ) : (
                      pDoctors.map((doctor) => {
                        const unlinkPath = `/api/admin/patients/${patientUserId}/doctors/${doctor.doctorId}`;
                        return (
                          <div
                            key={doctor.doctorId}
                            className="flex items-center justify-between text-xs"
                          >
                            <div className="flex items-center gap-1.5">
                              <span>{doctor.email}</span>
                              {doctor.isPrimary && (
                                <Badge variant="bracketed" size="sm">
                                  Primary
                                </Badge>
                              )}
                            </div>
                            <button
                              className="text-xs text-rose-600 hover:underline disabled:opacity-50 ml-2"
                              disabled={
                                Boolean(busyActions[unlinkPath]) || loading
                              }
                              onClick={() => void action(unlinkPath, 'DELETE')}
                            >
                              {busyActions[unlinkPath]
                                ? 'Unassigning…'
                                : 'Unassign'}
                            </button>
                          </div>
                        );
                      })
                    )}
                    {assigned && pDoctors.length > 1 && (
                      <select
                        aria-label={`Current doctor for ${p.email ?? 'patient'}`}
                        value={sourceDoctor}
                        onChange={(e) =>
                          setFromDoctors({
                            ...fromDoctors,
                            [patientUserId]: e.target.value,
                          })
                        }
                        className="w-full rounded-xl border border-slate-300 bg-white p-1 text-xs dark:border-slate-700 dark:bg-slate-900"
                      >
                        {pDoctors.map((doctor) => (
                          <option key={doctor.doctorId} value={doctor.doctorId}>
                            Transfer from: {doctor.email}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>,
                  p.device ? (
                    <div className="min-w-44 space-y-1.5 text-xs">
                      <div className="flex items-center gap-1.5">
                        <span
                          className="font-mono text-[11px] text-slate-500"
                          title={p.device.id}
                        >
                          {p.device.id.slice(0, 8)}…
                        </span>
                        {p.device.isSimulated ? (
                          <Badge
                            variant="bracketed"
                            size="sm"
                            className="border-amber-300 text-amber-700 dark:border-amber-700 dark:text-amber-400"
                          >
                            Simulated
                          </Badge>
                        ) : (
                          <Badge
                            variant="bracketed"
                            size="sm"
                            className="border-emerald-300 text-emerald-700 dark:border-emerald-700 dark:text-emerald-400"
                          >
                            Hardware
                          </Badge>
                        )}
                      </div>
                      {p.device.isSimulated && (
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-[11px] text-slate-500">
                            Scenario:
                          </span>
                          <select
                            aria-label={`Scenario for ${p.email ?? 'patient'}`}
                            value={p.device.simScenario ?? 'normal'}
                            disabled={
                              Boolean(
                                busyActions[
                                  `/api/admin/devices/${p.device.id}`
                                ],
                              ) || loading
                            }
                            onChange={(e) => {
                              const nextScenario = e.target.value as
                                'normal' | 'deteriorating' | 'noisy';
                              void action(
                                `/api/admin/devices/${p.device!.id}`,
                                'PATCH',
                                { scenario: nextScenario },
                              );
                            }}
                            className="rounded-lg border border-slate-300 bg-white px-2 py-0.5 font-mono text-xs dark:border-slate-700 dark:bg-slate-900"
                          >
                            <option value="normal">Normal</option>
                            <option value="deteriorating">Deteriorating</option>
                            <option value="noisy">Noisy</option>
                          </select>
                        </div>
                      )}
                    </div>
                  ) : (
                    <span className="font-mono text-xs text-slate-400">
                      No device
                    </span>
                  ),
                  <select
                    aria-label={`Doctor for ${p.email ?? 'patient'}`}
                    value={assignments[patientUserId] ?? ''}
                    onChange={(e) =>
                      setAssignments({
                        ...assignments,
                        [patientUserId]: e.target.value,
                      })
                    }
                    className="rounded-xl border border-slate-300 bg-white p-2 text-xs dark:border-slate-700 dark:bg-slate-900"
                  >
                    <option value="">Select approved doctor</option>
                    {doctors
                      .filter(
                        (d) =>
                          d.profile?.status === 'approved' &&
                          d.institutionStatus === 'active' &&
                          (overrides[patientUserId] ||
                            !p.profile?.preferredInstitutionId ||
                            d.profile?.institutionId ===
                              p.profile?.preferredInstitutionId),
                      )
                      .map((d) => (
                        <option key={d.profile.userId} value={d.profile.userId}>
                          {d.email} · {d.institutionName}
                        </option>
                      ))}
                  </select>,
                  <Button
                    size="sm"
                    variant="primary"
                    disabled={
                      !assignments[patientUserId] ||
                      (assigned &&
                        (!sourceDoctor ||
                          sourceDoctor === assignments[patientUserId])) ||
                      (Boolean(overrides[patientUserId]) &&
                        !overrideReasons[patientUserId]) ||
                      Boolean(busyActions[assignmentPath]) ||
                      loading
                    }
                    onClick={() =>
                      void action(
                        assignmentPath,
                        'POST',
                        assigned
                          ? {
                              fromDoctorId: sourceDoctor,
                              toDoctorId: assignments[patientUserId],
                              override: Boolean(overrides[patientUserId]),
                              reason: overrideReasons[patientUserId],
                            }
                          : {
                              doctorId: assignments[patientUserId],
                              isPrimary: true,
                              override: Boolean(overrides[patientUserId]),
                              reason: overrideReasons[patientUserId],
                            },
                      )
                    }
                  >
                    {busyActions[assignmentPath]
                      ? assigned
                        ? 'Transferring…'
                        : 'Assigning…'
                      : assigned
                        ? 'Transfer'
                        : 'Assign'}
                  </Button>,
                ];
              })
              .filter((r) => r.length > 0)}
          />
        ) : tab === 'caregivers' ? (
          <div className="space-y-6">
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void action(
                  `/api/admin/patients/${directLink.patientId}/caregivers`,
                  'POST',
                  {
                    caregiverId: directLink.caregiverId,
                  },
                );
              }}
              className="grid gap-3 rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-800/40 sm:grid-cols-3 items-end"
            >
              <Input
                required
                aria-label="Patient id"
                label="Patient ID"
                placeholder="UUID"
                value={directLink.patientId}
                onChange={(e) =>
                  setDirectLink({ ...directLink, patientId: e.target.value })
                }
              />
              <Input
                required
                aria-label="Caregiver id"
                label="Caregiver ID"
                placeholder="UUID"
                value={directLink.caregiverId}
                onChange={(e) =>
                  setDirectLink({ ...directLink, caregiverId: e.target.value })
                }
              />
              <Button type="submit" variant="primary">
                Create direct link
              </Button>
            </form>

            <AdminTable
              headers={[
                'Caregiver',
                'Patient email',
                'Consent state',
                'Action',
              ]}
              rows={items
                .map((row) => {
                  const r = row as unknown as Partial<LinkRequest> & {
                    request?: Partial<LinkRequest['request']>;
                    caregiverEmail?: string;
                  };
                  if (!r || typeof r !== 'object' || !r.request?.id) return [];
                  const approvePath = `/api/admin/caregiver-requests/${r.request.id}/approve`;
                  const rejectPath = `/api/admin/caregiver-requests/${r.request.id}/reject`;
                  return [
                    <span className="font-medium text-slate-900 dark:text-slate-100">
                      {r.caregiverEmail ?? '—'}
                    </span>,
                    <span className="text-slate-600 dark:text-slate-400">
                      {r.request.requestedPatientEmail ?? '—'}
                    </span>,
                    <Badge variant="bracketed" size="sm">
                      {r.request.patientConsent ?? 'pending'}
                    </Badge>,
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="primary"
                        disabled={Boolean(busyActions[approvePath]) || loading}
                        onClick={() => void action(approvePath)}
                      >
                        {busyActions[approvePath] ? 'Approving…' : 'Approve'}
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        disabled={Boolean(busyActions[rejectPath]) || loading}
                        onClick={() => {
                          const reason = window.prompt('Reason for rejection');
                          if (reason)
                            void action(rejectPath, 'POST', { reason });
                        }}
                      >
                        {busyActions[rejectPath] ? 'Rejecting…' : 'Reject'}
                      </Button>
                    </div>,
                  ];
                })
                .filter((r) => r.length > 0)}
            />
          </div>
        ) : tab === 'users' ? (
          <AdminTable
            headers={[
              'Email / ID',
              'Role',
              'Created',
              'Account status',
              'Action',
            ]}
            rows={items
              .map((row) => {
                if (!row || typeof row !== 'object' || !row.id) return [];
                const userId = String(row.id);
                const email = String(row.email ?? '—');
                const role = String(row.role ?? '—');
                const createdAt = row.createdAt
                  ? new Date(String(row.createdAt)).toLocaleDateString()
                  : '—';
                const isSuspended = Boolean(row.isSuspended);
                return [
                  <div>
                    <span className="font-medium text-slate-900 dark:text-slate-100">
                      {email}
                    </span>
                    <span className="block font-mono text-xs text-slate-400">
                      {shortId(userId)}
                    </span>
                  </div>,
                  <Badge variant="bracketed" size="sm">
                    {role}
                  </Badge>,
                  <span className="font-mono text-xs text-slate-500">
                    {createdAt}
                  </span>,
                  <Badge variant={isSuspended ? 'outline' : 'teal'}>
                    {isSuspended ? 'Suspended' : 'Active'}
                  </Badge>,
                  role === 'doctor' ? (
                    <span className="font-mono text-xs text-slate-400">
                      Use Doctors tab
                    </span>
                  ) : isSuspended ? (
                    <Button
                      size="sm"
                      variant="primary"
                      onClick={() =>
                        void action(`/api/admin/users/${userId}/reinstate`)
                      }
                    >
                      Reinstate
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() => {
                        const reason = window.prompt('Reason for suspension');
                        if (reason) {
                          void action(
                            `/api/admin/users/${userId}/suspend`,
                            'POST',
                            { reason },
                          );
                        }
                      }}
                    >
                      Suspend
                    </Button>
                  ),
                ];
              })
              .filter((r) => r.length > 0)}
          />
        ) : (
          <AdminTable
            headers={['When', 'Action', 'Actor', 'Target', 'Reason']}
            rows={items
              .map((row) => {
                if (!row || typeof row !== 'object') return [];
                const actionLabel = formatAuditAction(String(row.action ?? ''));
                const when = row.createdAt
                  ? new Date(String(row.createdAt)).toLocaleString()
                  : '—';
                return [
                  <span className="font-mono text-xs text-slate-500">
                    {when}
                  </span>,
                  <div title={String(row.action ?? '')}>
                    <span className="font-semibold text-slate-900 dark:text-slate-100">
                      {actionLabel}
                    </span>
                    <span className="block font-mono text-[11px] text-slate-400">
                      {String(row.action ?? '—')}
                    </span>
                  </div>,
                  <div>
                    <span className="text-slate-800 dark:text-slate-200">
                      {String(row.actorEmail ?? 'Unknown actor')}
                    </span>
                    {typeof row.actorRole === 'string' && (
                      <span className="block font-mono text-[11px] text-slate-400">
                        {String(row.actorRole)}
                      </span>
                    )}
                    <span className="block font-mono text-[10px] text-slate-400">
                      {shortId(row.actorId)}
                    </span>
                  </div>,
                  <div>
                    <span className="text-slate-800 dark:text-slate-200">
                      {String(row.targetLabel ?? row.targetId ?? '—')}
                    </span>
                    {typeof row.targetId === 'string' && (
                      <span className="block font-mono text-[10px] text-slate-400">
                        {shortId(row.targetId)}
                      </span>
                    )}
                    <details className="mt-1 text-xs">
                      <summary className="cursor-pointer text-brand hover:underline font-mono">
                        Details
                      </summary>
                      <pre className="mt-1 max-w-xs overflow-auto whitespace-pre-wrap rounded-xl border border-slate-200 bg-slate-50 p-2 font-mono text-[11px] text-slate-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">
                        {JSON.stringify(
                          { before: row.before, after: row.after },
                          null,
                          2,
                        )}
                      </pre>
                    </details>
                  </div>,
                  <span className="text-xs text-slate-600 dark:text-slate-400">
                    {String(row.reason ?? '—')}
                  </span>,
                ];
              })
              .filter((r) => r.length > 0)}
          />
        )}

        {/* Pagination Bar */}
        {tab !== 'overview' && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-slate-100 pt-4 dark:border-slate-800 text-xs">
            <span className="font-mono text-slate-500">
              {total} records · page {page} of {pages}
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= pages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function shortId(value: unknown) {
  return typeof value === 'string' ? value.slice(0, 8) : '—';
}

function formatAuditAction(action: string) {
  const known: Record<string, string> = {
    'patient.assign_doctor': 'Assigned doctor',
    'patient.transfer': 'Transferred patient',
    'patient.unassign_doctor': 'Unassigned doctor',
    'doctor.approve': 'Approved doctor',
    'doctor.reject': 'Rejected doctor',
    'doctor.suspend': 'Suspended doctor',
    'doctor.reinstate': 'Reinstated doctor',
  };
  return (
    known[action] ??
    action.replace(/[._]/g, ' ').replace(/^\w/, (c) => c.toUpperCase())
  );
}

function Overview({ data }: { data: Record<string, unknown> }) {
  const cards: [string, unknown, React.ReactNode][] = [
    [
      'Pending doctors',
      data?.pendingDoctors,
      <UserCheck className="h-5 w-5 text-brand" />,
    ],
    [
      'Unassigned patients',
      data?.unassignedPatients,
      <AlertTriangle className="h-5 w-5 text-amber-500" />,
    ],
    [
      'Caregiver links',
      data?.pendingCaregiverRequests,
      <Users className="h-5 w-5 text-teal-600" />,
    ],
    [
      'Active institutions',
      data?.activeInstitutions,
      <Building2 className="h-5 w-5 text-indigo-500" />,
    ],
  ];
  const rawActivity = data?.recentActivity;
  const activity = Array.isArray(rawActivity)
    ? (rawActivity as { id: string; action: string; createdAt: string }[])
    : [];

  return (
    <div className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(([label, value, icon]) => (
          <div
            key={label}
            className="flex flex-col justify-between rounded-2xl border border-slate-200/80 bg-slate-50/50 p-5 dark:border-slate-800 dark:bg-slate-800/40"
          >
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs uppercase tracking-wider text-slate-500">
                {label}
              </span>
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-white shadow-sm dark:bg-slate-900">
                {icon}
              </div>
            </div>
            <p className="mt-4 font-mono text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              {String(value ?? 0)}
            </p>
          </div>
        ))}
      </div>

      <div className="space-y-3">
        <h3 className="font-sans text-base font-bold text-slate-900 dark:text-slate-100">
          Recent Activity
        </h3>
        {activity.length === 0 ? (
          <EmptyState
            title="No activity recorded"
            description="Recent governance actions will appear here once executed."
          />
        ) : (
          <ul className="divide-y divide-slate-100 rounded-2xl border border-slate-200/80 bg-white p-2 dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
            {activity.map((item) => (
              <li
                key={item.id}
                className="flex items-center justify-between p-3 text-xs"
              >
                <span className="font-medium text-slate-800 dark:text-slate-200">
                  {item.action}
                </span>
                <time className="font-mono text-slate-400">
                  {item.createdAt
                    ? new Date(item.createdAt).toLocaleString()
                    : '—'}
                </time>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function AdminTable({
  headers,
  rows,
}: {
  headers: string[];
  rows: React.ReactNode[][];
}) {
  if (!rows.length) {
    return (
      <EmptyState
        title="No records found"
        description="Try adjusting your search criteria or filter options."
      />
    );
  }

  return (
    <UITable>
      <TableHeader>
        <TableRow>
          {headers.map((head) => (
            <TableHead key={head}>{head}</TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row, index) => (
          <TableRow key={index}>
            {row.map((cell, cellIndex) => (
              <TableCell key={cellIndex}>{cell}</TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </UITable>
  );
}
