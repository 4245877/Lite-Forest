import fp from 'fastify-plugin';
import { pingDb } from '../db/knex.js';


export default fp(async (app) => {
app.get('/ready', async (_req, reply) => {
const ok = await pingDb();
return reply.code(ok ? 200 : 503).send({ db: ok });
});
});