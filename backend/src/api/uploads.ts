// @ts-nocheck


import { FastifyInstance } from 'fastify';
import '@fastify/multipart'; // для типов req.file() и req.parts()
import { saveLocal, saveImageLocal } from '../core/s3.js';

export default async function routes(app: FastifyInstance) {
  // одиночный файл
  app.post('/api/uploads', async (req, reply) => {
    const mp = await req.file();
    if (!mp) return reply.code(400).send({ message: 'file is required' });
    const buf = await mp.toBuffer();
    const isImage = (mp.mimetype || '').startsWith('image/');
    const stored = isImage ? await saveImageLocal(buf, mp.filename) : await saveLocal(buf, mp.filename);
    return reply.code(201).send(stored);
  });

  // множественная загрузка
  app.post('/api/uploads/batch', async (req, reply) => {
    const parts = req.parts();
    const out: any[] = [];

    for await (const p of parts) {
      // пропускаем не-файлы
      if (p.type !== 'file') continue;
      if (!p.filename) continue;
      const buf = await p.toBuffer();
      const isImage = (p.mimetype || '').startsWith('image/');
      const stored = isImage ? await saveImageLocal(buf, p.filename) : await saveLocal(buf, p.filename);
      out.push(stored);
    }

    if (!out.length) return reply.code(400).send({ message: 'no files' });
    return reply.code(201).send({ items: out });
  });
}
