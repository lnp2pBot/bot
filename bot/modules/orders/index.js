// @ts-check
const logger = require('../../../logger');
const { Community } = require('../../../models');
const ordersActions = require('../../ordersActions');
const { auth } = require('../user/middleware');
const messages = require('./messages');

const Scenes = require('./scenes')

exports.configure = bot => {
  bot.use(Scenes.middleware())
  bot.command('buywizard', auth, async (ctx, next) => {
    try {
      const args = ctx.message.text.split(' ')
      if (args.length > 1) return next()
      await enterWizard(ctx, ctx.user, 'buy');
    } catch (err) {
      await ctx.reply('ERROR|' + err.message)
    }
  }, notImplementedYet)
  bot.command('sellwizard', auth, async (ctx, next) => {
    try {
      const args = ctx.message.text.split(' ')
      if (args.length > 1) return next()
      await enterWizard(ctx, ctx.user, 'sell');
    } catch (err) {
      await ctx.reply('ERROR|' + err.message)
    }
  }, notImplementedYet)
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

const notImplementedYet = ctx => ctx.reply('NotImplementedYet')

async function enterWizard(ctx, user, type) {
  if (!user.default_community_id) throw new Error('CommunityRequired')
  const comm = await Community.findById(user.default_community_id);
  const state = {
    type,
    currencies: comm.currencies,
    community: comm,
    user
  };
  if (comm.currencies.length === 1) {
    state.currency = comm.currencies[0];
  }
  await ctx.scene.enter(Scenes.CREATE_ORDER, state);
}
