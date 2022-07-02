const commands = require('./commands');
const actions = require('./actions');
const { userMiddleware, adminMiddleware } = require('../../middleware/user');

exports.configure = bot => {
  bot.command('dispute', userMiddleware, commands.dispute);
  bot.command('deldispute', adminMiddleware, commands.deleteDispute);
  bot.action(
    /^takeDispute_([0-9a-f]{24})$/,
    userMiddleware,
    actions.takeDispute
  );
};
