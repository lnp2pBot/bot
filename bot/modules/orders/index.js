// @ts-check
const logger = require('../../../logger');
const ordersActions = require('../../ordersActions');
const { auth } = require('../user/middleware');

const commands = require('./commands');
const messages = require('./messages');
exports.Scenes = require('./scenes');

exports.configure = bot => {
  bot.command(
    'buy',
    auth,
    async (ctx, next) => {
      const args = ctx.message.text.split(' ');
      if (args.length > 1) return next();
      commands.buyWizard(ctx);
    },
    commands.buy
  );
  bot.command(
    'sell',
    auth,
    async (ctx, next) => {
      const args = ctx.message.text.split(' ');
      if (args.length > 1) return next();
      commands.sellWizard(ctx);
    },
    commands.sell
  );

  bot.command('listorders', auth, async ctx => {
    try {
      const orders = await ordersActions.getOrders(ctx, ctx.user);
      if (!orders) return false;

      const { text, extra } = await messages.listOrdersResponse(orders);
      return ctx.reply(text, extra);
    } catch (error) {
      return logger.error(error);
    }
  });
};
