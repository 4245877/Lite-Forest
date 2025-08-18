import { S3Client, PutObjectCommand, CreateBucketCommand, HeadBucketCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { env } from '../config/env';

export const s3 = new S3Client({
  region: process.env.S3_REGION || 'us-east-1',
  endpoint: process.env.S3_ENDPOINT,
  forcePathStyle: true,
  credentials: { accessKeyId: process.env.S3_ACCESS_KEY || '', secretAccessKey: process.env.S3_SECRET_KEY || '' }
});

export async function ensureBucket(bucket: string) {
  try { await s3.send(new HeadBucketCommand({ Bucket: bucket })); }
  catch { await s3.send(new CreateBucketCommand({ Bucket: bucket })); }
}

export async function putObject(bucket: string, key: string, body: Buffer | Uint8Array | Blob | string, contentType: string) {
  await s3.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: contentType }));
}

export async function getObjectStream(bucket: string, key: string) {
  const { Body } = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  // @ts-ignore
  return Body as NodeJS.ReadableStream;
}