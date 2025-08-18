import { Queue, QueueEvents } from 'bullmq';
import { redis } from '../config/redis';
export const queues = {
    image: new Queue('image-processing', { connection: redis }),
    import: new Queue('bulk-imports', { connection: redis })
};
export const queueEvents = {
    image: new QueueEvents('image-processing', { connection: redis }),
    import: new QueueEvents('bulk-imports', { connection: redis })
};
export const defaultJobOpts = { attempts: 3, backoff: { type: 'exponential', delay: 2000 }, removeOnComplete: true, removeOnFail: false };
