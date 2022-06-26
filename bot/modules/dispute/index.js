const commands = require('./commands');
const actions = require('./actions');
const { userMiddleware } = require('../../middleware/user');

exports.configure = bot => {
  bot.command('dispute', userMiddleware, async ctx => {
    commands.dispute(ctx);
  });

  bot.command('deldispute', userMiddleware, async ctx => {
    commands.deleteDispute(ctx);
  });

  bot.action(/^takeDispute_([0-9a-f]{24})$/, userMiddleware, async ctx => {
    actions.takeDispute(ctx);
  });
};
