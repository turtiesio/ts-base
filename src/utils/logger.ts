import { pino } from 'pino';

// Feel free to adjust options as needed
const logger = pino({
  level:
    process.env.LOG_LEVEL || process.env.NODE_ENV === 'production'
      ? 'info'
      : 'debug',
  transport:
    process.env.NODE_ENV !== 'production'
      ? {
          target: 'pino-pretty',
          options: {
            colorize: true,
          },
        }
      : undefined,
});

export default logger;
