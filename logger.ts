import winston from 'winston';

const level = process.env.LOG_LEVEL || 'notice';

const logger = winston.createLogger({
  format: winston.format.combine(
    winston.format.timestamp({
      format: 'YYYY-MM-DDTHH:mm:ss.SSSZ',
    }),
    winston.format.colorize(),
    winston.format.printf(info => {
      return `[${info.timestamp}] ${info.level}: ${info.message} ${info.stack ? info.stack : ''
        }`;
    })
  ),
  levels: winston.config.syslog.levels,
  level,
  transports: [
    new winston.transports.Console({
      handleExceptions: true,
    }),
  ],
  exitOnError: false,
});

// Enhanced timeout monitoring utilities
export const logTimeout = (operation: string, timeout: number, error?: any) => {
  const logData = {
    operation,
    timeout_ms: timeout,
    timestamp: new Date().toISOString(),
    error: error?.toString() || 'Unknown timeout error'
  };
  logger.error(`TIMEOUT_MONITOR: ${JSON.stringify(logData)}`);
};

export const logOperationDuration = (operation: string, startTime: number, success: boolean = true) => {
  const duration = Date.now() - startTime;
  const logData = {
    operation,
    duration_ms: duration,
    success,
    timestamp: new Date().toISOString()
  };
  
  if (duration > 30000) { // Log slow operations (>30s)
    logger.warn(`SLOW_OPERATION: ${JSON.stringify(logData)}`);
  } else {
    logger.info(`OPERATION_DURATION: ${JSON.stringify(logData)}`);
  }
};

export { logger };