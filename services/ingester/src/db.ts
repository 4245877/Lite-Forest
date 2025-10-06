// services/ingester/src/db.ts
import knexFactory from "knex";
import { env } from "./env.js";

const connection =
  env.databaseUrl ||
  {
    host: process.env.DB_HOST || "127.0.0.1",
    port: Number(process.env.DB_PORT || 5432),
    user: process.env.DB_USER || "postgres",
    password: process.env.DB_PASSWORD || "postgres",
    database: process.env.DB_NAME || "drukarnya",
  };

const knex = knexFactory({
  client: "pg",
  connection,
  pool: {
    min: 0,
    max: 10,
    // иногда полезно задать таймауты, чтобы не висеть:
    acquireTimeoutMillis: 15000,
    idleTimeoutMillis: 30000,
    createTimeoutMillis: 10000,
  },
  migrations: { tableName: "knex_migrations" },
});

export default knex;
