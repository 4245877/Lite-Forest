import { FastifyInstance } from 'fastify';
import { queues } from '../queues';

export async function jobsRoutes(app: FastifyInstance) {
  app.get('/api/v1/jobs/:id', async (req, reply) => {
    const { id } = req.params as any;
    const job = await queues.image.getJob(id) || await queues.import.getJob(id);
    if (!job) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Job not found' } });
    const state = await job.getState();
    const progress = job.progress || 0;
    return { id: job.id, name: job.name, state, progress, attemptsMade: job.attemptsMade, failedReason: job.failedReason, returnvalue: job.returnvalue };
  });
}