import { createClient } from 'redis';
import { and, desc, eq } from 'drizzle-orm';
import { env } from '../../env.js';
import { devices, vitalReadings } from '../../db/schema.js';
import type { Database } from '../../db/client.js';

export type PatientStatus = {
  patientId: string;
  deviceId?: string;
  device?: {
    id: string;
    isSimulated: boolean;
    registrationStatus: string;
    simScenario?: string | null;
  } | null;
  timestamp: string;
  severityTier: string | null;
  previousSeverityTier?: string | null;
  explanation?: string;
  latestVitals: Record<
    string,
    { value: number | string; anomalyFlag?: string; zScore?: number | null }
  >;
};
const redis = createClient({ url: env.REDIS_URL });
redis.on('error', () => undefined);
let connected = false;

async function getRedis() {
  if (!connected) {
    await redis.connect();
    connected = true;
  }
  return redis;
}
export async function getPatientStatus(
  database: Database,
  patientId: string,
): Promise<{
  source: 'redis' | 'database' | 'none';
  status: PatientStatus | null;
  device?: {
    id: string;
    isSimulated: boolean;
    registrationStatus: string;
    simScenario?: string | null;
  } | null;
}> {
  let deviceRecord: {
    id: string;
    isSimulated: boolean;
    registrationStatus: string;
    simScenario?: string | null;
  } | null = null;

  try {
    const [d] = await database
      .select({
        id: devices.id,
        isSimulated: devices.isSimulated,
        registrationStatus: devices.registrationStatus,
        simScenario: devices.simScenario,
      })
      .from(devices)
      .where(
        and(
          eq(devices.patientId, patientId),
          eq(devices.registrationStatus, 'registered'),
        ),
      )
      .limit(1);
    if (d) deviceRecord = d;
  } catch {
    /* database device lookup is best effort */
  }

  try {
    const raw = await (await getRedis()).get(`patient:${patientId}:status`);
    if (raw) {
      const parsed = JSON.parse(raw) as PatientStatus;
      if (deviceRecord && !parsed.device) {
        parsed.device = deviceRecord;
      }
      return {
        source: 'redis',
        status: parsed,
        device: deviceRecord,
      };
    }
  } catch {
    /* database fallback keeps read paths available during Redis outages */
  }
  const rows = await database
    .select()
    .from(vitalReadings)
    .where(eq(vitalReadings.patientId, patientId))
    .orderBy(desc(vitalReadings.timestamp))
    .limit(4);
  if (!rows.length)
    return { source: 'none', status: null, device: deviceRecord };
  const latest = rows[0]!;
  return {
    source: 'database',
    status: {
      patientId,
      deviceId: latest.deviceId,
      device: deviceRecord,
      timestamp: latest.timestamp.toISOString(),
      severityTier: latest.severityTier,
      latestVitals: Object.fromEntries(
        rows.map((row) => [row.vitalType, { value: row.value }]),
      ),
    },
    device: deviceRecord,
  };
}
export async function readRawStatus(patientId: string): Promise<string | null> {
  try {
    return await (await getRedis()).get(`patient:${patientId}:status`);
  } catch {
    return null;
  }
}
