import { and, eq, inArray } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import type { VitalSeverityTier } from '@vitalguard/shared-types';
import { alerts } from '../schema.js';
import { env } from '../env.js';
import { logger } from '../logger.js';
import { writeAlertAuditEvent } from './audit.js';
import {
  dispatchCriticalNotifications,
  type NotificationEnv,
  type NotificationTransport,
} from './notifications.js';

type AlertingOptions = {
  now?: Date;
  notificationEnv?: NotificationEnv;
  transport?: NotificationTransport;
  log?: Pick<typeof logger, 'info' | 'warn' | 'error'>;
};

export function isAlertSeverityTier(
  tier: VitalSeverityTier,
): tier is 'Warning' | 'Critical' {
  return tier === 'Warning' || tier === 'Critical';
}

function criticalAckDeadline(now: Date): Date {
  return new Date(now.getTime() + env.ALERT_ACK_SLA_MINUTES * 60_000);
}

async function finalizeAlertDispatch(
  database: PostgresJsDatabase,
  alert: typeof alerts.$inferSelect,
  options: AlertingOptions,
): Promise<void> {
  const log = options.log ?? logger;
  const timestamp = options.now ?? new Date();

  if (alert.severityTier === 'Critical') {
    await dispatchCriticalNotifications({
      database,
      alert,
      notificationEnv: options.notificationEnv,
      transport: options.transport,
      log,
    });
  }

  await writeAlertAuditEvent(database, {
    alertId: alert.id,
    transition: 'dispatched',
    timestamp,
  });
}

export async function onSeverityTransition(
  database: PostgresJsDatabase,
  patientId: string,
  previousTier: VitalSeverityTier | null,
  newTier: VitalSeverityTier,
  explanation: string,
  triggeringVitals: string[],
  options: AlertingOptions = {},
): Promise<void> {
  if (!isAlertSeverityTier(newTier) || newTier === previousTier) {
    return;
  }

  const log = options.log ?? logger;
  const [existingOpenAlert] = await database
    .select()
    .from(alerts)
    .where(
      and(
        eq(alerts.patientId, patientId),
        inArray(alerts.status, ['open', 'escalated']),
      ),
    )
    .limit(1);

  const now = options.now ?? new Date();

  if (existingOpenAlert) {
    if (
      existingOpenAlert.severityTier === 'Warning' &&
      newTier === 'Critical'
    ) {
      const [upgradedAlert] = await database
        .update(alerts)
        .set({
          severityTier: 'Critical',
          triggeringVitals,
          explanation,
          ackDeadline: criticalAckDeadline(now),
        })
        .where(eq(alerts.id, existingOpenAlert.id))
        .returning();

      if (!upgradedAlert) {
        throw new Error('Alert upgrade to Critical did not return a row');
      }

      await finalizeAlertDispatch(database, upgradedAlert, options);
      return;
    }

    log.warn(
      {
        patientId,
        previousTier,
        newTier,
        existingAlertId: existingOpenAlert.id,
        existingAlertStatus: existingOpenAlert.status,
      },
      'duplicate active alert detected for patient; skipping new alert creation',
    );
    return;
  }
  const [alert] = await database
    .insert(alerts)
    .values({
      patientId,
      severityTier: newTier,
      triggeringVitals,
      explanation,
      status: 'open',
      openedAt: now,
      ackDeadline: newTier === 'Critical' ? criticalAckDeadline(now) : null,
      escalationLevel: 0,
    })
    .returning();

  if (!alert) {
    throw new Error('Alert insert did not return a row');
  }

  await writeAlertAuditEvent(database, {
    alertId: alert.id,
    transition: 'generated',
    timestamp: now,
  });

  await finalizeAlertDispatch(database, alert, options);
}

export async function acknowledgeAlert(
  database: PostgresJsDatabase,
  alertId: string,
  actingUserId: string,
  acknowledgedAt = new Date(),
): Promise<void> {
  await database
    .update(alerts)
    .set({
      status: 'acknowledged',
      acknowledgedAt,
      acknowledgedBy: actingUserId,
    })
    .where(eq(alerts.id, alertId));

  await writeAlertAuditEvent(database, {
    alertId,
    transition: 'acknowledged',
    actingUser: actingUserId,
    timestamp: acknowledgedAt,
  });
}

export async function resolveAlert(
  database: PostgresJsDatabase,
  alertId: string,
  actingUserId: string | null = null,
  resolvedAt = new Date(),
): Promise<void> {
  await database
    .update(alerts)
    .set({
      status: 'resolved',
      resolvedAt,
    })
    .where(eq(alerts.id, alertId));

  await writeAlertAuditEvent(database, {
    alertId,
    transition: 'resolved',
    actingUser: actingUserId,
    timestamp: resolvedAt,
  });
}
