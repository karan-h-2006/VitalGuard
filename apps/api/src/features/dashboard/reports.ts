import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { and, eq, gte, lt } from 'drizzle-orm';
import type { Database } from '../../db/client.js';
import { alerts, reports, vitalReadings } from '../../db/schema.js';

/**
 * Computes average vital values and alert tier counts from raw DB rows.
 * Extracted from generateWeeklyReport for unit testing — no I/O; behavior
 * is identical to the inline loops it replaced.
 */
export function computeReportAggregations(
  readings: Array<{ vitalType: string; value: string | number }>,
  alertRows: Array<{ severityTier: string }>,
): { avgVitals: Record<string, number>; alertCounts: Record<string, number> } {
  const sums: Record<string, number> = {};
  for (const row of readings) {
    const value = Number(row.value);
    sums[row.vitalType] = (sums[row.vitalType] ?? 0) + value;
  }
  const avgVitals: Record<string, number> = {};
  for (const type of Object.keys(sums)) {
    avgVitals[type] =
      (sums[type] ?? 0) /
      readings.filter((row) => row.vitalType === type).length;
  }
  const alertCounts: Record<string, number> = {};
  for (const alert of alertRows) {
    alertCounts[alert.severityTier] =
      (alertCounts[alert.severityTier] ?? 0) + 1;
  }
  return { avgVitals, alertCounts };
}

export async function generateWeeklyReport(
  database: Database,
  patientId: string,
  periodEnd = new Date(),
  periodStart = new Date(periodEnd.getTime() - 7 * 86_400_000),
) {
  const readings = await database
    .select()
    .from(vitalReadings)
    .where(
      and(
        eq(vitalReadings.patientId, patientId),
        gte(vitalReadings.timestamp, periodStart),
        lt(vitalReadings.timestamp, periodEnd),
      ),
    );
  const alertRows = await database
    .select()
    .from(alerts)
    .where(
      and(
        eq(alerts.patientId, patientId),
        gte(alerts.openedAt, periodStart),
        lt(alerts.openedAt, periodEnd),
      ),
    );
  const { avgVitals, alertCounts } = computeReportAggregations(
    readings,
    alertRows,
  );
  const directory = join(process.cwd(), 'generated-reports');
  await mkdir(directory, { recursive: true });
  const filePath = join(
    directory,
    `${patientId}-${periodEnd.toISOString().slice(0, 10)}.pdf`,
  );
  const text =
    `VitalGuard weekly report\nPatient: ${patientId}\nPeriod: ${periodStart.toISOString()} to ${periodEnd.toISOString()}\nAverage vitals: ${JSON.stringify(avgVitals)}\nAlerts: ${JSON.stringify(alertCounts)}`.replace(
      /[()]/g,
      '',
    );
  const content = `BT /F1 11 Tf 50 750 Td (${text.replace(/\n/g, ') Tj 0 -16 Td (')}) Tj ET`;
  const pdf = `%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Count 1/Kids[3 0 R]>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Resources<</Font<</F1 4 0 R>>>>/Contents 5 0 R>>endobj\n4 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj\n5 0 obj<</Length ${content.length}>>stream\n${content}\nendstream endobj\ntrailer<</Root 1 0 R>>\n%%EOF`;
  await writeFile(filePath, pdf);
  const [report] = await database
    .insert(reports)
    .values({
      patientId,
      periodStart,
      periodEnd,
      filePath,
      avgVitals,
      alertCounts,
      trendWarningCount: 0,
    })
    .returning();
  return report;
}
