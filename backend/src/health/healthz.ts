import { FastifyInstance } from 'fastify';
import { debugQueue } from '../queues/debug';

export async function healthRoutes(app: FastifyInstance) {
  app.get('/healthz', async () => ({ status: 'ok' }));
  app.get('/readyz', async () => ({ status: 'ready' }));

  // простая ручка для проверки очередей
  app.post('/debug/enqueue', async () => {
    const job = await debugQueue.add(
      'ping',
      { at: Date.now() },
      { removeOnComplete: true, removeOnFail: true }
    );
    return { jobId: job.id };
  });
}
