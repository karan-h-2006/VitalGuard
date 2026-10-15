import amqp from 'amqplib';
import mqtt from 'mqtt';
import { routeMqttPayload } from './bridge.js';
import { loadVitalSampleValidator } from './schema-validator.js';
import { env } from '../env.js';
import { logger } from '../logger.js';
import { assertVitalTopology } from '../topology.js';

export type PipelineHandle = {
  shutdown(signal: string): Promise<void>;
  isHealthy(): boolean;
};

type AmqpConnection = Awaited<ReturnType<typeof amqp.connect>>;

export async function startMqttBridge(): Promise<PipelineHandle> {
  const validator = await loadVitalSampleValidator();
  let rabbitConnection: AmqpConnection | null = null;
  let rabbitChannel: amqp.ConfirmChannel | null = null;
  let isShuttingDown = false;
  let reconnectTimer: NodeJS.Timeout | null = null;

  async function connectRabbit(): Promise<void> {
    if (isShuttingDown) return;
    try {
      const conn = await amqp.connect(env.RABBITMQ_URL);
      conn.on('error', (err) => {
        logger.error({ err }, 'RabbitMQ bridge connection error');
      });
      conn.on('close', () => {
        rabbitChannel = null;
        rabbitConnection = null;
        if (!isShuttingDown) {
          logger.warn(
            'RabbitMQ bridge connection closed; scheduling reconnect in 2s',
          );
          if (reconnectTimer) clearTimeout(reconnectTimer);
          reconnectTimer = setTimeout(() => {
            void connectRabbit();
          }, 2000);
        }
      });

      const ch = await conn.createConfirmChannel();
      ch.on('error', (err) => {
        logger.error({ err }, 'RabbitMQ bridge channel error');
      });
      ch.on('close', () => {
        rabbitChannel = null;
      });

      await assertVitalTopology(ch);
      rabbitConnection = conn;
      rabbitChannel = ch;
      logger.info('MQTT bridge connected to RabbitMQ and topology asserted');
    } catch (err) {
      rabbitChannel = null;
      rabbitConnection = null;
      if (!isShuttingDown) {
        logger.warn(
          { err },
          'Failed to connect MQTT bridge to RabbitMQ; retrying in 2s',
        );
        if (reconnectTimer) clearTimeout(reconnectTimer);
        reconnectTimer = setTimeout(() => {
          void connectRabbit();
        }, 2000);
      }
    }
  }

  await connectRabbit();

  const mqttClient = mqtt.connect({
    host: env.MQTT_HOST,
    port: env.MQTT_PORT,
    protocol: env.MQTT_USE_TLS ? 'mqtts' : 'mqtt',
    username: env.MQTT_USERNAME,
    password: env.MQTT_PASSWORD,
    reconnectPeriod: 1_000,
  });

  mqttClient.on('connect', () => {
    mqttClient.subscribe(env.MQTT_VITALS_TOPIC, { qos: 1 }, (error) => {
      if (error) {
        logger.error({ err: error }, 'failed to subscribe MQTT bridge');
        return;
      }
      logger.info({ topic: env.MQTT_VITALS_TOPIC }, 'MQTT bridge subscribed');
    });
  });

  mqttClient.on('message', (_topic, payload) => {
    if (!rabbitChannel) {
      logger.warn(
        'MQTT bridge received message but RabbitMQ channel is not ready; message dropped',
      );
      return;
    }
    void routeMqttPayload(payload, rabbitChannel, validator).catch(
      (error: unknown) => {
        logger.error(
          { err: error, topic: _topic },
          'failed to route MQTT payload into RabbitMQ',
        );
      },
    );
  });

  mqttClient.on('error', (error) => {
    logger.error({ err: error }, 'MQTT bridge client error');
  });

  return {
    isHealthy(): boolean {
      return !isShuttingDown && rabbitChannel !== null && mqttClient.connected;
    },
    async shutdown(signal: string): Promise<void> {
      isShuttingDown = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      logger.info({ signal }, 'MQTT bridge shutting down');
      mqttClient.end(true);
      if (rabbitChannel) {
        try {
          await rabbitChannel.close();
        } catch (err) {
          logger.debug({ err }, 'error closing rabbit channel on shutdown');
        }
      }
      if (rabbitConnection) {
        try {
          await rabbitConnection.close();
        } catch (err) {
          logger.debug({ err }, 'error closing rabbit connection on shutdown');
        }
      }
    },
  };
}
