import { FastifyInstance } from 'fastify';
import '@fastify/multipart'; // для типов req.file()
import { saveLocal } from '../core/s3.js';

export default async function routes(app: FastifyInstance) {
  app.post('/api/uploads', async (req, reply) => {
    const mp = await req.file();
    if (!mp) return reply.code(400).send({ message: 'file is required' });
    const buf = await mp.toBuffer();
    const stored = await saveLocal(buf, mp.filename);
    return reply.code(201).send(stored);
  });
}
