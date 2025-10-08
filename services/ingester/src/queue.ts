// services/ingester/src/queue.ts
// Единые очереди BullMQ (v5). Имена без двоеточий.
// Здесь же создаём и экспортируем общее Redis-подключение.

import { Redis } from 'ioredis';
import { Queue, QueueEvents } from 'bullmq';
import { env } from './env.js';

// Экспорт общего подключения для всех воркеров/служб
export const connection = new Redis(env.redisUrl, { maxRetriesPerRequest: null });

// Имена очередей
export const QUEUE_IMPORT = 'ingester_import';
export const QUEUE_MEDIA  = 'ingester_media';

// Типы задач
export type ImportCsvJob = {
  csvPath: string;
  batchId?: string;
};

export type ImportUrlJob = {
  sourceUrl: string;
  sku?: string;
  price?: number;
  currency?: string;
  stock?: number;
  categories?: string[];
  imageUrl?: string;
  modelUrl?: string;
  attributes?: Record<string, any>;
};

export type MediaJob = {
  productId?: string;
  role?: 'main_image' | 'gallery' | 'model_primary' | 'model_alt';
  url?: string;
  sku: string;
};

// Очереди
export const importQueue = new Queue<ImportCsvJob | ImportUrlJob>(QUEUE_IMPORT, { connection });
export const mediaQueue  = new Queue<MediaJob>(QUEUE_MEDIA, { connection });

// События очередей (для логирования, метрик, ретраев)
export const importEvents = new QueueEvents(QUEUE_IMPORT, { connection });
export const mediaEvents  = new QueueEvents(QUEUE_MEDIA,  { connection });
