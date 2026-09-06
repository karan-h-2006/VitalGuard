import { createClient } from 'redis';
import { desc, eq } from 'drizzle-orm';
import { env } from '../../env.js';
import { vitalReadings } from '../../db/schema.js';
import type { Database } from '../../db/client.js';

export type PatientStatus = {
  patientId: string; deviceId?: string; timestamp: string; severityTier: string | null;
  previousSeverityTier?: string | null; explanation?: string; fallDetected?: boolean;
  latestVitals: Record<string, { value: number | string; anomalyFlag?: string; zScore?: number | null }>;
};
const redis = createClient({ url: env.REDIS_URL });
redis.on('error', () => undefined);
let connected = false;

async function getRedis() { if (!connected) { await redis.connect(); connected = true; } return redis; }
export async function getPatientStatus(database: Database, patientId: string): Promise<{ source: 'redis' | 'database' | 'none'; status: PatientStatus | null }> {
  try {
    const raw = await (await getRedis()).get(`patient:${patientId}:status`);
    if (raw) return { source: 'redis', status: JSON.parse(raw) as PatientStatus };
  } catch { /* database fallback keeps read paths available during Redis outages */ }
  const rows = await database.select().from(vitalReadings).where(eq(vitalReadings.patientId, patientId)).orderBy(desc(vitalReadings.timestamp)).limit(4);
  if (!rows.length) return { source: 'none', status: null };
  const latest = rows[0]!;
  return { source: 'database', status: { patientId, deviceId: latest.deviceId, timestamp: latest.timestamp.toISOString(), severityTier: latest.severityTier, latestVitals: Object.fromEntries(rows.map((row) => [row.vitalType, { value: row.value }])) } };
}
export async function readRawStatus(patientId: string): Promise<string | null> { try { return await (await getRedis()).get(`patient:${patientId}:status`); } catch { return null; } }
