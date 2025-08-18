import fp from 'fastify-plugin';
import { Registry, collectDefaultMetrics } from 'prom-client';

export default fp(async (app) => {
  const register = new Registry();

  // Авто-сбор стандартных метрик (CPU, память, GC, event loop и т.д.)
  collectDefaultMetrics({ register });

  // Эндпоинт для Prometheus
  app.get('/metrics', async (req, reply) => {
    reply
      .header('Content-Type', register.contentType)
      .send(await register.metrics());
  });
});
