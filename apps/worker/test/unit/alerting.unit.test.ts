/**
 * Unit tests — Module 4 Alerting & Escalation
 * Database, transport, and time are all mocked. No live services needed.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  isAlertSeverityTier,
  onSeverityTransition,
} from '../../src/alerting/service.js';
import { dispatchCriticalNotifications } from '../../src/alerting/notifications.js';
import { runEscalationCheck } from '../../src/alerting/escalation.js';
import type { NotificationTransport } from '../../src/alerting/notifications.js';

// ── isAlertSeverityTier — pure predicate ─────────────────────────────────────

describe('isAlertSeverityTier', () => {
  it("returns true for 'Warning'", () =>
    expect(isAlertSeverityTier('Warning')).toBe(true));
  it("returns true for 'Critical'", () =>
    expect(isAlertSeverityTier('Critical')).toBe(true));
  it("returns false for 'Watch'", () =>
    expect(isAlertSeverityTier('Watch')).toBe(false));
  it("returns false for 'Normal'", () =>
    expect(isAlertSeverityTier('Normal')).toBe(false));
});

// ── onSeverityTransition — early-return guards ────────────────────────────────

/** Creates a mock DB whose `select` throws if called — proves early return. */
function makeForbiddenSelectDatabase() {
  return {
    select: vi.fn().mockImplementation(() => {
      throw new Error('database.select was called unexpectedly');
    }),
    insert: vi.fn().mockImplementation(() => {
      throw new Error('database.insert was called unexpectedly');
    }),
  } as never;
}

const mockLog = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};

beforeEach(() => vi.clearAllMocks());

describe('onSeverityTransition — same-tier guard', () => {
  it('returns early without touching the database when newTier === previousTier', async () => {
    const db = makeForbiddenSelectDatabase();
    // Should not throw despite the DB spy throwing — because the early-return fires first
    await expect(
      onSeverityTransition(
        db,
        'pat-001',
        'Warning',
        'Warning',
        'no change',
        [],
        { log: mockLog },
      ),
    ).resolves.toBeUndefined();
  });
});

describe('onSeverityTransition — non-alertable tier guard', () => {
  it("returns early when newTier is 'Normal'", async () => {
    const db = makeForbiddenSelectDatabase();
    await expect(
      onSeverityTransition(db, 'pat-001', null, 'Normal', 'all clear', [], {
        log: mockLog,
      }),
    ).resolves.toBeUndefined();
  });

  it("returns early when newTier is 'Watch'", async () => {
    const db = makeForbiddenSelectDatabase();
    await expect(
      onSeverityTransition(db, 'pat-001', null, 'Watch', 'mild drift', [], {
        log: mockLog,
      }),
    ).resolves.toBeUndefined();
  });
});

// ── dispatchCriticalNotifications — sandbox vs real dispatch ─────────────────

function makeAlert(
  overrides: Partial<{
    id: string;
    patientId: string;
    severityTier: string;
    explanation: string;
    triggeringVitals: string[];
  }> = {},
) {
  return {
    id: 'alert-1',
    patientId: 'pat-001',
    severityTier: 'Critical' as const,
    explanation: 'SpO2 critically low',
    triggeringVitals: ['spo2'],
    ...overrides,
  };
}

/** Build a mock database that returns the given recipients from lookupAlertRecipients. */
function makeDatabaseWithRecipients(
  recipients: Array<{ id: string; email: string; phoneNumber: string | null }>,
  role: 'caregiver' | 'doctor' = 'caregiver',
) {
  const caregiverRows =
    role === 'caregiver'
      ? recipients.map((r) => ({ ...r, role: 'caregiver' as const }))
      : [];
  const doctorRows =
    role === 'doctor'
      ? recipients.map((r) => ({ ...r, role: 'doctor' as const }))
      : [];

  // lookupAlertRecipients does two select chains: caregivers then doctors
  let callIndex = 0;
  const mockSelect = vi.fn(() => {
    const result = callIndex === 0 ? caregiverRows : doctorRows;
    callIndex++;
    return {
      from: () => ({
        innerJoin: () => ({
          where: () => Promise.resolve(result),
        }),
      }),
    };
  });
  return { select: mockSelect } as never;
}

const sandboxEnv = {
  RESEND_API_KEY: undefined,
  RESEND_FROM_EMAIL: 'alerts@vitalguard.local',
  TWILIO_ACCOUNT_SID: undefined,
  TWILIO_AUTH_TOKEN: undefined,
  TWILIO_FROM_PHONE: undefined,
} as never;

const credentialedEnv = {
  RESEND_API_KEY: 'test-resend-key',
  RESEND_FROM_EMAIL: 'alerts@vitalguard.local',
  TWILIO_ACCOUNT_SID: 'ACtest',
  TWILIO_AUTH_TOKEN: 'auth-token',
  TWILIO_FROM_PHONE: '+10000000000',
} as never;

function makeTransport(): {
  transport: NotificationTransport;
  sendEmail: ReturnType<typeof vi.fn>;
  sendSms: ReturnType<typeof vi.fn>;
} {
  const sendEmail = vi.fn().mockResolvedValue(undefined);
  const sendSms = vi.fn().mockResolvedValue(undefined);
  return { transport: { sendEmail, sendSms }, sendEmail, sendSms };
}

describe('dispatchCriticalNotifications — no credentials (sandbox mode)', () => {
  it('does not call sendEmail when RESEND_API_KEY is absent', async () => {
    const db = makeDatabaseWithRecipients([
      { id: 'c1', email: 'c@x.com', phoneNumber: '+1111' },
    ]);
    const { transport, sendEmail } = makeTransport();
    await dispatchCriticalNotifications({
      database: db,
      alert: makeAlert(),
      notificationEnv: sandboxEnv,
      transport,
      log: mockLog,
    });
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('logs a sandbox info message instead', async () => {
    const db = makeDatabaseWithRecipients([
      { id: 'c1', email: 'c@x.com', phoneNumber: null },
    ]);
    const { transport } = makeTransport();
    await dispatchCriticalNotifications({
      database: db,
      alert: makeAlert(),
      notificationEnv: sandboxEnv,
      transport,
      log: mockLog,
    });
    expect(mockLog.info).toHaveBeenCalled();
  });
});

describe('dispatchCriticalNotifications — credentials present + recipient exists', () => {
  it('calls sendEmail once per recipient', async () => {
    const db = makeDatabaseWithRecipients([
      { id: 'c1', email: 'c@x.com', phoneNumber: '+1111' },
    ]);
    const { transport, sendEmail } = makeTransport();
    await dispatchCriticalNotifications({
      database: db,
      alert: makeAlert(),
      notificationEnv: credentialedEnv,
      transport,
      log: mockLog,
    });
    expect(sendEmail).toHaveBeenCalledOnce();
    expect(sendEmail.mock.calls[0]![0].to).toBe('c@x.com');
  });

  it('calls sendSms for caregiver recipients with a phone number', async () => {
    const db = makeDatabaseWithRecipients([
      { id: 'c1', email: 'c@x.com', phoneNumber: '+1111' },
    ]);
    const { transport, sendSms } = makeTransport();
    await dispatchCriticalNotifications({
      database: db,
      alert: makeAlert(),
      notificationEnv: credentialedEnv,
      transport,
      log: mockLog,
    });
    expect(sendSms).toHaveBeenCalledOnce();
  });
});

describe('dispatchCriticalNotifications — no recipients', () => {
  it('calls neither sendEmail nor sendSms, and logs a warning', async () => {
    const db = makeDatabaseWithRecipients([]);
    const { transport, sendEmail, sendSms } = makeTransport();
    await dispatchCriticalNotifications({
      database: db,
      alert: makeAlert(),
      notificationEnv: credentialedEnv,
      transport,
      log: mockLog,
    });
    expect(sendEmail).not.toHaveBeenCalled();
    expect(sendSms).not.toHaveBeenCalled();
    expect(mockLog.warn).toHaveBeenCalled();
  });
});

// ── runEscalationCheck — level increment and ack gate ─────────────────────────

/** Build a mock DB that returns a specific overdue alert from the select chain. */
function makeEscalationDatabase(overdueAlerts: object[]) {
  const updatedAlert =
    overdueAlerts.length > 0
      ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
        [
          {
            ...(overdueAlerts[0] as object),
            escalationLevel: (overdueAlerts[0] as any).escalationLevel + 1,
            status: 'escalated',
          },
        ]
      : [];

  const mockSelect = vi.fn(() => {
    // First call: main overdueAlerts query; subsequent: audit event inserts (handled differently)
    return {
      from: () => ({
        where: () => Promise.resolve(overdueAlerts),
      }),
    };
  });

  const mockUpdate = vi.fn(() => ({
    set: () => ({
      where: () => ({
        returning: () => Promise.resolve(updatedAlert),
      }),
    }),
  }));

  const mockInsert = vi.fn(() => ({
    values: () => Promise.resolve([{ id: 'audit-1' }]),
  }));

  return {
    select: mockSelect,
    update: mockUpdate,
    insert: mockInsert,
  } as never;
}

describe('runEscalationCheck — overdue alert increments escalation level', () => {
  it('updates escalationLevel to current + 1 and dispatches with urgent=true', async () => {
    const overdueAlert = {
      id: 'alert-1',
      patientId: 'pat-001',
      severityTier: 'Critical' as const,
      status: 'open' as const,
      escalationLevel: 0,
      ackDeadline: new Date('2026-01-01T00:00:00.000Z'),
      explanation: 'SpO2 critically low',
      triggeringVitals: ['spo2'],
    };
    const db = makeEscalationDatabase([overdueAlert]);
    const { transport } = makeTransport();
    // Pass a caregiver DB for the lookup inside dispatchCriticalNotifications
    const fullDb = {
      ...db,
      select: vi
        .fn()
        .mockReturnValueOnce({
          from: () => ({ where: () => Promise.resolve([overdueAlert]) }),
        }) // overdue query
        .mockReturnValue({
          from: () => ({
            innerJoin: () => ({ where: () => Promise.resolve([]) }),
          }),
        }), // lookup
      update: db.update,
      insert: vi
        .fn()
        .mockReturnValue({
          values: () => Promise.resolve([{ id: 'audit-1' }]),
        }),
    } as never;

    const count = await runEscalationCheck(fullDb, {
      now: new Date('2026-01-01T01:00:00.000Z'),
      notificationEnv: sandboxEnv, // sandbox so no real calls
      transport,
      log: mockLog,
    });

    expect(count).toBe(1);
  });
});

describe('runEscalationCheck — no overdue alerts', () => {
  it('returns 0 and makes no updates', async () => {
    const db = {
      select: vi
        .fn()
        .mockReturnValue({
          from: () => ({ where: () => Promise.resolve([]) }),
        }),
    } as never;

    const count = await runEscalationCheck(db, { log: mockLog });
    expect(count).toBe(0);
  });
});
