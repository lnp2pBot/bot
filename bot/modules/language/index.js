const { userMiddleware } = require('../../middleware/user');
const commands = require('./commands');
const actions = require('./actions');

exports.configure = bot => {
  bot.command('setlang', userMiddleware, commands.setlang);
  bot.action(/^setLanguage_([a-z]{2})$/, userMiddleware, actions.setLanguage);
};
