// services/ingester/src/storage.ts
import fs from "node:fs/promises";
import path from "node:path";
import { env } from "./env.js";

// опциональный S3-клиент
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
  // 1. S3 (если есть)
  if (hasS3 && s3) {
    await s3.send(new PutObjectCommand({
      Bucket: env.s3.bucket,
      Key: key,
      Body: body,
      ContentType: contentType
    }));
    return {
      storageKey: key,
      publicUrl: `/` + env.s3.bucket + `/` + key
    };
  }

  // 2. Локальный диск
  // Если переменная не задана, используем папку 'uploads' в корне проекта
  const rawRoot = process.env.UPLOADS_DIR || 'uploads';
  
  // Превращаем путь в абсолютный (D:\...\uploads), чтобы Node.js не путался
  const root = path.resolve(process.cwd(), rawRoot);

  // Склеиваем путь к файлу
  const fullPath = path.join(root, key);
  const dir = path.dirname(fullPath);

  // Создаем папку (рекурсивно)
  try {
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(fullPath, body);
    
    // Лог для проверки (увидишь в консоли)
    console.log(`[storage] Saved: ${fullPath}`);
  } catch (err) {
    console.error(`[storage] FAILED to write at: ${fullPath}`);
    throw err;
  }

  // Формируем публичную ссылку
  const base = (process.env.PUBLIC_BASE_URL || "http://localhost:3000").replace(/\/$/, "");
  
  // Важно: для URL используем прямые слеши /, даже на Windows
  const urlKey = key.split(path.sep).join('/');
  
  return {
    storageKey: urlKey,
    publicUrl: `${base}/uploads/${urlKey}`
  };
}