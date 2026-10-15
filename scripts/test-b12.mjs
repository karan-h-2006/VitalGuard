import { execSync, spawn } from 'child_process';

async function wait(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function getRedisKey(key) {
  return execSync(`docker exec infra-redis-1 redis-cli GET "${key}"`)
    .toString()
    .trim();
}

function getRedisKeys(pattern) {
  return execSync(`docker exec infra-redis-1 redis-cli KEYS "${pattern}"`)
    .toString()
    .trim()
    .split(/\r?\n/)
    .filter(Boolean);
}

async function main() {
  console.log('\n--- B.12: Multi-Instance Lease Lock & Failover Verification ---');

  // Step 1: Check existing lease ownership
  const initialKeys = getRedisKeys('device:sim:lease:*');
  console.log(`Found ${initialKeys.length} existing Redis device leases.`);
  if (initialKeys.length === 0) {
    throw new Error('No active leases found in Redis. Is the primary simulator running?');
  }

  const primaryOwner = getRedisKey(initialKeys[0]);
  console.log(`Primary manager ID holding lease: ${primaryOwner}`);

  // Step 2: Spawn secondary simulator manager with distinct health port
  console.log('\nSpawning secondary simulator manager (health port 8082)...');
  const env = {
    ...process.env,
    SIMULATOR_HEALTH_PORT: '8082',
    SIM_DISCOVERY_INTERVAL_SECONDS: '3',
    VITALS_INTERVAL_SECONDS: '3',
  };

  const secondary = spawn(
    '.\\simulator\\.venv\\Scripts\\python.exe',
    ['simulator/manager.py'],
    {
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    }
  );

  let secondaryOutput = '';
  secondary.stdout.on('data', (d) => {
    secondaryOutput += d.toString();
  });
  secondary.stderr.on('data', (d) => {
    secondaryOutput += d.toString();
  });

  console.log('Waiting 8s for secondary manager to discover devices and attempt lease acquisition...');
  await wait(8000);

  // Check health of secondary
  const res = await fetch('http://localhost:8082/healthz');
  const secHealth = await res.json();
  console.log(`Secondary simulator health:`, secHealth);

  // Verify that all leases are STILL owned by primaryManager
  console.log('\nVerifying leases were NOT stolen by secondary manager...');
  for (const k of initialKeys) {
    const owner = getRedisKey(k);
    if (owner !== primaryOwner) {
      throw new Error(`FAIL: Lease for ${k} was wrongly stolen by ${owner} (expected ${primaryOwner})`);
    }
  }
  console.log('CHECK PASSED: Leases remain exclusively held by primary manager. No duplicate publishing.');

  // Step 3: Stop primary simulator and observe failover
  console.log('\nStopping primary simulator to simulate primary node failure...');
  // Find primary simulator PID and kill it
  const primaryPid = Number(primaryOwner.split('-')[1]);
  console.log(`Killing primary manager process (PID: ${primaryPid})...`);
  try {
    process.kill(primaryPid, 'SIGTERM');
  } catch (err) {
    console.log(`Note: process.kill failed (${err.message}), trying taskkill...`);
    try {
      execSync(`taskkill /F /PID ${primaryPid}`);
    } catch {}
  }

  console.log('Waiting 18s for lease TTL (15s) to expire and secondary to acquire orphaned devices...');
  await wait(18000);

  // Step 4: Verify leases are now owned by secondary manager
  console.log('Checking new lease ownership in Redis...');
  const newOwner = getRedisKey(initialKeys[0]);
  console.log(`New owner for ${initialKeys[0]}: ${newOwner}`);

  if (newOwner === primaryOwner || !newOwner.startsWith('manager-')) {
    throw new Error(`FAIL: Secondary manager did not acquire lease. Current owner: ${newOwner}`);
  }
  console.log(`CHECK PASSED: Secondary manager (${newOwner}) successfully acquired orphaned leases!`);

  // Step 5: Verify telemetry continues flowing into Postgres
  console.log('\nVerifying vitals readings are still incrementing in DB via secondary manager...');
  const count1 = Number(
    execSync('docker exec infra-postgres-1 psql -U vitalguard -d vitalguard -t -c "SELECT count(*) FROM vital_readings;"')
      .toString()
      .trim()
  );
  await wait(6000);
  const count2 = Number(
    execSync('docker exec infra-postgres-1 psql -U vitalguard -d vitalguard -t -c "SELECT count(*) FROM vital_readings;"')
      .toString()
      .trim()
  );
  console.log(`Readings count: before=${count1}, after=${count2} (diff: +${count2 - count1})`);
  if (count2 <= count1) {
    throw new Error('FAIL: Telemetry did not flow from secondary manager!');
  }
  console.log('CHECK PASSED: Secondary manager actively publishing vitals to pipeline.');

  // Cleanup: kill secondary manager
  console.log('\nCleaning up secondary manager process...');
  secondary.kill('SIGTERM');

  console.log('\n--- B.12 VERIFICATION COMPLETED SUCCESSFULLY ---');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
