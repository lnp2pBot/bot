import { Telegraf } from 'telegraf';
import { userMiddleware } from '../../middleware/user';
import { CommunityContext } from '../community/communityContext';
import {
  scheduleorder,
  cancelschedule,
  handleScheduleCallback,
  handleScheduleText,
} from './commands';

export const configure = (bot: Telegraf<CommunityContext>) => {
  bot.command('scheduleorder', userMiddleware, ctx => scheduleorder(ctx));
  bot.command('cancelschedule', userMiddleware, ctx => cancelschedule(ctx));

  // Multi-step flow: inline button callbacks and free-text replies
  bot.on('callback_query', userMiddleware, async (ctx, next) => {
    const handled = await handleScheduleCallback(ctx, bot);
    if (!handled) return next();
  });

  bot.on('text', userMiddleware, async (ctx, next) => {
    const handled = await handleScheduleText(ctx, bot);
    if (!handled) return next();
  });
};
