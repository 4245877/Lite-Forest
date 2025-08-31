import { FastifyInstance } from 'fastify';
import { Queue, QueueEvents, Job } from 'bullmq';
import { redis } from '../core/redis.js';


export default async function routes(app: FastifyInstance) {
if (!redis) {
app.log.warn('Redis not configured — /api/jobs disabled');
app.get('/api/jobs/*', async (_req, reply) => reply.code(501).send({ message: 'Jobs disabled' }));
app.post('/api/jobs/*', async (_req, reply) => reply.code(501).send({ message: 'Jobs disabled' }));
return;
}


const queue = new Queue('jobs', { connection: redis });
const events = new QueueEvents('jobs', { connection: redis });


app.post('/api/jobs/reindex', async (_req, reply) => {
const job = await queue.add('reindex', {});
return reply.code(202).send({ id: job.id });
});


app.get('/api/jobs/:id', async (req, reply) => {
const { id } = req.params as any;
const j = await Job.fromId(queue, id);
if (!j) return reply.code(404).send({ message: 'Not found' });
const st = await j.getState();
return { id: j.id, name: j.name, state: st, progress: j.progress, returnvalue: j.returnvalue, failedReason: j.failedReason };
});
}