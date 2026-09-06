import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { auditLog } from '../schema.js';

export async function writeAlertAuditEvent(
  database: PostgresJsDatabase,
  values: {
    alertId: string;
    transition: string;
    actingUser?: string | null;
    timestamp?: Date;
  },
): Promise<void> {
  await database.insert(auditLog).values({
    alertId: values.alertId,
    transition: values.transition,
    actingUser: values.actingUser ?? null,
    timestamp: values.timestamp ?? new Date(),
  });
}
