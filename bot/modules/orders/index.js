// @ts-check
const logger = require('../../../logger');
const { validateUser } = require('../../validations');
const ordersActions = require('../../ordersActions');
const messages = require('./messages');

const Scenes = require('./scenes')

exports.configure = function configure(bot) {
  bot.use(Scenes.middleware())
  bot.command('test', async ctx => {
    const fiats = require('../../../util/fiat.json')
    const currencies = Object.entries(fiats).map(([_, fiat]) => {
      return fiat.code
    }).sort()
    const state = {
      type: 'sell',
      currencies
    }
    await ctx.scene.enter(Scenes.CREATE_ORDER, state)
  })
  bot.command('listorders', async ctx => {
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
