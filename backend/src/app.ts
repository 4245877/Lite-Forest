import Fastify from 'fastify';
import cors from '@fastify/cors';
import formbody from '@fastify/formbody';
import multipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';
import path from 'node:path';
import fs from 'node:fs';
import { env } from './core/env.js';
import { logger } from './core/logger.js';


import health from './api/health.js';
import uploads from './api/uploads.js';
import products from './api/products.js';
import jobs from './api/jobs.js';
import imports from './api/imports.js';
import metrics from './monitoring/metrics.js';
import ready from './monitoring/ready.js';


export function buildApp() {
  const app = Fastify({ logger });

  app.register(cors, { origin: env.CORS_ORIGIN === '*' ? true : env.CORS_ORIGIN.split(',') });
  app.register(formbody);
  app.register(multipart);

  // Гарантируем существование каталога для статики загрузок
  try { fs.mkdirSync(env.UPLOADS_DIR, { recursive: true }); } catch {}

  app.register(fastifyStatic, { root: env.UPLOADS_DIR, prefix: '/uploads/' });

  app.register(health);
  app.register(ready);
  app.register(metrics);
  app.register(uploads);
  app.register(products);
  app.register(jobs);
  app.register(imports);

  return app;
}
