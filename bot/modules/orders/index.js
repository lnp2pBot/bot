// @ts-check
const logger = require('../../../logger');
const { Community } = require('../../../models');
const { validateUser } = require('../../validations');
const ordersActions = require('../../ordersActions');
const messages = require('./messages');

const Scenes = require('./scenes')

exports.configure = function configure(bot) {
  bot.use(Scenes.middleware())
  bot.command('buywizard', async ctx => {
    try {
      const user = await validateUser(ctx, false);
      if (!user) return false;

      if (!user.default_community_id) throw new Error('CommunityRequired')
      const comm = await Community.findById(user.default_community_id)
      const state = {
        type: 'buy',
        currencies: comm.currencies,
        community: comm,
        user
      }
      if (comm.currencies.length === 1) {
        state.currency = comm.currencies[0]
      }
      await ctx.scene.enter(Scenes.CREATE_ORDER, state)
    } catch (err) {
      await ctx.reply('ERROR|' + err.message)
    }
  })
  bot.command('sellwizard', async ctx => {
    try {
      const user = await validateUser(ctx, false);
      if (!user) return false;

      if (!user.default_community_id) throw new Error('CommunityRequired')
      const comm = await Community.findById(user.default_community_id)
      const state = {
        type: 'sell',
        currencies: comm.currencies,
        communityId: user.default_community_id
      }
      if (comm.currencies.length === 1) {
        state.currency = comm.currencies[0]
      }
      await ctx.scene.enter(Scenes.CREATE_ORDER, state)
    } catch (err) {
      await ctx.reply('ERROR|' + err.message)
    }
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
