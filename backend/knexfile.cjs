// backend/knexfile.cjs
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

// грузим .env из корня репо (../.env)
const rootEnv = path.resolve(__dirname, '../.env');
if (fs.existsSync(rootEnv)) dotenv.config({ path: rootEnv });
else dotenv.config();

const connection = process.env.DATABASE_URL || {
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 5432),
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME || 'drukarnya',
};

module.exports = {
  development: {
    client: 'pg',
    connection,
    migrations: { directory: path.resolve(__dirname, './dist/db/migrations') },
    seeds: { directory: path.resolve(__dirname, './dist/db/seeds') },
  },
  production: {
    client: 'pg',
    connection,
    migrations: { directory: path.resolve(__dirname, './dist/db/migrations') },
    seeds: { directory: path.resolve(__dirname, './dist/db/seeds') },
  },
};
