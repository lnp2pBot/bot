import * as commands from './commands';
import * as actions from './actions';
import { Telegraf } from 'telegraf';
import { MainContext } from '../../start';
const { userMiddleware, adminMiddleware } = require('../../middleware/user');

export const configure = (bot: Telegraf<MainContext>) => {
  bot.command('dispute', userMiddleware, commands.dispute);
  bot.command('deldispute', adminMiddleware, commands.deleteDispute);
  bot.action(
    /^takeDispute_([0-9a-f]{24})$/,
    userMiddleware,
    actions.takeDispute
  );
};
