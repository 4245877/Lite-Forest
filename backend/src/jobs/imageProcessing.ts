import sharp from 'sharp';
import { getKnex } from '../db/knex';
import { getObjectStream, putObject } from '../config/s3';

export async function processImage(job: any) {
  const { media_id, s3_key, enableAvif } = job.data as { media_id: number; s3_key: string; enableAvif: boolean };
  const bucket = process.env.S3_BUCKET as string;
  const baseUrl = (process.env.S3_PUBLIC_BASE_URL || '').replace(/\/$/, '');

  const stream = await getObjectStream(bucket, s3_key);
  const inputBuf = await streamToBuffer(stream);

  const thumb = await sharp(inputBuf).resize(240, 240, { fit: 'inside' }).webp().toBuffer();
  const large = await sharp(inputBuf).resize(800, 800, { fit: 'inside' }).webp().toBuffer();

  const thumbKey = s3_key.replace(/^uploads\//, 'media/').replace(/\.[^.]+$/, '') + '-240.webp';
  const largeKey = s3_key.replace(/^uploads\//, 'media/').replace(/\.[^.]+$/, '') + '-800.webp';

  await putObject(bucket, thumbKey, thumb, 'image/webp');
  await putObject(bucket, largeKey, large, 'image/webp');

  const variants: any[] = [
    { type: 'thumb', width: 240, height: 240, url: `${baseUrl}/${thumbKey}` },
    { type: 'large', width: 800, height: 800, url: `${baseUrl}/${largeKey}` }
  ];

  if (enableAvif) {
    const avifKey = s3_key.replace(/^uploads\//, 'media/').replace(/\.[^.]+$/, '') + '-800.avif';
    const avif = await sharp(inputBuf).resize(800, 800, { fit: 'inside' }).avif({ effort: 4 }).toBuffer();
    await putObject(bucket, avifKey, avif, 'image/avif');
    variants.push({ type: 'avif', width: 800, height: 800, url: `${baseUrl}/${avifKey}` });
  }

  const knex = getKnex();
  await knex('media').update({ processing_status: 'ready', variants: JSON.stringify(variants) }).where({ id: media_id });
  return { media_id, variants };
}

async function streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
  const chunks: Buffer[] = [];
  return new Promise((resolve, reject) => {
    stream.on('data', (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);
  });
}