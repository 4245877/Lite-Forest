import type { Knex } from 'knex';
import { env } from './src/core/env.js';


const common: Knex.Config = {
client: 'pg',
connection: env.DATABASE_URL ?? {
host: env.DB_HOST,
port: env.DB_PORT,
user: env.DB_USER,
password: env.DB_PASSWORD,
database: env.DB_NAME,
},
migrations: { directory: './src/db/migrations' },
seeds: { directory: './src/db/seeds' }
};


const config: { [key: string]: Knex.Config } = {
development: common,
production: common
};


export default config;