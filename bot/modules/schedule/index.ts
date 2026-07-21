import { Telegraf } from 'telegraf';
import { userMiddleware } from '../../middleware/user';
import { CommunityContext } from '../community/communityContext';
import {
  scheduleorder,
  cancelschedule,
  listschedules,
  cancelallschedules,
} from './commands';

export { scheduleOrderWizard } from './scenes';

export const configure = (bot: Telegraf<CommunityContext>) => {
  bot.command('scheduleorder', userMiddleware, scheduleorder);
  bot.command('cancelschedule', userMiddleware, cancelschedule);
  bot.command('listschedules', userMiddleware, listschedules);
  bot.command('cancelallschedules', userMiddleware, cancelallschedules);
};
