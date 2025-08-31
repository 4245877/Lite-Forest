import pino from 'pino';

const enablePretty = process.env.PRETTY_LOGS === '1';

export const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  ...(enablePretty
    ? { transport: { target: 'pino-pretty', options: { colorize: true } } }
    : {})
});
