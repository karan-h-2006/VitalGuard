import crypto from 'crypto';
import fs from 'fs';

const pgPass = crypto.randomBytes(16).toString('hex');
const rmqPass = crypto.randomBytes(16).toString('hex');
const jwtSec = crypto.randomBytes(32).toString('hex');
const simTok = crypto.randomBytes(24).toString('hex');

const envContent = `# ==============================================================================
# VitalGuard Production Environment Variables
# ==============================================================================

DOMAIN=localhost
ACME_EMAIL=admin@vitalguard.local

NODE_ENV=production
LOG_LEVEL=info

POSTGRES_DB=vitalguard
POSTGRES_USER=vitalguard
POSTGRES_PASSWORD=${pgPass}

RABBITMQ_DEFAULT_USER=vitalguard
RABBITMQ_DEFAULT_PASS=${rmqPass}

JWT_SECRET=${jwtSec}
JWT_EXPIRES_IN=1h
ADMIN_JWT_EXPIRES_IN=30m

SIMULATOR_SERVICE_TOKEN=${simTok}

AUTO_PROVISION_SIMULATED_DEVICE=true

RESEND_API_KEY=
RESEND_FROM_EMAIL=alerts@vitalguard.local
ADMIN_NOTIFY_EMAIL=admin@vitalguard.local
`;

fs.writeFileSync('infra/.env.prod', envContent, 'utf8');
console.log('infra/.env.prod successfully created with secure random secrets.');
