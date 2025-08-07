// backend/src/db.ts
import { Pool } from 'pg';
import 'dotenv/config'; // Загружает переменные из .env

// Пул соединений - это ключевой элемент производительности.
// Он управляет несколькими подключениями к БД одновременно,
// вместо того чтобы открывать и закрывать их на каждый запрос.
const pool = new Pool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

export default pool;