import fp from 'fastify-plugin';

export default fp(async (app) => {
  app.setErrorHandler((err, _req, reply) => {
    if ((err as any).validation) {
      return reply.code(400).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: err.message,
          details: (err as any).validation
        }
      });
    }
    const status = (err as any).statusCode || 500;
    app.log.error({ err }, 'Unhandled error');
    reply.code(status).send({ error: { code: 'INTERNAL_ERROR', message: 'Internal Server Error' } });
  });
});