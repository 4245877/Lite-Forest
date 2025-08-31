import Redis from 'ioredis';
import { env } from './env.js';

// Если REDIS_URL не задан — возвращаем undefined (jobs отключены)
// Если задан — создаём клиент с опциями, требуемыми BullMQ
export const redis = env.REDIS_URL
  ? new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    })
  : undefined;

export type RedisClient = typeof redis;
