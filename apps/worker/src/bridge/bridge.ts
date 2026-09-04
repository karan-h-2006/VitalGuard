import type { ConfirmChannel } from 'amqplib';
import type { VitalSample } from '@vitalguard/shared-types';
import { env } from '../env.js';
import { logger } from '../logger.js';
import type { VitalSampleValidator } from './schema-validator.js';

export async function routeMqttPayload(
  payload: Buffer,
  channel: ConfirmChannel,
  validator: VitalSampleValidator,
): Promise<void> {
  const parsed = parseJson(payload);
  if (parsed === undefined) {
    await publishDeadLetter(
      channel,
      payload.toString('utf8'),
      'payload is not valid JSON',
    );
    return;
  }

  const result = validator.validate(parsed);
  if (!result.valid) {
    await publishDeadLetter(channel, parsed, result.reason);
    return;
  }

  await publishValidSample(channel, result.sample);
}

function parseJson(payload: Buffer): unknown | undefined {
  try {
    return JSON.parse(payload.toString('utf8')) as unknown;
  } catch {
    return undefined;
  }
}

async function publishValidSample(
  channel: ConfirmChannel,
  sample: VitalSample,
): Promise<void> {
  channel.publish(
    env.VITALS_EXCHANGE,
    `vitals.${sample.device_id}`,
    Buffer.from(JSON.stringify(sample)),
    { contentType: 'application/json', deliveryMode: 2 },
  );
  await channel.waitForConfirms();
  logger.info(
    { deviceId: sample.device_id, timestamp: sample.timestamp },
    'bridged validated MQTT vital sample',
  );
}

async function publishDeadLetter(
  channel: ConfirmChannel,
  originalPayload: unknown,
  rejectionReason: string,
): Promise<void> {
  const deadLetter = {
    received_at: new Date().toISOString(),
    rejection_reason: rejectionReason,
    original_payload: originalPayload,
  };
  channel.publish(
    env.VITALS_EXCHANGE,
    'vitals.deadletter',
    Buffer.from(JSON.stringify(deadLetter)),
    { contentType: 'application/json', deliveryMode: 2 },
  );
  await channel.waitForConfirms();
  logger.warn(
    { rejectionReason },
    'routed malformed MQTT sample to dead-letter queue',
  );
}
