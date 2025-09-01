import path from 'node:path';
import fs from 'node:fs';
import dotenv from 'dotenv';
import { z } from 'zod';


// Load .env from repo root (../.env) if present, else from CWD
const rootEnv = path.resolve(process.cwd(), '../.env');
if (fs.existsSync(rootEnv)) dotenv.config({ path: rootEnv });
else dotenv.config();


const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  HOST: z.string().default('0.0.0.0'),
  PORT: z.coerce.number().default(3000),
  CORS_ORIGIN: z.string().default('*'),

  DATABASE_URL: z.string().optional(),
  DB_HOST: z.string().default('127.0.0.1'),
  DB_PORT: z.coerce.number().default(5432),
  DB_USER: z.string().default('postgres'),
  DB_PASSWORD: z.string().default('postgres'),
  DB_NAME: z.string().default('drukarnya'),

  REDIS_URL: z.string().optional(),

  UPLOADS_DIR: z.string().default(path.resolve(process.cwd(), './uploads')),

  S3_REGION: z.string().optional(),
  S3_BUCKET: z.string().optional(),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),

  ADMIN_TOKEN: z.string().optional(),

  METRICS_ENABLED: z.coerce.boolean().default(true),
});


export const env = EnvSchema.parse(process.env);
