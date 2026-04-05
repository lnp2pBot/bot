import { Telegraf } from 'telegraf';
import { CommunityContext } from '../community/communityContext';
import { logger } from '../../../logger';

const commands = require('./commands');
const messages = require('./messages');
const { userMiddleware } = require('../../middleware/user');

export const configure = (bot: Telegraf<CommunityContext>) => {
  bot.command('block', userMiddleware, async ctx => {
    const args = ctx.message.text.split(' ') || [];
    if (args.length !== 2) {
      await messages.blockUsage(ctx);
      return;
    }
    commands.block(ctx, args[1]);
  });

  bot.command('unblock', userMiddleware, async ctx => {
    const args = ctx.message.text.split(' ') || [];
    if (args.length !== 2) {
      await messages.unblockUsage(ctx);
      return;
    }
    commands.unblock(ctx, args[1]);
  });

  bot.command('blocklist', userMiddleware, async ctx => {
    try {
      await commands.blocklist(ctx);
    } catch (error) {
      logger.error('Error in blocklist command:', error);
      await ctx.reply(
        ctx.i18n?.t('blocklist_error') ?? 'Failed to fetch block list',
      );
    }
  });
};
