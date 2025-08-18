import dotenv from 'dotenv';
dotenv.config();
export const env = {
    NODE_ENV: process.env.NODE_ENV || 'development',
    PORT: Number(process.env.PORT || 8080),
    LOG_LEVEL: (process.env.LOG_LEVEL || 'info'),
    PG: {
        host: process.env.PG_HOST || 'localhost',
        port: Number(process.env.PG_PORT || 5432),
        db: process.env.PG_DB || 'drukarnya',
        user: process.env.PG_USER || 'drukarnya',
        password: process.env.PG_PASSWORD || 'drukarnya',
        poolMin: Number(process.env.PG_POOL_MIN || 2),
        poolMax: Number(process.env.PG_POOL_MAX || 20)
    },
    CORS_ORIGIN: process.env.CORS_ORIGIN || '*',
    S3_PUBLIC_BASE_URL: process.env.S3_PUBLIC_BASE_URL || ''
};
