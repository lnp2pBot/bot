import { Telegraf } from 'telegraf';
import { userMiddleware } from '../../middleware/user';
import { CommunityContext } from '../community/communityContext';
import { scheduleorder, cancelschedule } from './commands';

export { scheduleOrderWizard } from './scenes';

export const configure = (bot: Telegraf<CommunityContext>) => {
  bot.command('scheduleorder', userMiddleware, scheduleorder);
  bot.command('cancelschedule', userMiddleware, cancelschedule);
};
