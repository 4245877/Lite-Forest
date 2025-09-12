// backend/src/app.ts
import Fastify from 'fastify';
import cors from '@fastify/cors';
import formbody from '@fastify/formbody';
import multipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';

import fs from 'node:fs';
import { env } from './core/env.js';

// security / auth plugins
import fastifyCookie from '@fastify/cookie';
import fastifyHelmet from '@fastify/helmet';
import fastifyRateLimit from '@fastify/rate-limit';
import fastifyJWT from '@fastify/jwt';

// routes
import health from './api/health.js';
import uploads from './api/uploads.js';
import products from './api/products.js';
import jobs from './api/jobs.js';
import imports from './api/imports.js';
import metrics from './monitoring/metrics.js';
import ready from './monitoring/ready.js';
import auth from './api/auth.js';

export function buildApp() {
  const app = Fastify({
    logger: {
      level: env.NODE_ENV === 'production' ? 'info' : 'debug',
      // для красивого вывода в dev можно раскомментировать и установить pino-pretty:
      // transport: env.NODE_ENV !== 'production' ? { target: 'pino-pretty', options: { colorize: true, translateTime: 'HH:MM:ss.l' } } : undefined,
    },
  });

  // security headers
  app.register(fastifyHelmet);

  // cookies (optionally add secret to sign cookies)
  app.register(fastifyCookie, {
    // secret: env.COOKIE_SIGNING_SECRET, // optional: подпись кук (прод)
  });

  // rate limiting
  app.register(fastifyRateLimit, {
    max: 100,
    timeWindow: '1 minute',
    keyGenerator: (req: any) => req.ip,
  });

  // jwt (позволяет req.jwtVerify() читать access-токен из cookie)
  app.register(fastifyJWT, {
    secret: env.JWT_SECRET,
    cookie: { cookieName: env.COOKIE_NAME_ACCESS, signed: false },
  });

  // базовые плагины
  app.register(cors, { origin: env.CORS_ORIGIN === '*' ? true : env.CORS_ORIGIN.split(',') });
  app.register(formbody);
  app.register(multipart);

  // гарантируем существование каталога для статики загрузок
  try { fs.mkdirSync(env.UPLOADS_DIR, { recursive: true }); } catch {}

  // статика
  app.register(fastifyStatic, { root: env.UPLOADS_DIR, prefix: '/uploads/' });

  // роуты
  app.register(health);
  app.register(ready);
  app.register(metrics);
  app.register(uploads);
  app.register(products);
  app.register(jobs);
  app.register(imports);

  // регистрация auth после подключения cookie/jwt
  app.register(auth); // ⬅️ зарегистрировали auth-роутер

  return app;
}
