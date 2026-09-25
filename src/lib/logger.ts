import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
  formatters: {
    level: (label) => ({ level: label }),
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});

export function createChildLogger(correlationId: string, extraContext: Record<string, unknown> = {}) {
  return logger.child({
    correlationId,
    ...extraContext,
  });
}
