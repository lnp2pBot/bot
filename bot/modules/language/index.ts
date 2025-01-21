const { userMiddleware } = require('../../middleware/user');
import * as commands from './commands';
import * as actions from './actions';
import { Telegraf } from 'telegraf';
import { MainContext } from '../../start';

exports.configure = (bot: Telegraf) => {
  bot.command('setlang', userMiddleware, ctx => commands.setlang(ctx as unknown as MainContext));
  bot.action(/^setLanguage_([a-z]{2})$/, userMiddleware, ctx => actions.setLanguage(ctx as unknown as MainContext));
};
