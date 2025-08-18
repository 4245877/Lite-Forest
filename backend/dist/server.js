import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import sensible from '@fastify/sensible';
import rateLimit from '@fastify/rate-limit';
import { env } from './config/env';
import { productsRoutes } from './api/products';
import { healthRoutes } from './api/health';
import { uploadRoutes } from './api/uploads';
import { jobsRoutes } from './api/jobs';
import { importRoutes } from './api/imports';
import metricsPlugin from './monitoring/metrics';
import errorHandler from './middlewares/errorHandler';
async function bootstrap() {
    const app = Fastify({ logger: { level: env.LOG_LEVEL } });
    await app.register(sensible);
    await app.register(helmet);
    await app.register(cors, { origin: env.CORS_ORIGIN === '*' ? true : env.CORS_ORIGIN });
    await app.register(rateLimit, { max: 100, timeWindow: '1 minute' });
    await app.register(metricsPlugin);
    await app.register(errorHandler);
    await app.register(healthRoutes);
    await app.register(productsRoutes);
    // file uploads, jobs and import endpoints
    await app.register(uploadRoutes);
    await app.register(jobsRoutes);
    await app.register(importRoutes);
    await app.listen({ port: env.PORT, host: '0.0.0.0' });
    app.log.info(`Server listening on :${env.PORT}`);
}
bootstrap().catch((e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    process.exit(1);
});
