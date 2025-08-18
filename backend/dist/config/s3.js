import { S3Client, PutObjectCommand, CreateBucketCommand, HeadBucketCommand, GetObjectCommand } from '@aws-sdk/client-s3';
export const s3 = new S3Client({
    region: process.env.S3_REGION || 'us-east-1',
    endpoint: process.env.S3_ENDPOINT,
    forcePathStyle: true,
    credentials: { accessKeyId: process.env.S3_ACCESS_KEY || '', secretAccessKey: process.env.S3_SECRET_KEY || '' }
});
export async function ensureBucket(bucket) {
    try {
        await s3.send(new HeadBucketCommand({ Bucket: bucket }));
    }
    catch {
        await s3.send(new CreateBucketCommand({ Bucket: bucket }));
    }
}
export async function putObject(bucket, key, body, contentType) {
    await s3.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: contentType }));
}
export async function getObjectStream(bucket, key) {
    const { Body } = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    // @ts-ignore
    return Body;
}
