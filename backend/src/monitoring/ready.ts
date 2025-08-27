import fp from 'fastify-plugin';
import { getKnex } from '../db/knex';
import { redis } from '../config/redis';

export default fp(async (app) => {
  app.get('/readyz', async (_req, reply) => {
    try {
      await getKnex().raw('select 1');
      const pong = await redis.ping();
      if (pong !== 'PONG') throw new Error('Redis not PONG');
      return { status: 'ready' };
    } catch (err) {
      app.log.error({ err }, 'readiness failed');
      return reply.code(503).send({ status: 'not-ready' });
    }
  });
});
