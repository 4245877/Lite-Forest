import Redis from 'ioredis';
import { env } from './env.js';

if (!env.REDIS_URL || !env.REDIS_URL.trim()) {
  throw new Error('REDIS_URL is not set. Example: redis://127.0.0.1:6379/0');
}

export const redis = new Redis(env.REDIS_URL.trim(), {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

redis.on('connect', () => console.log('[redis] connected:', env.REDIS_URL));
redis.on('error', (e) => console.error('[redis] error:', e));
