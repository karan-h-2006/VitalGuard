import { createClient, type RedisClientType } from 'redis';
import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { notifications, users } from '../../db/schema.js';
import { env } from '../../env.js';

let redis: RedisClientType | undefined;
let connecting: Promise<RedisClientType> | undefined;

async function getRedis(app: FastifyInstance): Promise<RedisClientType> {
  if (redis?.isReady) return redis;
  if (!connecting) {
    const client = createClient({ url: env.REDIS_URL });
    client.on('error', (error) =>
      app.log.warn({ error }, 'admin notification Redis error'),
    );
    connecting = client
      .connect()
      .then(() => {
        redis = client;
        return client;
      })
      .finally(() => {
        connecting = undefined;
      });
  }
  return connecting;
}

export async function notifyAdmins(
  app: FastifyInstance,
  type: string,
  title: string,
  body: string,
  payload?: Record<string, unknown>,
): Promise<void> {
  const admins = await app.database
    .select({ id: users.id })
    .from(users)
    .where(eq(users.role, 'administrator'));
  for (const admin of admins)
    await app.database
      .insert(notifications)
      .values({
        recipientId: admin.id,
        type,
        title,
        body,
        payload: payload ?? null,
      });
  if (!env.ADMIN_NOTIFY_EMAIL) return;
  let shouldSend = true;
  try {
    shouldSend =
      (await (
        await getRedis(app)
      ).set('vitalguard:admin-digest:last-sent', '1', {
        NX: true,
        EX: 600,
      })) === 'OK';
  } catch (error) {
    app.log.warn({ error }, 'Redis unavailable for admin digest debounce');
  }
  if (!shouldSend) return;
  if (!env.RESEND_API_KEY) {
    app.log.info(
      { to: env.ADMIN_NOTIFY_EMAIL, title, body },
      'sandbox: admin digest email would be sent',
    );
    return;
  }
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: env.RESEND_FROM_EMAIL,
        to: [env.ADMIN_NOTIFY_EMAIL],
        subject: 'VitalGuard: pending governance action',
        text: `${title}\n\n${body}`,
      }),
    });
    if (!response.ok)
      app.log.error(
        { status: response.status },
        'failed to send admin digest email',
      );
  } catch (error) {
    app.log.error({ error }, 'failed to send admin digest email');
  }
}

export async function emailUser(
  app: FastifyInstance,
  to: string,
  subject: string,
  body: string,
): Promise<void> {
  if (!env.RESEND_API_KEY) {
    app.log.info({ to, subject, body }, 'sandbox: email would be sent');
    return;
  }
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: env.RESEND_FROM_EMAIL,
        to: [to],
        subject,
        text: body,
      }),
    });
    if (!response.ok)
      app.log.error({ status: response.status }, 'failed to send email');
  } catch (error) {
    app.log.error({ error }, 'failed to send email');
  }
}
