import { Queue } from 'bullmq';
import { redis } from '../config/redis';

export const debugQueue = new Queue('debug', { connection: redis });
