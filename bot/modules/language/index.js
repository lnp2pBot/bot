const { userMiddleware } = require('../../middleware/user');
const commands = require('./commands');

exports.configure = bot => {
  bot.command('setlang', userMiddleware, async ctx => {
    commands.setlang(ctx);
  });

  // bot.action(/^takeDispute_([0-9a-f]{24})$/, userMiddleware, async ctx => {
  //   actions.takeDispute(ctx);
  // });
};
