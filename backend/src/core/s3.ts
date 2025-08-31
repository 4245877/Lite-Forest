// Локальное хранилище + тонкий слой для будущего S3 (по env)
import fs from 'node:fs/promises';
import path from 'node:path';
import { env } from './env.js';


export interface StoredFile {
url: string;
key: string;
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