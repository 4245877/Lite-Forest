import { FastifyInstance } from 'fastify';
import multipart from '@fastify/multipart';
import { getKnex } from '../db/knex';
import { ensureBucket, putObject } from '../config/s3';
import { queues, defaultJobOpts } from '../queues';
import { randomUUID } from 'crypto';

export async function uploadRoutes(app: FastifyInstance) {
  await app.register(multipart, { limits: { fileSize: Number(process.env.UPLOAD_MAX_BYTES || 10*1024*1024) } });

  app.post('/api/v1/uploads', async (req, reply) => {
    const mp = await req.file();
    if (!mp) return reply.badRequest('No file');
    const allowed = ['image/jpeg','image/png','image/webp'];
    if (!allowed.includes(mp.mimetype)) return reply.badRequest('Unsupported content-type');

    const knex = getKnex();
    await ensureBucket(process.env.S3_BUCKET as string);

    const ext = mp.filename.split('.').pop()?.toLowerCase() || 'bin';
    const key = `uploads/${Date.now()}-${randomUUID()}.${ext}`;
    const buf = await mp.toBuffer();
    await putObject(process.env.S3_BUCKET as string, key, buf, mp.mimetype);

    const [media] = await knex('media').insert({
      filename: mp.filename,
      content_type: mp.mimetype,
      size_bytes: buf.length,
      s3_key: key,
      processing_status: 'queued'
    }).returning(['id']);

    const job = await queues.image.add('image-resize', {
      media_id: media.id || media,
      s3_key: key,
      content_type: mp.mimetype,
      enableAvif: String(process.env.ENABLE_AVIF).toLowerCase() === 'true'
    }, defaultJobOpts);

    return { media_id: media.id || media, processing_status: 'queued', jobId: job.id, url_preview: `${process.env.S3_PUBLIC_BASE_URL?.replace(/\/$/, '')}/${key}` };
  });
}