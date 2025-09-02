// Локальное хранилище + тонкий слой для будущего S3 (по env)
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { env } from './env.js';

export interface StoredFile {
  url: string;
  key: string;
}

export interface StoredImage {
  url: string;
  thumbUrl: string;
  key: string;       // ключ оригинала
  thumbKey: string;  // ключ превью
  width?: number;
  height?: number;
  mime?: string;
}

export async function saveLocal(file: Buffer, filename: string): Promise<StoredFile> {
  const base = env.UPLOADS_DIR;
  await fs.mkdir(base, { recursive: true });
  const key = `${Date.now()}_${filename}`;
  const full = path.join(base, key);
  await fs.writeFile(full, file);
  // файл будет доступен по /uploads/<key>
  return { url: `/uploads/${key}`, key };
}

export async function saveImageLocal(file: Buffer, filename: string): Promise<StoredImage> {
  const base = env.UPLOADS_DIR;
  const originals = path.join(base, 'originals');
  const thumbs = path.join(base, 'thumbs');
  await fs.mkdir(originals, { recursive: true });
  await fs.mkdir(thumbs, { recursive: true });

  const safe = filename.replace(/[^a-z0-9._-]+/gi, '_');
  const ts = Date.now();
  const origKey = `${ts}_${safe}`;
  const origFull = path.join(originals, origKey);

  // сохраняем оригинал как есть
  await fs.writeFile(origFull, file);

  // готовим миниатюру ~400px по большей стороне, webp
  const image = sharp(file, { failOnError: false }).rotate();
  const meta = await image.metadata();
  const thumbKey = `${ts}_${safe}.webp`;
  const thumbFull = path.join(thumbs, thumbKey);
  await image
    .resize({ width: 400, height: 400, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 82 })
    .toFile(thumbFull);

  return {
    url: `/uploads/originals/${origKey}`,
    thumbUrl: `/uploads/thumbs/${thumbKey}`,
    key: origKey,
    thumbKey,
    width: meta.width,
    height: meta.height,
    mime: meta.format ? `image/${meta.format}` : undefined,
  };
}
