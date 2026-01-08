import { MiddlewareFn } from 'telegraf';
import { CommunityContext } from '../modules/community/communityContext';
import winston from 'winston';
import { extractId } from '../../util';

const logFile = process.env.COMMAND_LOG_FILE || 'commands.log';
const maxSizeGB = parseInt(process.env.COMMAND_LOG_SIZE_GB || '5', 10) || 5;

const logger = winston.createLogger({
  format: winston.format.combine(
    winston.format.timestamp({
      format: 'YYYY-MM-DDTHH:mm:ss.SSSZ',
    }),
    winston.format.printf(info => {
      return `[${info.timestamp}] ${info.level}: ${info.message} ${
        info.stack ? info.stack : ''
      }`;
    }),
  ),
  levels: winston.config.syslog.levels,
  level: 'debug',
  transports: [
    new winston.transports.File({
      filename: logFile,
      maxsize: maxSizeGB * 1024 ** 3, // 5GB
    }),
  ],
  exitOnError: false,
});

export function commandLogger(): MiddlewareFn<CommunityContext> {
  return async (ctx, next) => {
    try {
      if (ctx.message && 'text' in ctx.message) {
        const msg = ctx.message;
        const text = msg.text.trim();
        const userId = msg.from?.id ?? 'unknown';

        let command: string | null = null;
        let args: string[] = [];
        let isCommand: boolean;

        if (text.startsWith('/')) {
          const parts = text.split(/\s+/);
          command = parts[0];
          args = parts.slice(1);
          isCommand = true;
        } else {
          isCommand = false;
          command = text;
        }

        const userName = msg.from?.username ?? '';

        logger.info(
          `User @${userName} [${userId}] ${isCommand ? 'executed command:' : 'sent message:'} ${command} with args: [${args.join(', ')}]`,
        );
      } else if (ctx.callbackQuery && 'data' in ctx.callbackQuery) {
        // Attempt to get message text

        const callbackQueryMessage =
          (ctx.callbackQuery?.message as any)?.text ?? '';
        const isId = /^[a-f0-9]{24}$/.test(callbackQueryMessage);
        const orderId = isId
          ? callbackQueryMessage
          : extractId(callbackQueryMessage);
        const msgText = orderId
          ? `Order ID: ${orderId}`
          : `Message text: '${callbackQueryMessage}'`;
        const callbackData = ctx.callbackQuery.data;
        const userName = ctx.callbackQuery.from?.username ?? '';
        const userId = ctx.callbackQuery.from?.id ?? '';
        logger.info(
          `User @${userName} [${userId}] sent callback query with data: ${callbackData}. '${msgText}'`,
        );
      } else {
        logger.info(`Received non-command message or update from user.`);
      }
    } catch (err) {
      logger.error('logging middleware failed', err);
    }

    return next();
  };
}
