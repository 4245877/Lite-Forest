import Redis from 'ioredis';
import { env } from './env.js';

const url = (env.REDIS_URL ?? '').trim();

// Если url пустой — Redis отключён (jobs/imports вернут 501 и не будут подключаться)
export const redis = url
  ? new Redis(url, { maxRetriesPerRequest: null, enableReadyCheck: false })
  : undefined;

export type RedisClient = typeof redis;
