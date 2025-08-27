import { FastifyInstance } from 'fastify';
import multipart from '@fastify/multipart';
import { ensureBucket, putObject } from '../config/s3';
import { queues, defaultJobOpts } from '../queues';
import { randomUUID } from 'crypto';

export async function importRoutes(app: FastifyInstance) {
  await app.register(multipart);

  app.post('/api/v1/imports', async (req, reply) => {
    const mp = await req.file();
    if (!mp) {
      return reply.code(400).send({
        error: { code: 'VALIDATION_ERROR', message: 'No file' }
      });
    }
    const ok = [
      'text/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ];
    if (!ok.includes(mp.mimetype)) {
      return reply.code(400).send({
        error: { code: 'VALIDATION_ERROR', message: 'Unsupported file type' }
      });
    }

    await ensureBucket(process.env.S3_BUCKET as string);
    const ext = mp.filename.split('.').pop()?.toLowerCase() || 'csv';
    const key = `imports/${Date.now()}-${randomUUID()}.${ext}`;
    const buf = await mp.toBuffer();
    await putObject(process.env.S3_BUCKET as string, key, buf, mp.mimetype);

    const job = await queues.import.add('bulk-import', { s3_key: key, filename: mp.filename }, defaultJobOpts);
    return { jobId: job.id, queued: true };
  });
}
