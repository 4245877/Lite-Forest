import knex, { Knex } from 'knex';
import { env } from '../core/env.js';

// ✅ типобезопасно: numeric(1700) -> number
import pg from 'pg';
const { types } = pg;
types.setTypeParser(1700, (val: string) => parseFloat(val)); // NUMERIC/DECIMAL => number

export const db: Knex = knex({
  client: 'pg',
  connection: env.DATABASE_URL ?? {
    host: env.DB_HOST,
    port: env.DB_PORT,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    database: env.DB_NAME
  },
  pool: { min: 0, max: 10 }
});

export async function pingDb(): Promise<boolean> {
  try {
    await db.raw('select 1');
    return true;
  } catch {
    return false;
  }
}
