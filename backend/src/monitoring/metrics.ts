import fp from 'fastify-plugin';
import metrics from 'fastify-metrics';

export default fp(async (app) => {
  await app.register(metrics, { endpoint: '/metrics' });
});
