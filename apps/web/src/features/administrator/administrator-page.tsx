import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../../shared/auth/auth-context.js';
import { apiFetch } from '../../shared/api-fetch.js';

type Tab =
  | 'overview'
  | 'doctor-requests'
  | 'institutions'
  | 'doctors'
  | 'patients'
  | 'caregivers'
  | 'users'
  | 'audit';
type Institution = {
  id: string;
  name: string;
  type: string;
  city: string | null;
  status: string;
};
type Doctor = {
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
type Patient = {
  profile: {
    userId: string;
    assignmentStatus: string;
    preferredInstitutionId: string | null;
  };
  email: string;
  doctorIds: string[];
};
type LinkRequest = {
  request: {
    id: string;
    caregiverId: string;
    requestedPatientEmail: string | null;
    status: string;
    patientConsent: string;
  };
  caregiverEmail: string;
};
const tabs: { id: Tab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'doctor-requests', label: 'Doctor requests' },
  { id: 'institutions', label: 'Institutions' },
  { id: 'doctors', label: 'Doctors' },
  { id: 'patients', label: 'Patients' },
  { id: 'caregivers', label: 'Caregiver links' },
  { id: 'users', label: 'Users' },
  { id: 'audit', label: 'Audit log' },
];
const classes = {
  button:
    'rounded bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50',
  secondary:
    'rounded border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50',
};

export function AdministratorPage() {
  const { token } = useAuth();
  const [tab, setTab] = useState<Tab>('overview');
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState('');
  const [doctorStatus, setDoctorStatus] = useState<'approved' | 'suspended'>(
    'approved',
  );
  const [patientAssignment, setPatientAssignment] = useState<
    'unassigned' | 'assigned'
  >('unassigned');
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});
  const [overrideReasons, setOverrideReasons] = useState<
    Record<string, string>
  >({});
  const [data, setData] = useState<Record<string, unknown>>({});
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
  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    const paths: Record<Tab, string> = {
      overview: '/api/admin/overview',
      'doctor-requests': `/api/admin/doctor-requests?status=pending&page=${page}&limit=25&q=${encodeURIComponent(query)}`,
      institutions: `/api/admin/institutions?page=${page}&limit=25&q=${encodeURIComponent(query)}`,
      doctors: `/api/admin/doctors?status=${doctorStatus}&page=${page}&limit=25&q=${encodeURIComponent(query)}`,
      patients: `/api/admin/patients?assignment=${patientAssignment}&page=${page}&limit=25&q=${encodeURIComponent(query)}`,
      caregivers: `/api/admin/caregiver-requests?status=pending&page=${page}&limit=25&q=${encodeURIComponent(query)}`,
      users: `/api/admin/users?page=${page}&limit=25&q=${encodeURIComponent(query)}`,
      audit: `/api/admin/audit-log?page=${page}&limit=25&action=${encodeURIComponent(query)}`,
    };
    try {
      const response = await fetch(paths[tab], { headers });
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.message ?? 'Could not load administrator data');
      setData(result);
      if (tab === 'institutions') setInstitutions(result.items ?? []);
      if (tab === 'patients') {
        const [eligible, institutionData] = await Promise.all([
          fetch('/api/admin/doctors?status=approved&limit=100', {
            headers,
          }).then((r) => r.json()),
          fetch('/api/admin/institutions?limit=100', { headers }).then((r) =>
            r.json(),
          ),
        ]);
        setDoctors(eligible.items ?? []);
        setInstitutions(institutionData.items ?? []);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load data');
    } finally {
      setLoading(false);
    }
  }, [token, headers, tab, page, query, doctorStatus, patientAssignment]);
  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(() => setMessage(''), 4000);
    return () => window.clearTimeout(timer);
  }, [message]);
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
          ? `${result.warning} ${result.affectedDoctors} doctor(s), ${result.affectedPatients} patient(s).`
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
  async function createInstitution(event: React.FormEvent) {
    event.preventDefault();
    await action('/api/admin/institutions', 'POST', institutionForm);
    setInstitutionForm({ name: '', type: 'hospital', city: '' });
  }
  const items = (data.items ?? []) as unknown[] as Record<string, unknown>[];
  const total = Number(data.total ?? 0);
  const pages = Math.max(1, Math.ceil(total / 25));
  return (
    <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
      <aside className="rounded-xl border bg-white p-3">
        <h1 className="px-3 py-2 text-lg font-semibold">Administrator</h1>
        <nav aria-label="Administrator sections" className="mt-2 space-y-1">
          {tabs.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                setTab(item.id);
                setPage(1);
                setQuery('');
                setMessage('');
                setError('');
              }}
              className={`w-full rounded px-3 py-2 text-left text-sm ${tab === item.id ? 'bg-indigo-50 font-semibold text-indigo-800' : 'text-slate-600 hover:bg-slate-50'}`}
            >
              {item.label}
            </button>
          ))}
        </nav>
      </aside>
      <section className="min-w-0 rounded-xl border bg-white p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-2xl font-semibold">
            {tabs.find((item) => item.id === tab)?.label}
          </h2>
          <div className="flex gap-2">
            {tab === 'doctors' && (
              <select
                aria-label="Doctor status"
                value={doctorStatus}
                onChange={(e) =>
                  setDoctorStatus(e.target.value as 'approved' | 'suspended')
                }
                className="rounded border px-2 text-sm"
              >
                <option value="approved">Approved</option>
                <option value="suspended">Suspended</option>
              </select>
            )}
            {tab === 'patients' && (
              <select
                aria-label="Patient assignment"
                value={patientAssignment}
                onChange={(e) =>
                  setPatientAssignment(
                    e.target.value as 'assigned' | 'unassigned',
                  )
                }
                className="rounded border px-2 text-sm"
              >
                <option value="unassigned">Unassigned first</option>
                <option value="assigned">Assigned</option>
              </select>
            )}
            {tab !== 'overview' && (
              <input
                aria-label="Search"
                placeholder="Search"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setPage(1);
                }}
                className="rounded border px-3 py-2 text-sm"
              />
            )}
          </div>
        </div>
        {error && (
          <p
            role="alert"
            className="mt-4 rounded bg-red-50 p-3 text-sm text-red-700"
          >
            {error}
          </p>
        )}
        {message && (
          <p className="mt-4 rounded bg-green-50 p-3 text-sm text-green-700">
            {message}
          </p>
        )}
        {loading ? (
          <p className="py-10 text-slate-500">Loading…</p>
        ) : tab === 'overview' ? (
          <Overview data={data} />
        ) : tab === 'institutions' ? (
          <div className="mt-5">
            <form
              onSubmit={createInstitution}
              className="mb-5 grid gap-2 rounded bg-slate-50 p-4 sm:grid-cols-4"
            >
              <input
                required
                placeholder="Institution name"
                value={institutionForm.name}
                onChange={(e) =>
                  setInstitutionForm({
                    ...institutionForm,
                    name: e.target.value,
                  })
                }
                className="rounded border p-2 text-sm"
              />
              <select
                value={institutionForm.type}
                onChange={(e) =>
                  setInstitutionForm({
                    ...institutionForm,
                    type: e.target.value,
                  })
                }
                className="rounded border p-2 text-sm"
              >
                <option value="hospital">Hospital</option>
                <option value="clinic">Clinic</option>
                <option value="institute">Institute</option>
              </select>
              <input
                placeholder="City"
                value={institutionForm.city}
                onChange={(e) =>
                  setInstitutionForm({
                    ...institutionForm,
                    city: e.target.value,
                  })
                }
                className="rounded border p-2 text-sm"
              />
              <button className={classes.button}>Create</button>
            </form>
            <Table
              headers={['Institution', 'Type', 'City', 'Status', 'Action']}
              rows={items.map((row) => {
                const i = row as unknown as Institution;
                return [
                  i.name,
                  i.type,
                  i.city ?? '—',
                  i.status,
                  <div className="flex gap-2">
                    <button
                      className={classes.secondary}
                      onClick={() => {
                        const name = window.prompt('Institution name', i.name);
                        if (name)
                          void action(
                            `/api/admin/institutions/${i.id}`,
                            'PATCH',
                            { name },
                          );
                      }}
                    >
                      Edit
                    </button>
                    <button
                      className={classes.secondary}
                      onClick={() =>
                        void action(
                          `/api/admin/institutions/${i.id}`,
                          'PATCH',
                          {
                            status:
                              i.status === 'active' ? 'inactive' : 'active',
                          },
                        )
                      }
                    >
                      {i.status === 'active' ? 'Deactivate' : 'Activate'}
                    </button>
                  </div>,
                ];
              })}
            />
          </div>
        ) : tab === 'doctor-requests' ? (
          <Table
            headers={[
              'Doctor',
              'Institution',
              'Specialization',
              'License',
              'Action',
            ]}
            rows={items.map((row) => {
              const d = row as unknown as Doctor & {
                profile: Doctor['profile'];
                email: string;
                institutionName: string;
              };
              const approvePath = `/api/admin/doctor-requests/${d.profile.userId}/approve`;
              const rejectPath = `/api/admin/doctor-requests/${d.profile.userId}/reject`;
              return [
                d.email,
                d.institutionName,
                d.profile.specialization,
                d.profile.medicalLicenseNo ?? '—',
                <div className="flex gap-2">
                  <button
                    className={classes.button}
                    disabled={Boolean(busyActions[approvePath]) || loading}
                    onClick={() => void action(approvePath)}
                  >
                    {busyActions[approvePath] ? 'Approving…' : 'Approve'}
                  </button>
                  <button
                    className="rounded border border-red-300 px-3 py-1.5 text-sm text-red-700"
                    disabled={Boolean(busyActions[rejectPath]) || loading}
                    onClick={() => {
                      const reason = window.prompt('Reason for rejection');
                      if (reason) void action(rejectPath, 'POST', { reason });
                    }}
                  >
                    {busyActions[rejectPath] ? 'Rejecting…' : 'Reject'}
                  </button>
                </div>,
              ];
            })}
          />
        ) : tab === 'doctors' ? (
          <Table
            headers={[
              'Doctor',
              'Institution',
              'Specialization',
              'Patients',
              'Action',
            ]}
            rows={items.map((row) => {
              const d = row as unknown as Doctor;
              return [
                d.email,
                d.institutionName,
                d.profile.specialization,
                String(d.patientCount ?? 0),
                d.profile.status === 'approved' ? (
                  <button
                    className="rounded border border-red-300 px-3 py-1.5 text-sm text-red-700"
                    disabled={
                      Boolean(
                        busyActions[
                          `/api/admin/doctors/${d.profile.userId}/suspend`
                        ],
                      ) || loading
                    }
                    onClick={() => {
                      const reason = window.prompt('Reason for suspension');
                      if (reason)
                        void action(
                          `/api/admin/doctors/${d.profile.userId}/suspend`,
                          'POST',
                          { reason },
                        );
                    }}
                  >
                    Suspend
                  </button>
                ) : (
                  <button
                    className={classes.button}
                    disabled={
                      Boolean(
                        busyActions[
                          `/api/admin/doctors/${d.profile.userId}/reinstate`
                        ],
                      ) || loading
                    }
                    onClick={() =>
                      void action(
                        `/api/admin/doctors/${d.profile.userId}/reinstate`,
                      )
                    }
                  >
                    Reinstate
                  </button>
                ),
              ];
            })}
          />
        ) : tab === 'patients' ? (
          <Table
            headers={[
              'Patient',
              'Preferred institution',
              ...(patientAssignment === 'assigned' ? ['Current doctor'] : []),
              patientAssignment === 'assigned'
                ? 'Transfer to'
                : 'Assign doctor',
              'Action',
            ]}
            rows={items.map((row) => {
              const p = row as unknown as Patient;
              return [
                <div>
                  <span>{p.email}</span>
                  <label className="mt-2 flex items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      checked={Boolean(overrides[p.profile.userId])}
                      onChange={(e) =>
                        setOverrides({
                          ...overrides,
                          [p.profile.userId]: e.target.checked,
                        })
                      }
                    />
                    Override institution preference
                  </label>
                  {overrides[p.profile.userId] && (
                    <input
                      aria-label="Override reason"
                      required
                      placeholder="Reason for override"
                      value={overrideReasons[p.profile.userId] ?? ''}
                      onChange={(e) =>
                        setOverrideReasons({
                          ...overrideReasons,
                          [p.profile.userId]: e.target.value,
                        })
                      }
                      className="mt-2 w-full rounded border p-2 text-xs"
                    />
                  )}
                </div>,
                institutions.find(
                  (i) => i.id === p.profile.preferredInstitutionId,
                )?.name ?? '—',
                ...(patientAssignment === 'assigned'
                  ? [
                      <select
                        aria-label={`Current doctor for ${p.email}`}
                        value={
                          fromDoctors[p.profile.userId] ?? p.doctorIds[0] ?? ''
                        }
                        onChange={(e) =>
                          setFromDoctors({
                            ...fromDoctors,
                            [p.profile.userId]: e.target.value,
                          })
                        }
                        className="rounded border p-2 text-sm"
                      >
                        {p.doctorIds.map((id) => (
                          <option key={id} value={id}>
                            {id ===
                            doctors.find((d) => d.profile.userId === id)
                              ?.profile.userId
                              ? (doctors.find((d) => d.profile.userId === id)
                                  ?.email ?? id)
                              : id}
                          </option>
                        ))}
                      </select>,
                    ]
                  : []),
                <select
                  aria-label={`Doctor for ${p.email}`}
                  value={assignments[p.profile.userId] ?? ''}
                  onChange={(e) =>
                    setAssignments({
                      ...assignments,
                      [p.profile.userId]: e.target.value,
                    })
                  }
                  className="rounded border p-2 text-sm"
                >
                  <option value="">Select approved doctor</option>
                  {doctors
                    .filter(
                      (d) =>
                        d.profile.status === 'approved' &&
                        d.institutionStatus === 'active' &&
                        (overrides[p.profile.userId] ||
                          !p.profile.preferredInstitutionId ||
                          d.profile.institutionId ===
                            p.profile.preferredInstitutionId),
                    )
                    .map((d) => (
                      <option key={d.profile.userId} value={d.profile.userId}>
                        {d.email} · {d.institutionName}
                      </option>
                    ))}
                </select>,
                <button
                  className={classes.button}
                  disabled={
                    !assignments[p.profile.userId] ||
                    (patientAssignment === 'assigned' &&
                      ((!fromDoctors[p.profile.userId] && !p.doctorIds[0]) ||
                        (fromDoctors[p.profile.userId] ?? p.doctorIds[0]) ===
                          assignments[p.profile.userId])) ||
                    (Boolean(overrides[p.profile.userId]) &&
                      !overrideReasons[p.profile.userId])
                  }
                  onClick={() =>
                    void action(
                      patientAssignment === 'assigned'
                        ? `/api/admin/patients/${p.profile.userId}/transfer`
                        : `/api/admin/patients/${p.profile.userId}/assign-doctor`,
                      'POST',
                      patientAssignment === 'assigned'
                        ? {
                            fromDoctorId:
                              fromDoctors[p.profile.userId] ?? p.doctorIds[0],
                            toDoctorId: assignments[p.profile.userId],
                            override: Boolean(overrides[p.profile.userId]),
                            reason: overrideReasons[p.profile.userId],
                          }
                        : {
                            doctorId: assignments[p.profile.userId],
                            isPrimary: true,
                            override: Boolean(overrides[p.profile.userId]),
                            reason: overrideReasons[p.profile.userId],
                          },
                    )
                  }
                >
                  {patientAssignment === 'assigned' ? 'Transfer' : 'Assign'}
                </button>,
              ];
            })}
          />
        ) : tab === 'caregivers' ? (
          <div>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void action(
                  `/api/admin/patients/${directLink.patientId}/caregivers`,
                  'POST',
                  { caregiverId: directLink.caregiverId },
                );
              }}
              className="mt-5 grid gap-2 rounded bg-slate-50 p-4 sm:grid-cols-3"
            >
              <input
                required
                aria-label="Patient id"
                placeholder="Patient ID"
                value={directLink.patientId}
                onChange={(e) =>
                  setDirectLink({ ...directLink, patientId: e.target.value })
                }
                className="rounded border p-2 text-sm"
              />
              <input
                required
                aria-label="Caregiver id"
                placeholder="Caregiver ID"
                value={directLink.caregiverId}
                onChange={(e) =>
                  setDirectLink({ ...directLink, caregiverId: e.target.value })
                }
                className="rounded border p-2 text-sm"
              />
              <button className={classes.button}>Create direct link</button>
            </form>
            <Table
              headers={[
                'Caregiver',
                'Patient email',
                'Consent state',
                'Action',
              ]}
              rows={items.map((row) => {
                const r = row as unknown as LinkRequest;
                const approvePath = `/api/admin/caregiver-requests/${r.request.id}/approve`;
                const rejectPath = `/api/admin/caregiver-requests/${r.request.id}/reject`;
                return [
                  r.caregiverEmail,
                  r.request.requestedPatientEmail ?? '—',
                  r.request.patientConsent,
                  <div className="flex gap-2">
                    <button
                      className={classes.button}
                      disabled={Boolean(busyActions[approvePath]) || loading}
                      onClick={() => void action(approvePath)}
                    >
                      {busyActions[approvePath] ? 'Approving…' : 'Approve'}
                    </button>
                    <button
                      className="rounded border border-red-300 px-3 py-1.5 text-sm text-red-700"
                      disabled={Boolean(busyActions[rejectPath]) || loading}
                      onClick={() => {
                        const reason = window.prompt('Reason for rejection');
                        if (reason) void action(rejectPath, 'POST', { reason });
                      }}
                    >
                      {busyActions[rejectPath] ? 'Rejecting…' : 'Reject'}
                    </button>
                  </div>,
                ];
              })}
            />
          </div>
        ) : tab === 'users' ? (
          <Table
            headers={[
              'Email / ID',
              'Role',
              'Created',
              'Account status',
              'Action',
            ]}
            rows={items.map((row) => [
              <div>
                <span>{String(row.email)}</span>
                <span className="block text-xs text-slate-500">
                  {String(row.id)}
                </span>
              </div>,
              String(row.role),
              new Date(String(row.createdAt)).toLocaleDateString(),
              row.isSuspended ? 'Suspended' : 'Active',
              row.role === 'doctor' ? (
                <span className="text-xs text-slate-500">Use Doctors tab</span>
              ) : row.isSuspended ? (
                <button
                  className={classes.button}
                  onClick={() =>
                    void action(`/api/admin/users/${String(row.id)}/reinstate`)
                  }
                >
                  Reinstate
                </button>
              ) : (
                <button
                  className="rounded border border-red-300 px-3 py-1.5 text-sm text-red-700"
                  onClick={() => {
                    const reason = window.prompt('Reason for suspension');
                    if (reason)
                      void action(
                        `/api/admin/users/${String(row.id)}/suspend`,
                        'POST',
                        { reason },
                      );
                  }}
                >
                  Suspend
                </button>
              ),
            ])}
          />
        ) : (
          <Table
            headers={['When', 'Action', 'Actor', 'Target', 'Reason']}
            rows={items.map((row) => [
              new Date(String(row.createdAt)).toLocaleString(),
              String(row.action),
              String(row.actorId),
              `${String(row.targetType)} ${String(row.targetId ?? '')}`,
              String(row.reason ?? '—'),
            ])}
          />
        )}
        {tab !== 'overview' && (
          <div className="mt-5 flex items-center justify-between text-sm">
            <span>
              {total} records · page {page} of {pages}
            </span>
            <div className="flex gap-2">
              <button
                className={classes.secondary}
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Previous
              </button>
              <button
                className={classes.secondary}
                disabled={page >= pages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function Overview({ data }: { data: Record<string, unknown> }) {
  const cards: [string, unknown][] = [
    ['Pending doctors', data.pendingDoctors],
    ['Unassigned patients', data.unassignedPatients],
    ['Caregiver links', data.pendingCaregiverRequests],
    ['Active institutions', data.activeInstitutions],
  ];
  const activity =
    (data.recentActivity as
      { id: string; action: string; createdAt: string }[] | undefined) ?? [];
  return (
    <>
      <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(([label, value]) => (
          <div key={label} className="rounded-lg border bg-slate-50 p-4">
            <p className="text-sm text-slate-600">{label}</p>
            <p className="mt-2 text-3xl font-semibold">{String(value ?? 0)}</p>
          </div>
        ))}
      </div>
      <h3 className="mt-8 font-semibold">Recent activity</h3>
      {activity.length === 0 ? (
        <p className="mt-2 text-sm text-slate-500">
          No governance activity recorded yet.
        </p>
      ) : (
        <ul className="mt-2 divide-y">
          {activity.map((item) => (
            <li key={item.id} className="py-3">
              <span className="font-medium">{item.action}</span>
              <time className="ml-3 text-sm text-slate-500">
                {new Date(item.createdAt).toLocaleString()}
              </time>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
function Table({
  headers,
  rows,
}: {
  headers: string[];
  rows: React.ReactNode[][];
}) {
  if (!rows.length)
    return (
      <p className="mt-6 rounded bg-slate-50 p-8 text-center text-sm text-slate-500">
        No records found.
      </p>
    );
  return (
    <div className="mt-5 overflow-x-auto">
      <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
        <thead>
          <tr>
            {headers.map((head) => (
              <th key={head} className="px-3 py-3 font-semibold text-slate-600">
                {head}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((row, index) => (
            <tr key={index}>
              {row.map((cell, cellIndex) => (
                <td key={cellIndex} className="px-3 py-3 align-top">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
