// services/ingester/src/queue.ts
import { Queue } from "bullmq";
import { Redis } from "ioredis";         
import { env } from "./env.js";           // см. п.2: .js в пути

export const connection = new Redis(env.redisUrl, { maxRetriesPerRequest: null });

export const importQueue = new Queue("import", { connection });
export const mediaQueue  = new Queue("media",  { connection });

export type ImportCsvJob = { csvPath: string, batchId?: string };
export type ImportUrlJob = {
  sourceUrl: string,
  sku?: string,
  price?: number, currency?: string, stock?: number,
  categories?: string[], imageUrl?: string, modelUrl?: string,
  attributes?: Record<string, any>
};
export type MediaJob = {
  productId: string,
  role: 'main_image'|'gallery'|'model_primary'|'model_alt',
  url: string,
  sku: string
};
