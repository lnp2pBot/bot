// @ts-check
const logger = require('../../../logger');
const { validateUser } = require('../../validations');
const ordersActions = require('../../ordersActions');
const messages = require('./messages');

exports.configure = function configure(bot) {
  bot.command('listorders', async (ctx) => {
    try {
      const user = await validateUser(ctx, false);
      if (!user) return false;

      const orders = await ordersActions.getOrders(ctx, user);
      if (!orders) return false;

      const { text, extra } = await messages.listOrdersResponse(orders);
      return ctx.reply(text, extra);
    } catch (error) {
      return logger.error(error);
    }
  });
};
