const commands = require('./commands');
const actions = require('./actions');

exports.configure = bot => {
  bot.command('dispute', async ctx => {
    commands.dispute(ctx, bot);
  });

  bot.action(/^takeDispute_([0-9a-f]{24})$/, async ctx => {
    actions.takeDispute(ctx, bot);
  });
};
