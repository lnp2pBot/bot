// @ts-check
const { userMiddleware } = require('../../middleware/user');
const logger = require('../../../logger');
const ordersActions = require('../../ordersActions');

const commands = require('./commands');
const messages = require('./messages');
const { tooManyPendingOrdersMessage } = require('../../messages');
exports.Scenes = require('./scenes');

exports.configure = bot => {
  bot.command(
    'buy',
    userMiddleware,
    async (ctx, next) => {
      const args = ctx.message.text.split(' ');
      if (args.length > 1) return next();
      if (ctx.message.chat.type !== 'private') return next();
      if (await commands.isMaxPending(ctx.user))
        return await tooManyPendingOrdersMessage(ctx, ctx.user, ctx.i18n);

      commands.buyWizard(ctx);
    },
    commands.buy
  );
  bot.command(
    'sell',
    userMiddleware,
    async (ctx, next) => {
      const args = ctx.message.text.split(' ');
      if (args.length > 1) return next();
      if (ctx.message.chat.type !== 'private') return next();
      if (await commands.isMaxPending(ctx.user))
        return await tooManyPendingOrdersMessage(ctx, ctx.user, ctx.i18n);

      commands.sellWizard(ctx);
    },
    commands.sell
  );

  bot.command('listorders', userMiddleware, async ctx => {
    try {
      const orders = await ordersActions.getOrders(ctx, ctx.user);
      if (!orders) return false;

      const { text, extra } = await messages.listOrdersResponse(
        orders,
        ctx.i18n
      );
      return ctx.reply(text, extra);
    } catch (error) {
      return logger.error(error);
    }
  });
};
