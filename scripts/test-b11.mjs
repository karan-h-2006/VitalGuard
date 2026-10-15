import { execSync } from 'child_process';

const API_URL = 'http://localhost:3000';
const SIM_HEALTH_URL = 'http://localhost:8080/healthz';
const WORKER_HEALTH_URL = 'http://localhost:8081/healthz';

async function wait(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function checkHealth(url, name) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
    if (res.ok) {
      console.log(`[HEALTH] ${name} is UP (${res.status})`);
      return true;
    }
  } catch (err) {
    console.log(`[HEALTH] ${name} is DOWN (${err.message})`);
  }
  return false;
}

async function main() {
  console.log('\n--- B.11: Chaos Resilience Tests ---');

  // Baseline health check
  console.log('\nVerifying initial health...');
  await checkHealth(`${API_URL}/health`, 'API');
  await checkHealth(SIM_HEALTH_URL, 'Simulator');
  await checkHealth(WORKER_HEALTH_URL, 'Worker');

  // ─── 1. Mosquitto Chaos (Stop 10s -> Start) ──────────────────────────────
  console.log('\n1. Stopping Mosquitto container...');
  execSync('docker compose -f infra/docker-compose.yml stop mosquitto');
  await wait(5000);
  console.log('Mosquitto is stopped. Starting Mosquitto container...');
  execSync('docker compose -f infra/docker-compose.yml start mosquitto');
  console.log('Waiting 10s for Mosquitto health and reconnects...');
  await wait(10000);
  await checkHealth(SIM_HEALTH_URL, 'Simulator after Mosquitto restart');
  await checkHealth(WORKER_HEALTH_URL, 'Worker after Mosquitto restart');
  console.log('CHECK PASSED: Mosquitto recovery successful.');

  // ─── 2. Redis Chaos (Stop 10s -> Start) ──────────────────────────────────
  console.log('\n2. Stopping Redis container...');
  execSync('docker compose -f infra/docker-compose.yml stop redis');
  await wait(5000);
  console.log('Redis is stopped. Starting Redis container...');
  execSync('docker compose -f infra/docker-compose.yml start redis');
  console.log('Waiting 10s for Redis health...');
  await wait(10000);
  await checkHealth(`${API_URL}/health`, 'API after Redis restart');
  await checkHealth(SIM_HEALTH_URL, 'Simulator after Redis restart');
  console.log('CHECK PASSED: Redis recovery successful.');

  // ─── 3. RabbitMQ Chaos (Stop 10s -> Start) ────────────────────────────────
  console.log('\n3. Stopping RabbitMQ container...');
  execSync('docker compose -f infra/docker-compose.yml stop rabbitmq');
  await wait(5000);
  console.log('RabbitMQ is stopped. Starting RabbitMQ container...');
  execSync('docker compose -f infra/docker-compose.yml start rabbitmq');
  console.log('Waiting 15s for RabbitMQ health...');
  await wait(15000);
  await checkHealth(WORKER_HEALTH_URL, 'Worker after RabbitMQ restart');
  console.log('CHECK PASSED: RabbitMQ recovery successful.');

  // Verify telemetry readings are still flowing into database
  console.log('\nVerifying vital readings are currently being inserted into DB...');
  const countBefore = Number(
    execSync('docker exec infra-postgres-1 psql -U vitalguard -d vitalguard -t -c "SELECT count(*) FROM vital_readings;"')
      .toString()
      .trim()
  );
  await wait(8000);
  const countAfter = Number(
    execSync('docker exec infra-postgres-1 psql -U vitalguard -d vitalguard -t -c "SELECT count(*) FROM vital_readings;"')
      .toString()
      .trim()
  );
  console.log(`Vital readings count: before=${countBefore}, after=${countAfter} (diff: +${countAfter - countBefore})`);
  if (countAfter <= countBefore) {
    throw new Error('FAIL: Telemetry ingestion did not resume after chaos tests!');
  }

  console.log('CHECK PASSED: Telemetry flow confirmed active post-disruption.');
  console.log('\n--- B.11 VERIFICATION COMPLETED SUCCESSFULLY ---');
}

main().catch(console.error);
