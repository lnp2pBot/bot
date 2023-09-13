import * as winston from 'winston';

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


export default logger;
