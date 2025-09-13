// backend/src/core/logger.ts
import pino, { LoggerOptions } from 'pino';

const enablePretty = process.env.PRETTY_LOGS === '1';

export const loggerConfig: LoggerOptions = {
  level: process.env.LOG_LEVEL ?? 'info',
  ...(enablePretty
    ? {
        transport: {
          target: 'pino-pretty',
          options: { colorize: true, translateTime: 'HH:MM:ss.l' }
        }
      }
    : {})
};

// 👉 Вернули готовый инстанс — чтобы его могли использовать воркеры/скрипты
export const logger = pino(loggerConfig);
