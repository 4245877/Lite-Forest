import fp from 'fastify-plugin';
import client from 'prom-client';


const register = new client.Registry();
client.collectDefaultMetrics({ register });


export default fp(async (app) => {
app.get('/metrics', async (_req, reply) => {
reply.header('Content-Type', register.contentType);
return register.metrics();
});
});