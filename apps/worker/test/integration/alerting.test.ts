import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { Channel, ConsumeMessage } from 'amqplib';
import { and, eq } from 'drizzle-orm';
import { acknowledgeAlert } from '../../src/alerting/service.js';
import { runEscalationCheck } from '../../src/alerting/escalation.js';
import { dispatchCriticalNotifications } from '../../src/alerting/notifications.js';
import { handleIngestMessage } from '../../src/consumer/ingest.js';
import {
  alerts,
  associationCaregivers,
  associations,
  auditLog,
  users,
} from '../../src/schema.js';
import {
  closeTestDb,
  closeTestRedis,
  connectTestRedis,
  getTestDb,
  makeValidSample,
  resetAnalyticsState,
  SEEDED_CAREGIVER_ID,
  SEEDED_DEVICE_ID,
  SEEDED_DOCTOR_ID,
  SEEDED_PATIENT_ID,
} from './helpers.js';

const RUN = process.env.RUN_INTEGRATION_TESTS === 'true';

function makeMessage(payload: unknown): ConsumeMessage {
  return {
    content: Buffer.from(JSON.stringify(payload)),
    fields: {
      deliveryTag: 1,
      redelivered: false,
      exchange: 'vitals',
      routingKey: `vitals.${SEEDED_DEVICE_ID}`,
      consumerTag: 'test',
    },
    properties: {
      contentType: 'application/json',
      contentEncoding: null,
      headers: {},
      deliveryMode: 2,
      priority: undefined,
      correlationId: undefined,
      replyTo: undefined,
      expiration: undefined,
      messageId: undefined,
      timestamp: undefined,
      type: undefined,
      userId: undefined,
      appId: undefined,
      clusterId: undefined,
    },
  } as unknown as ConsumeMessage;
}

async function ingestSample(sample: ReturnType<typeof makeValidSample>) {
  const db = getTestDb();
  const fakeChannel = {
    ack: () => {},
    nack: () => {
      throw new Error('unexpected nack');
    },
  } as unknown as Channel;

  await handleIngestMessage(makeMessage(sample), fakeChannel, db);
}

async function seedAssociatedUsers(): Promise<void> {
  const db = getTestDb();
  await db
    .insert(users)
    .values([
      {
        id: SEEDED_CAREGIVER_ID,
        role: 'caregiver',
        email: 'caregiver-demo@vitalguard.local',
        phoneNumber: '+15555550123',
        passwordHash: 'MODULE_4_AUTH_NOT_IMPLEMENTED',
      },
      {
        id: SEEDED_DOCTOR_ID,
        role: 'doctor',
        email: 'doctor-demo@vitalguard.local',
        phoneNumber: null,
        passwordHash: 'MODULE_4_AUTH_NOT_IMPLEMENTED',
      },
    ])
    .onConflictDoNothing();
  await db
    .insert(associations)
    .values({ patientId: SEEDED_PATIENT_ID, doctorId: SEEDED_DOCTOR_ID })
    .onConflictDoNothing();
  await db
    .insert(associationCaregivers)
    .values({
      patientId: SEEDED_PATIENT_ID,
      caregiverId: SEEDED_CAREGIVER_ID,
    })
    .onConflictDoNothing();
}

describe.skipIf(!RUN)('Module 4 alerting (integration)', () => {
  beforeAll(async () => {
    getTestDb();
    await connectTestRedis();
  });

  afterAll(async () => {
    await closeTestRedis();
    await closeTestDb();
  });

  beforeEach(async () => {
    await resetAnalyticsState();
  });

  it('upgrades an open Warning alert when severity worsens to Critical', async () => {
    await ingestSample(
      makeValidSample({
        timestamp: '2024-04-01T10:00:00Z',
        temperature: { value: 38.1, unit: 'celsius' },
      }),
    );
    await ingestSample(
      makeValidSample({
        timestamp: '2024-04-01T10:01:00Z',
        motion: {
          roll: 20,
          pitch: 30,
          accel_magnitude: 18,
          fall_detected: true,
        },
      }),
    );

    const rows = await getTestDb()
      .select()
      .from(alerts)
      .where(eq(alerts.patientId, SEEDED_PATIENT_ID));
    expect(rows).toHaveLength(1);
    expect(rows[0]?.severityTier).toBe('Critical');
    expect(rows[0]?.ackDeadline).not.toBeNull();
    expect(rows[0]?.explanation).toContain('fall');
  });

  it('creates one alert when readings stay in Warning', async () => {
    await ingestSample(
      makeValidSample({
        timestamp: '2024-04-01T10:00:00Z',
        temperature: { value: 38.1, unit: 'celsius' },
      }),
    );
    await ingestSample(
      makeValidSample({
        timestamp: '2024-04-01T10:01:00Z',
        temperature: { value: 38.2, unit: 'celsius' },
      }),
    );

    const rows = await getTestDb()
      .select()
      .from(alerts)
      .where(eq(alerts.patientId, SEEDED_PATIENT_ID));
    expect(rows).toHaveLength(1);
    expect(rows[0]?.severityTier).toBe('Warning');
    expect(rows[0]?.status).toBe('open');
    expect(rows[0]?.explanation).toContain('temperature');
  });

  it('logs sandbox dispatch with populated and missing associations', async () => {
    const logEntries: Array<{ level: string; message: string; data: unknown }> =
      [];
    const log = {
      info: (data: unknown, message: string) =>
        logEntries.push({ level: 'info', message, data }),
      warn: (data: unknown, message: string) =>
        logEntries.push({ level: 'warn', message, data }),
      error: (data: unknown, message: string) =>
        logEntries.push({ level: 'error', message, data }),
    };
    const db = getTestDb();
    const [alert] = await db
      .insert(alerts)
      .values({
        patientId: SEEDED_PATIENT_ID,
        severityTier: 'Critical',
        triggeringVitals: ['motion'],
        explanation: 'detected fall',
        status: 'open',
        openedAt: new Date('2024-04-01T10:00:00Z'),
        ackDeadline: new Date('2024-04-01T10:05:00Z'),
      })
      .returning();

    await dispatchCriticalNotifications({
      database: db,
      alert: alert!,
      log,
      notificationEnv: {
        RESEND_API_KEY: undefined,
        RESEND_FROM_EMAIL: 'alerts@vitalguard.local',
        TWILIO_ACCOUNT_SID: undefined,
        TWILIO_AUTH_TOKEN: undefined,
        TWILIO_FROM_PHONE: undefined,
      },
    });
    expect(logEntries.some((entry) => entry.message.includes('no caregiver'))).toBe(
      true,
    );

    await seedAssociatedUsers();
    logEntries.length = 0;
    await dispatchCriticalNotifications({
      database: db,
      alert: alert!,
      log,
      notificationEnv: {
        RESEND_API_KEY: undefined,
        RESEND_FROM_EMAIL: 'alerts@vitalguard.local',
        TWILIO_ACCOUNT_SID: undefined,
        TWILIO_AUTH_TOKEN: undefined,
        TWILIO_FROM_PHONE: undefined,
      },
    });
    expect(
      logEntries.filter((entry) => entry.message.includes('email')).length,
    ).toBe(2);
    expect(logEntries.some((entry) => entry.message.includes('SMS'))).toBe(true);
  });

  it('dispatches through transports when credentials and associations exist', async () => {
    await seedAssociatedUsers();
    const sent: string[] = [];
    const db = getTestDb();
    const [alert] = await db
      .insert(alerts)
      .values({
        patientId: SEEDED_PATIENT_ID,
        severityTier: 'Critical',
        triggeringVitals: ['spo2'],
        explanation: 'low SpO2',
        status: 'open',
        openedAt: new Date('2024-04-01T10:00:00Z'),
        ackDeadline: new Date('2024-04-01T10:05:00Z'),
      })
      .returning();

    await dispatchCriticalNotifications({
      database: db,
      alert: alert!,
      notificationEnv: {
        RESEND_API_KEY: 'resend-test-key',
        RESEND_FROM_EMAIL: 'alerts@vitalguard.local',
        TWILIO_ACCOUNT_SID: 'twilio-sid',
        TWILIO_AUTH_TOKEN: 'twilio-token',
        TWILIO_FROM_PHONE: '+15555550000',
      },
      transport: {
        sendEmail: async (message) => {
          sent.push(`email:${message.to}`);
        },
        sendSms: async (message) => {
          sent.push(`sms:${message.to}`);
        },
      },
    });

    expect(sent).toEqual(
      expect.arrayContaining([
        'email:caregiver-demo@vitalguard.local',
        'email:doctor-demo@vitalguard.local',
        'sms:+15555550123',
      ]),
    );
  });

  it('acknowledges alerts and suppresses later escalation', async () => {
    const db = getTestDb();
    const [alert] = await db
      .insert(alerts)
      .values({
        patientId: SEEDED_PATIENT_ID,
        severityTier: 'Critical',
        triggeringVitals: ['motion'],
        explanation: 'detected fall',
        status: 'open',
        openedAt: new Date('2024-04-01T10:00:00Z'),
        ackDeadline: new Date('2024-04-01T10:01:00Z'),
      })
      .returning();

    await acknowledgeAlert(
      db,
      alert!.id,
      SEEDED_CAREGIVER_ID,
      new Date('2024-04-01T10:00:30Z'),
    );
    const escalatedCount = await runEscalationCheck(db, {
      now: new Date('2024-04-01T10:02:00Z'),
    });

    const [updated] = await db
      .select()
      .from(alerts)
      .where(eq(alerts.id, alert!.id));
    const auditRows = await db
      .select()
      .from(auditLog)
      .where(
        and(
          eq(auditLog.alertId, alert!.id),
          eq(auditLog.transition, 'acknowledged'),
        ),
      );

    expect(escalatedCount).toBe(0);
    expect(updated?.status).toBe('acknowledged');
    expect(updated?.acknowledgedBy).toBe(SEEDED_CAREGIVER_ID);
    expect(auditRows).toHaveLength(1);
  });

  it('escalates overdue Critical alerts one level per check', async () => {
    await seedAssociatedUsers();
    const db = getTestDb();
    const [firstAlert] = await db
      .insert(alerts)
      .values({
        patientId: SEEDED_PATIENT_ID,
        severityTier: 'Critical',
        triggeringVitals: ['motion'],
        explanation: 'detected fall',
        status: 'open',
        openedAt: new Date('2024-04-01T10:00:00Z'),
        ackDeadline: new Date('2024-04-01T10:01:00Z'),
      })
      .returning();

    const firstCount = await runEscalationCheck(db, {
      now: new Date('2024-04-01T10:02:00Z'),
      notificationEnv: {
        RESEND_API_KEY: undefined,
        RESEND_FROM_EMAIL: 'alerts@vitalguard.local',
        TWILIO_ACCOUNT_SID: undefined,
        TWILIO_AUTH_TOKEN: undefined,
        TWILIO_FROM_PHONE: undefined,
      },
    });
    const secondCount = await runEscalationCheck(db, {
      now: new Date('2024-04-01T10:03:00Z'),
    });

    const [firstUpdated] = await db
      .select()
      .from(alerts)
      .where(eq(alerts.id, firstAlert!.id));
    expect(firstCount).toBe(1);
    expect(secondCount).toBe(1);
    expect(firstUpdated?.status).toBe('escalated');
    expect(firstUpdated?.escalationLevel).toBe(2);

    const [secondAlert] = await db
      .insert(alerts)
      .values({
        patientId: SEEDED_PATIENT_ID,
        severityTier: 'Critical',
        triggeringVitals: ['spo2'],
        explanation: 'low SpO2',
        status: 'open',
        openedAt: new Date('2024-04-01T10:04:00Z'),
        ackDeadline: new Date('2024-04-01T10:05:00Z'),
        escalationLevel: 2,
      })
      .returning();
    const thirdCount = await runEscalationCheck(db, {
      now: new Date('2024-04-01T10:06:00Z'),
    });
    const [secondUpdated] = await db
      .select()
      .from(alerts)
      .where(eq(alerts.id, secondAlert!.id));

    expect(thirdCount).toBe(1);
    expect(secondUpdated?.escalationLevel).toBe(3);
  });
});
