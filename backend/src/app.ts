// backend/src/app.ts
import Fastify from 'fastify';
import cors from '@fastify/cors';
import formbody from '@fastify/formbody';
import multipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';

import fs from 'node:fs';
import path from 'node:path';
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
import orders from './api/orders.js';

export function buildApp() {
  const app = Fastify({
    logger: {
      level: env.NODE_ENV === 'production' ? 'info' : 'debug',
      // transport: env.NODE_ENV !== 'production'
      //   ? { target: 'pino-pretty', options: { colorize: true, translateTime: 'HH:MM:ss.l' } }
      //   : undefined,
    },
  });

  // security headers (включая CORP = cross-origin)
  app.register(fastifyHelmet, {
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    // crossOriginEmbedderPolicy: false, // не требуется для <img>, включай при необходимости
  });

  // cookies (optionally add secret to sign cookies)
  app.register(fastifyCookie, {
    // secret: env.COOKIE_SIGNING_SECRET,
  });

  // rate limiting
  app.register(fastifyRateLimit, {
    max: 100,
    timeWindow: '1 minute',
    keyGenerator: (req: any) => req.ip,
  });

  // jwt (req.jwtVerify() читает access-токен из cookie)
  app.register(fastifyJWT, {
    secret: env.JWT_SECRET,
    cookie: { cookieName: env.COOKIE_NAME_ACCESS, signed: false },
  });

  // базовые плагины
  app.register(cors, {
    origin: env.CORS_ORIGIN === '*'
      ? true
      : env.CORS_ORIGIN.split(',').map(s => s.trim()).filter(Boolean),
    methods: ['GET', 'HEAD', 'OPTIONS', 'POST', 'PUT', 'PATCH', 'DELETE'],
  });
  app.register(formbody);
  app.register(multipart);

  // гарантируем каталог для статики загрузок
  const uploadsRoot =
    env.UPLOADS_DIR && env.UPLOADS_DIR.trim()
      ? env.UPLOADS_DIR
      : path.resolve(process.cwd(), './uploads');
  try {
    fs.mkdirSync(uploadsRoot, { recursive: true });
  } catch {}

  // /uploads → uploadsRoot с корректными заголовками
  app.register(fastifyStatic, {
    root: uploadsRoot,
    prefix: '/uploads/',
    setHeaders(res /*, filePath, stat */) {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      // ключевой заголовок: разрешаем кросс-ориджин подгрузку ресурсов
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
      // на всякий случай (для простых <img>/<video> не обязателен, но полезен)
      res.setHeader('Access-Control-Allow-Origin', '*');
    },
  });

  // роуты
  app.register(health);
  app.register(ready);
  app.register(metrics);
  app.register(uploads);
  app.register(products);
  app.register(jobs);
  app.register(imports);
  app.register(auth);
  app.register(orders);

  return app;
}
