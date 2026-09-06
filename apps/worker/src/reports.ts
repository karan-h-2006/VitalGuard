import cron from 'node-cron';
import { eq } from 'drizzle-orm';
import { database } from './db.js';
import { users } from './schema.js';
import { logger } from './logger.js';
// We cross the workspace boundary here just like schema.ts does.
import { generateWeeklyReport } from '../../api/src/features/dashboard/reports.js';

export function startWeeklyReportsJob() {
  // Run every Sunday at midnight
  cron.schedule('0 0 * * 0', async () => {
    logger.info('Starting weekly report generation');
    try {
      const patients = await database
        .select({ id: users.id })
        .from(users)
        .where(eq(users.role, 'patient'));

      for (const patient of patients) {
        try {
          // generateWeeklyReport writes PDF and inserts into DB
          await generateWeeklyReport(database as any, patient.id);
          logger.info({ patientId: patient.id }, 'Weekly report generated successfully');
        } catch (err) {
          logger.error({ patientId: patient.id, err }, 'Failed to generate weekly report');
        }
      }
      logger.info('Finished weekly report generation');
    } catch (error) {
      logger.error({ error }, 'Weekly report generation job failed');
    }
  });
  logger.info('Weekly reports cron job scheduled (Sunday midnight)');
}
