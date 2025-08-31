// backend/src/server.ts
import { buildApp } from './app.js';
import { env } from './core/env.js';

const app = await buildApp(); // top-level await — в ESM это работает
await app.listen({ host: env.HOST, port: env.PORT });
app.log.info(`Server listening on http://${env.HOST}:${env.PORT}`);
