import { Queue, JobsOptions, Worker, QueueEvents } from 'bullmq';
import { redis } from '../config/redis';

export const queues = {
  image: new Queue('image-processing', { connection: redis }),
  import: new Queue('bulk-imports', { connection: redis })
};

export type JobNames = 'image-resize' | 'bulk-import';
export type ImageJobData = { media_id: number; s3_key: string; content_type: string; enableAvif: boolean };
export type ImportJobData = { s3_key: string; filename: string };

export const queueEvents = {
  image: new QueueEvents('image-processing', { connection: redis }),
  import: new QueueEvents('bulk-imports', { connection: redis })
};

export const defaultJobOpts: JobsOptions = { attempts: 3, backoff: { type: 'exponential', delay: 2000 }, removeOnComplete: true, removeOnFail: false };