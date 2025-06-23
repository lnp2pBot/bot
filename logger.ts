import winston from 'winston';

const level = process.env.LOG_LEVEL || 'notice';

// Suppress all logging during tests
const isTestEnvironment = process.env.NODE_ENV === 'test';

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
  transports: isTestEnvironment ? [] : [
    new winston.transports.Console({
      handleExceptions: true,
    }),
  ],
  exitOnError: false,
});

// If no transports in test mode, add a null transport to prevent winston warnings
if (isTestEnvironment) {
  logger.add(new winston.transports.Console({ silent: true }));
}

export { logger };