import * as commands from './commands';
import * as actions from './actions';
import { Telegraf } from 'telegraf';
import { userMiddleware, adminMiddleware } from '../../middleware/user';
import { CommunityContext } from '../community/communityContext';
export * as Scenes from './scenes';

export const configure = (bot: Telegraf<CommunityContext>) => {
  bot.command(
    'dispute',
    userMiddleware,
    async (ctx, next) => {
      const args = ctx.message.text.split(' ');
      if (args.length > 1) return next();
      if (ctx.message.chat.type !== 'private') return next();
      return commands.disputeWizard(ctx);
    },
    commands.dispute
  );

  bot.command('deldispute', adminMiddleware, commands.deleteDispute);

  bot.action(
    /^takeDispute_([0-9a-f]{24})$/,
    userMiddleware,
    actions.takeDispute
  );
};
