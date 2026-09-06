import { and, eq, inArray, isNull, lte } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { alerts } from '../schema.js';
import { env } from '../env.js';
import { logger } from '../logger.js';
import { writeAlertAuditEvent } from './audit.js';
import {
  dispatchCriticalNotifications,
  type NotificationEnv,
  type NotificationTransport,
} from './notifications.js';

type EscalationOptions = {
  now?: Date;
  notificationEnv?: NotificationEnv;
  transport?: NotificationTransport;
  log?: Pick<typeof logger, 'info' | 'warn' | 'error'>;
};

export async function runEscalationCheck(
  database: PostgresJsDatabase,
  options: EscalationOptions = {},
): Promise<number> {
  const now = options.now ?? new Date();
  const log = options.log ?? logger;
  const overdueAlerts = await database
    .select()
    .from(alerts)
    .where(
      and(
        inArray(alerts.status, ['open', 'escalated']),
        eq(alerts.severityTier, 'Critical'),
        isNull(alerts.acknowledgedAt),
        lte(alerts.ackDeadline, now),
      ),
    );

  for (const alert of overdueAlerts) {
    const nextEscalationLevel = alert.escalationLevel + 1;
    const [updatedAlert] = await database
      .update(alerts)
      .set({
        status: 'escalated',
        escalationLevel: nextEscalationLevel,
      })
      .where(eq(alerts.id, alert.id))
      .returning();

    if (!updatedAlert) {
      continue;
    }

    await dispatchCriticalNotifications({
      database,
      alert: updatedAlert,
      urgent: true,
      notificationEnv: options.notificationEnv,
      transport: options.transport,
      log,
    });
    await writeAlertAuditEvent(database, {
      alertId: updatedAlert.id,
      transition: 'escalated',
      timestamp: now,
    });
    await writeAlertAuditEvent(database, {
      alertId: updatedAlert.id,
      transition: 'dispatched',
      timestamp: now,
    });
  }

  return overdueAlerts.length;
}

export function startEscalationChecker(
  database: PostgresJsDatabase,
  options: EscalationOptions & { intervalMs?: number } = {},
): () => void {
  const intervalMs =
    options.intervalMs ?? env.ALERT_ESCALATION_POLL_INTERVAL_SECONDS * 1000;
  const timer = setInterval(() => {
    void runEscalationCheck(database, options).catch((err: unknown) => {
      (options.log ?? logger).error(
        { err },
        'alert escalation checker failed',
      );
    });
  }, intervalMs);

  timer.unref();
  return () => {
    clearInterval(timer);
  };
}
