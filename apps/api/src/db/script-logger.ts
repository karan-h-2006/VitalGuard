import pino from 'pino';
import { env } from '../../env.js';

export const scriptLogger = pino({ level: env.LOG_LEVEL });
