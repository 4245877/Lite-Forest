import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import sensible from '@fastify/sensible';
import rateLimit from '@fastify/rate-limit';
import metricsPlugin from './monitoring/metrics';
import errorHandler from './middlewares/errorHandler';
import { env } from './config/env';
import { healthRoutes } from './api/health';
import { productsRoutes } from './api/products';
import { uploadRoutes } from './api/uploads';
import { importRoutes } from './api/imports';
import { jobsRoutes } from './api/jobs';

export async function createApp() {
  const app = Fastify({ logger: { level: env.LOG_LEVEL } });
  await app.register(sensible);
  await app.register(helmet);
  await app.register(cors, { origin: env.CORS_ORIGIN === '*' ? true : env.CORS_ORIGIN });
  await app.register(rateLimit, { max: 100, timeWindow: '1 minute' });
  await app.register(metricsPlugin);
  await app.register(errorHandler);

  await app.register(healthRoutes);
  await app.register(productsRoutes);
  await app.register(uploadRoutes);
  await app.register(importRoutes);
  await app.register(jobsRoutes);
  return app;
}