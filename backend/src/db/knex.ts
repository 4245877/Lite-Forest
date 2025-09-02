import knex, { Knex } from 'knex';
import { env } from '../core/env.js';

// 👇 ДОБАВЛЕНО:
import { types } from 'pg';
types.setTypeParser(1700, (v) => (v === null ? null : parseFloat(v))); // numeric/decimal → number

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
