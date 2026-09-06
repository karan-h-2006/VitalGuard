import { Buffer } from 'node:buffer';
import { eq } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import type { AlertSeverityTier } from '@vitalguard/shared-types';
import {
  associationCaregivers,
  associations,
  type alerts,
  users,
} from '../schema.js';
import { env } from '../env.js';
import { logger } from '../logger.js';

type AlertRow = typeof alerts.$inferSelect;

type Recipient = {
  id: string;
  role: 'caregiver' | 'doctor';
  email: string;
  phoneNumber: string | null;
};

export type NotificationEnv = Pick<
  typeof env,
  | 'RESEND_API_KEY'
  | 'RESEND_FROM_EMAIL'
  | 'TWILIO_ACCOUNT_SID'
  | 'TWILIO_AUTH_TOKEN'
  | 'TWILIO_FROM_PHONE'
>;

export type NotificationTransport = {
  sendEmail: (message: {
    to: string;
    subject: string;
    text: string;
    apiKey: string;
    from: string;
  }) => Promise<void>;
  sendSms: (message: {
    to: string;
    body: string;
    accountSid: string;
    authToken: string;
    from: string;
  }) => Promise<void>;
};

type DispatchOptions = {
  database: PostgresJsDatabase;
  alert: Pick<
    AlertRow,
    'id' | 'patientId' | 'severityTier' | 'explanation' | 'triggeringVitals'
  >;
  urgent?: boolean;
  notificationEnv?: NotificationEnv;
  transport?: NotificationTransport;
  log?: Pick<typeof logger, 'info' | 'warn' | 'error'>;
};

function messageForAlert(
  alert: DispatchOptions['alert'],
  urgent: boolean,
): { subject: string; body: string } {
  const prefix = urgent ? 'URGENT escalation' : 'Critical alert';
  const vitals = alert.triggeringVitals?.join(', ') || 'unknown vitals';
  const body = `${prefix} for patient ${alert.patientId}. Severity: ${alert.severityTier}. Triggering vitals: ${vitals}. Explanation: ${alert.explanation}`;

  return {
    subject: `${prefix}: VitalGuard patient ${alert.patientId}`,
    body,
  };
}

async function fetchJson(url: string, init: RequestInit): Promise<void> {
  const response = await fetch(url, init);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${await response.text()}`);
  }
}

export const defaultNotificationTransport: NotificationTransport = {
  async sendEmail(message) {
    await fetchJson('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${message.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: message.from,
        to: [message.to],
        subject: message.subject,
        text: message.text,
      }),
    });
  },

  async sendSms(message) {
    const body = new URLSearchParams({
      From: message.from,
      To: message.to,
      Body: message.body,
    });
    await fetchJson(
      `https://api.twilio.com/2010-04-01/Accounts/${message.accountSid}/Messages.json`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${Buffer.from(
            `${message.accountSid}:${message.authToken}`,
          ).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body,
      },
    );
  },
};

export async function lookupAlertRecipients(
  database: PostgresJsDatabase,
  patientId: string,
): Promise<Recipient[]> {
  const caregiverRows = await database
    .select({
      id: users.id,
      email: users.email,
      phoneNumber: users.phoneNumber,
    })
    .from(associationCaregivers)
    .innerJoin(users, eq(users.id, associationCaregivers.caregiverId))
    .where(eq(associationCaregivers.patientId, patientId));

  const doctorRows = await database
    .select({
      id: users.id,
      email: users.email,
      phoneNumber: users.phoneNumber,
    })
    .from(associations)
    .innerJoin(users, eq(users.id, associations.doctorId))
    .where(eq(associations.patientId, patientId));

  return [
    ...caregiverRows.map((row) => ({ ...row, role: 'caregiver' as const })),
    ...doctorRows.map((row) => ({ ...row, role: 'doctor' as const })),
  ];
}

export async function dispatchCriticalNotifications({
  database,
  alert,
  urgent = false,
  notificationEnv = env,
  transport = defaultNotificationTransport,
  log = logger,
}: DispatchOptions): Promise<void> {
  if ((alert.severityTier as AlertSeverityTier) !== 'Critical') {
    return;
  }

  const recipients = await lookupAlertRecipients(database, alert.patientId);
  const message = messageForAlert(alert, urgent);

  if (recipients.length === 0) {
    log.warn(
      {
        alertId: alert.id,
        patientId: alert.patientId,
        subject: message.subject,
        body: message.body,
      },
      'would have sent Critical alert notifications, but no caregiver or doctor associations exist',
    );
    return;
  }

  for (const recipient of recipients) {
    if (!notificationEnv.RESEND_API_KEY) {
      log.info(
        {
          alertId: alert.id,
          channel: 'email',
          to: recipient.email,
          role: recipient.role,
          subject: message.subject,
          body: message.body,
        },
        'would have sent Critical alert email; RESEND_API_KEY is not configured',
      );
    } else {
      try {
        await transport.sendEmail({
          to: recipient.email,
          subject: message.subject,
          text: message.body,
          apiKey: notificationEnv.RESEND_API_KEY,
          from: notificationEnv.RESEND_FROM_EMAIL,
        });
        log.info(
          { alertId: alert.id, channel: 'email', to: recipient.email },
          'sent Critical alert email',
        );
      } catch (err) {
        log.error(
          { err, alertId: alert.id, channel: 'email', to: recipient.email },
          'failed to send Critical alert email',
        );
      }
    }

    if (recipient.role !== 'caregiver') {
      continue;
    }

    const twilioConfigured =
      notificationEnv.TWILIO_ACCOUNT_SID &&
      notificationEnv.TWILIO_AUTH_TOKEN &&
      notificationEnv.TWILIO_FROM_PHONE;
    if (!recipient.phoneNumber) {
      log.warn(
        {
          alertId: alert.id,
          channel: 'sms',
          role: recipient.role,
          recipientId: recipient.id,
          body: message.body,
        },
        'would have sent Critical alert SMS, but caregiver has no phone number',
      );
    } else if (!twilioConfigured) {
      log.info(
        {
          alertId: alert.id,
          channel: 'sms',
          to: recipient.phoneNumber,
          role: recipient.role,
          body: message.body,
        },
        'would have sent Critical alert SMS; Twilio credentials are not configured',
      );
    } else {
      try {
        await transport.sendSms({
          to: recipient.phoneNumber,
          body: message.body,
          accountSid: notificationEnv.TWILIO_ACCOUNT_SID!,
          authToken: notificationEnv.TWILIO_AUTH_TOKEN!,
          from: notificationEnv.TWILIO_FROM_PHONE!,
        });
        log.info(
          { alertId: alert.id, channel: 'sms', to: recipient.phoneNumber },
          'sent Critical alert SMS',
        );
      } catch (err) {
        log.error(
          { err, alertId: alert.id, channel: 'sms', to: recipient.phoneNumber },
          'failed to send Critical alert SMS',
        );
      }
    }
  }
}
