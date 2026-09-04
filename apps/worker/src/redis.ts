import * as net from 'node:net';
import { env } from './env.js';

type RedisReply = string | number | null | RedisReply[];

type PendingRequest = {
  resolve: (value: RedisReply) => void;
  reject: (error: Error) => void;
};

function encodeCommand(args: Array<string | number>): string {
  const parts = [`*${args.length}\r\n`];
  for (const arg of args) {
    const value = String(arg);
    parts.push(`$${Buffer.byteLength(value)}\r\n${value}\r\n`);
  }
  return parts.join('');
}

class RespParser {
  private offset = 0;

  constructor(private readonly buffer: Buffer) {}

  parse(): { value: RedisReply; bytesRead: number } | null {
    const value = this.parseValue();
    if (value === undefined) {
      return null;
    }

    return {
      value,
      bytesRead: this.offset,
    };
  }

  private parseValue(): RedisReply | undefined {
    const prefix = this.buffer[this.offset];
    if (prefix === undefined) {
      return undefined;
    }

    this.offset += 1;

    switch (String.fromCharCode(prefix)) {
      case '+':
        return this.readLine();
      case '-': {
        const message = this.readLine();
        if (message === undefined) {
          return undefined;
        }
        throw new Error(message);
      }
      case ':': {
        const line = this.readLine();
        return line === undefined ? undefined : Number(line);
      }
      case '$': {
        const lengthLine = this.readLine();
        if (lengthLine === undefined) {
          return undefined;
        }

        const length = Number(lengthLine);
        if (length === -1) {
          return null;
        }

        const end = this.offset + length;
        if (this.buffer.length < end + 2) {
          return undefined;
        }

        const value = this.buffer.subarray(this.offset, end).toString('utf8');
        this.offset = end + 2;
        return value;
      }
      case '*': {
        const lengthLine = this.readLine();
        if (lengthLine === undefined) {
          return undefined;
        }

        const length = Number(lengthLine);
        if (length === -1) {
          return null;
        }

        const items: RedisReply[] = [];
        for (let index = 0; index < length; index += 1) {
          const item = this.parseValue();
          if (item === undefined) {
            return undefined;
          }
          items.push(item);
        }
        return items;
      }
      default:
        throw new Error(`Unsupported RESP prefix: ${String.fromCharCode(prefix)}`);
    }
  }

  private readLine(): string | undefined {
    const lineEnd = this.buffer.indexOf('\r\n', this.offset, 'utf8');
    if (lineEnd === -1) {
      return undefined;
    }

    const value = this.buffer.subarray(this.offset, lineEnd).toString('utf8');
    this.offset = lineEnd + 2;
    return value;
  }
}

class SimpleRedisClient {
  private socket: net.Socket | null = null;
  private buffer = Buffer.alloc(0);
  private pending: PendingRequest[] = [];
  private connectPromise: Promise<void> | null = null;

  async connect(): Promise<void> {
    if (this.socket && !this.socket.destroyed) {
      return;
    }

    if (!this.connectPromise) {
      this.connectPromise = this.openSocket().finally(() => {
        this.connectPromise = null;
      });
    }

    await this.connectPromise;
  }

  async quit(): Promise<void> {
    if (!this.socket || this.socket.destroyed) {
      return;
    }

    try {
      await this.sendCommand(['QUIT']);
    } finally {
      this.socket.end();
      this.socket.destroy();
      this.socket = null;
      this.buffer = Buffer.alloc(0);
    }
  }

  async get(key: string): Promise<string | null> {
    const reply = await this.sendCommand(['GET', key]);
    return typeof reply === 'string' ? reply : null;
  }

  async set(key: string, value: string): Promise<void> {
    await this.sendCommand(['SET', key, value]);
  }

  async del(keys: string[]): Promise<void> {
    if (keys.length === 0) {
      return;
    }
    await this.sendCommand(['DEL', ...keys]);
  }

  async keys(pattern: string): Promise<string[]> {
    const reply = await this.sendCommand(['KEYS', pattern]);
    if (!Array.isArray(reply)) {
      return [];
    }
    return reply.filter((entry): entry is string => typeof entry === 'string');
  }

  async zAdd(
    key: string,
    members: Array<{ score: number; value: string }>,
  ): Promise<void> {
    const args: Array<string | number> = ['ZADD', key];
    for (const member of members) {
      args.push(member.score, member.value);
    }
    await this.sendCommand(args);
  }

  async zRemRangeByScore(
    key: string,
    min: number,
    max: number,
  ): Promise<void> {
    await this.sendCommand(['ZREMRANGEBYSCORE', key, min, max]);
  }

  async zRangeWithScores(
    key: string,
    start: number,
    stop: number,
  ): Promise<Array<{ value: string; score: number }>> {
    const reply = await this.sendCommand([
      'ZRANGE',
      key,
      start,
      stop,
      'WITHSCORES',
    ]);

    if (!Array.isArray(reply)) {
      return [];
    }

    const items: Array<{ value: string; score: number }> = [];
    for (let index = 0; index < reply.length; index += 2) {
      const value = reply[index];
      const score = reply[index + 1];
      if (typeof value === 'string' && typeof score === 'string') {
        items.push({ value, score: Number(score) });
      }
    }
    return items;
  }

  private async openSocket(): Promise<void> {
    const url = new URL(env.REDIS_URL);
    const port = Number(url.port || 6379);

    await new Promise<void>((resolve, reject) => {
      const socket = net.createConnection({
        host: url.hostname,
        port,
      });

      socket.setNoDelay(true);
      socket.on('data', (chunk) => {
        this.buffer = Buffer.concat([this.buffer, chunk]);
        this.flushReplies();
      });
      socket.on('error', (error) => {
        this.rejectPending(error);
      });
      socket.on('close', () => {
        this.socket = null;
      });
      socket.once('connect', () => {
        this.socket = socket;
        resolve();
      });
      socket.once('error', reject);
    });

    if (url.password) {
      if (url.username) {
        await this.sendCommand(['AUTH', url.username, url.password]);
      } else {
        await this.sendCommand(['AUTH', url.password]);
      }
    }

    const databaseIndex = url.pathname.replace('/', '');
    if (databaseIndex) {
      await this.sendCommand(['SELECT', databaseIndex]);
    }
  }

  private flushReplies(): void {
    while (this.pending.length > 0 && this.buffer.length > 0) {
      const parser = new RespParser(this.buffer);
      let parsed: { value: RedisReply; bytesRead: number } | null;

      try {
        parsed = parser.parse();
      } catch (error) {
        const pending = this.pending.shift();
        if (pending) {
          pending.reject(error as Error);
        }
        this.buffer = Buffer.alloc(0);
        return;
      }

      if (!parsed) {
        return;
      }

      this.buffer = this.buffer.subarray(parsed.bytesRead);
      const pending = this.pending.shift();
      pending?.resolve(parsed.value);
    }
  }

  private rejectPending(error: Error): void {
    while (this.pending.length > 0) {
      this.pending.shift()?.reject(error);
    }
  }

  private async sendCommand(
    args: Array<string | number>,
  ): Promise<RedisReply> {
    await this.connect();

    return await new Promise<RedisReply>((resolve, reject) => {
      const socket = this.socket;
      if (!socket) {
        reject(new Error('Redis socket is not connected'));
        return;
      }

      this.pending.push({ resolve, reject });
      socket.write(encodeCommand(args));
    });
  }
}

export const redis = new SimpleRedisClient();

export async function connectRedis(): Promise<void> {
  await redis.connect();
}

export async function closeRedis(): Promise<void> {
  await redis.quit();
}
