import type { IsoDateTime } from './iso-date-time.js';

/**
 * Immutable record of a state change (typically an alert transition).
 * Named AuditLog in the domain model; OpenAPI uses AuditLogEntry.
 */
export interface AuditLog {
  eventId: string;
  alertId?: string | null;
  transition: string;
  actingUser?: string | null;
  timestamp: IsoDateTime;
}
