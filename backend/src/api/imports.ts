import { FastifyInstance } from 'fastify';
import '@fastify/multipart';
import { Queue } from 'bullmq';
import { redis } from '../core/redis.js';

export default async function routes(app: FastifyInstance) {
  app.post('/api/imports/csv', async (req, reply) => {
    const mp = await req.file();
    if (!mp) return reply.code(400).send({ message: 'file is required' });

    if (!redis) return reply.code(501).send({ message: 'Import worker disabled (no REDIS_URL)' });

    const buf = await mp.toBuffer();
    const queue = new Queue('jobs', { connection: redis });
    const job = await queue.add('import:csv', { content: buf.toString('utf8') });
    return reply.code(202).send({ id: job.id });
  });
}
