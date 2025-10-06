// services/ingester/src/env.ts
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// 1) Каскад поиска .env: пакет → корень репо
const candidates = [
  path.resolve(process.cwd(), ".env"),
  path.resolve(__dirname, "../../.env"),    // services/ingester/.env
  path.resolve(__dirname, "../../../.env"), // DRUKARNYA/.env (корень репо)
].filter((p) => fs.existsSync(p));

for (const p of candidates) {
  dotenv.config({ path: p });
}

// 2) Фолбек: собрать DATABASE_URL из DB_*
function buildDatabaseUrlFromParts(): string | undefined {
  const host = process.env.DB_HOST ?? "127.0.0.1";
  const port = process.env.DB_PORT ?? "5432";
  const user = process.env.DB_USER;
  const pass = process.env.DB_PASSWORD;
  const name = process.env.DB_NAME;
  if (!user || !pass || !name) return undefined;
  const enc = (s: string) => encodeURIComponent(s);
  return `postgresql://${enc(user)}:${enc(pass)}@${host}:${port}/${name}`;
}

// 3) Экспортируем склеенные переменные
export const env = {
  databaseUrl: process.env.DATABASE_URL || buildDatabaseUrlFromParts(),
  redisUrl: process.env.REDIS_URL || "redis://127.0.0.1:6379/0",
  // поддержим оба названия корня медиа
  mediaBaseDir:
    process.env.MEDIA_BASE_DIR ||
    process.env.UPLOADS_DIR ||
    path.resolve(process.cwd(), "media"),
  // сохраним существующую секцию S3, если она использовалась в проекте
  s3: {
    endpoint: process.env.S3_ENDPOINT || "",
    region: process.env.S3_REGION || "us-east-1",
    bucket: process.env.S3_BUCKET || "",
    accessKeyId: process.env.S3_ACCESS_KEY || "",
    secretAccessKey: process.env.S3_SECRET_KEY || "",
  },
};
