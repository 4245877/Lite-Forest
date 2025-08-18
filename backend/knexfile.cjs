// backend/knexfile.cjs
require('dotenv').config();
/** @type {import('knex').Knex.Config} */
module.exports = {
  client: 'pg',
  connection: {
    host: process.env.PG_HOST || 'localhost',
    port: Number(process.env.PG_PORT || 5432),
    database: process.env.PG_DB || 'drukarnya',
    user: process.env.PG_USER || 'drukarnya',
    password: process.env.PG_PASSWORD || 'drukarnya'
  },
  pool: {
    min: Number(process.env.PG_POOL_MIN || 2),
    max: Number(process.env.PG_POOL_MAX || 20)
  },
  migrations: {
    directory: './src/migrations',
    tableName: 'knex_migrations'
  },
  seeds: {
    directory: './seeds'
  }
};
