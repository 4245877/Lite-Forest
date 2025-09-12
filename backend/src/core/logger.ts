// core/logger.ts
// Теперь файл не импортирует pino и не экспортирует инстанс логгера.
// Экспортируем только конфиг, который можно переиспользовать при необходимости.

const enablePretty = process.env.PRETTY_LOGS === '1';

export const loggerConfig = {
  level: process.env.LOG_LEVEL ?? 'info',
  ...(enablePretty
    ? { transport: { target: 'pino-pretty', options: { colorize: true, translateTime: 'HH:MM:ss.l' } } }
    : {}),
} as const;
