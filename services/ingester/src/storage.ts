// services/ingester/src/storage.ts
import fs from "node:fs/promises";
import path from "node:path";
import { env } from "./env.js";


// опциональный S3-клиент (не обязателен)
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const hasS3 = !!(env.s3.bucket && env.s3.endpoint && env.s3.accessKeyId && env.s3.secretAccessKey);

const s3 = hasS3 ? new S3Client({
  region: env.s3.region,
  endpoint: env.s3.endpoint,
  forcePathStyle: true,
  credentials: {
    accessKeyId: env.s3.accessKeyId,
    secretAccessKey: env.s3.secretAccessKey
  }
}) : null;

export async function saveObject(key: string, body: Buffer, contentType: string) {
  if (hasS3 && s3) {
    await s3.send(new PutObjectCommand({
      Bucket: env.s3.bucket,
      Key: key,
      Body: body,
      ContentType: contentType
    }));
    // Предполагаем, что раздаёшь через CDN/проксюешь
    return {
      storageKey: key,
      publicUrl: `/` + env.s3.bucket + `/` + key
    };
  }

  // локальный диск
  const root = process.env.UPLOADS_DIR;
  if (!root) throw new Error("UPLOADS_DIR не задан (ни S3, ни локальное хранилище)");
  const full = path.join(root, key);
  await fs.mkdir(path.dirname(full), { recursive: true });
  await fs.writeFile(full, body);

  // публичная ссылка (backend должен раздавать /uploads => UPLOADS_DIR)
  const base = (process.env.PUBLIC_BASE_URL || "http://localhost:3000").replace(/\/$/, "");
  return {
    storageKey: key,
    publicUrl: `${base}/uploads/${key}` // для картинок
  };
}
