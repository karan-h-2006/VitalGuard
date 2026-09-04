import amqp from 'amqplib';
import mqtt from 'mqtt';
import { routeMqttPayload } from './bridge.js';
import { loadVitalSampleValidator } from './schema-validator.js';
import { env } from '../env.js';
import { logger } from '../logger.js';
import { assertVitalTopology } from '../topology.js';

const validator = await loadVitalSampleValidator();
const rabbitConnection = await amqp.connect(env.RABBITMQ_URL);
const rabbitChannel = await rabbitConnection.createConfirmChannel();
await assertVitalTopology(rabbitChannel);

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

mqttClient.on('message', (topic, payload) => {
  void routeMqttPayload(payload, rabbitChannel, validator).catch(
    (error: unknown) => {
      logger.error(
        { err: error, topic },
        'failed to route MQTT payload into RabbitMQ',
      );
    },
  );
});

mqttClient.on('error', (error) => {
  logger.error({ err: error }, 'MQTT bridge client error');
});

async function shutdown(signal: string): Promise<void> {
  logger.info({ signal }, 'MQTT bridge shutting down');
  mqttClient.end(true);
  await rabbitChannel.close();
  await rabbitConnection.close();
  process.exit(0);
}

process.once('SIGINT', () => {
  void shutdown('SIGINT');
});
process.once('SIGTERM', () => {
  void shutdown('SIGTERM');
});
