// @ts-check
const logger = require('../../../logger');
const { Community, Order } = require('../../../models');
const { isFloat } = require('../../../util');
const {
  validateBuyOrder,
  isBannedFromCommunity,
  validateSeller,
  validateSellOrder,
} = require('../../validations');
const messages = require('../../messages');
const ordersActions = require('../../ordersActions');

const Scenes = require('./scenes');

const buyWizard = async ctx => enterWizard(ctx, ctx.user, 'buy');
const sellWizard = async ctx => enterWizard(ctx, ctx.user, 'sell');

const sell = async ctx => {
  try {
    const user = ctx.user;
    if (await isMaxPending(user))
      return await messages.tooManyPendingOrdersMessage(ctx, user, ctx.i18n);

    // Sellers with orders in status = FIAT_SENT, have to solve the order
    const isOnFiatSentStatus = await validateSeller(ctx, user);

    if (!isOnFiatSentStatus) return;

    const sellOrderParams = await validateSellOrder(ctx);

    if (!sellOrderParams) return;
    const { amount, fiatAmount, fiatCode, paymentMethod } = sellOrderParams;
    let priceMargin = sellOrderParams.priceMargin;
    priceMargin = isFloat(priceMargin)
      ? parseFloat(priceMargin.toFixed(2))
      : parseInt(priceMargin);
    let communityId = null;
    let community = null;
    // If this message came from a group
    // We check if the there is a community for it
    if (ctx.message.chat.type !== 'private') {
      // Allow find communities case insensitive
      const regex = new RegExp(
        ['^', '@' + ctx.message.chat.username, '$'].join(''),
        'i'
      );
      community = await Community.findOne({ group: regex });
      if (!community) {
        ctx.deleteMessage();
        return;
      }
      communityId = community._id;
    } else if (user.default_community_id) {
      communityId = user.default_community_id;
      community = await Community.findOne({ _id: communityId });
    }
    // We verify if the user is not banned on this community
    if (await isBannedFromCommunity(user, communityId))
      return await messages.bannedUserErrorMessage(ctx, user);

    // If the user is in a community, we need to check if the currency is supported
    if (!!community && !community.currencies.includes(fiatCode)) {
      await messages.currencyNotSupportedMessage(ctx, community.currencies);
      return;
    }
    // @ts-ignore
    const order = await ordersActions.createOrder(ctx.i18n, ctx, user, {
      type: 'sell',
      amount,
      fiatAmount,
      fiatCode,
      paymentMethod,
      status: 'PENDING',
      priceMargin,
      community_id: communityId,
    });
    if (order) {
      await messages.publishSellOrderMessage(ctx, user, order, ctx.i18n, true);
    }
  } catch (error) {
    logger.error(error);
  }
};

const buy = async ctx => {
  try {
    const user = ctx.user;
    if (await isMaxPending(user))
      return await messages.tooManyPendingOrdersMessage(ctx, user, ctx.i18n);

    const buyOrderParams = await validateBuyOrder(ctx);
    if (!buyOrderParams) return;

    const { amount, fiatAmount, fiatCode, paymentMethod } = buyOrderParams;
    let priceMargin = buyOrderParams.priceMargin;
    priceMargin = isFloat(priceMargin)
      ? parseFloat(priceMargin.toFixed(2))
      : parseInt(priceMargin);
    let communityId = null;
    let community = null;
    // If this message came from a group
    // We check if the there is a community for it
    if (ctx.message.chat.type !== 'private') {
      // Allow find communities case insensitive
      const regex = new RegExp(
        ['^', '@' + ctx.message.chat.username, '$'].join(''),
        'i'
      );
      community = await Community.findOne({ group: regex });
      if (!community) {
        ctx.deleteMessage();
        return;
      }
      communityId = community._id;
    } else if (user.default_community_id) {
      communityId = user.default_community_id;
      community = await Community.findOne({ _id: communityId });
    }
    // We verify if the user is not banned on this community
    if (await isBannedFromCommunity(user, communityId))
      return await messages.bannedUserErrorMessage(ctx, user);

    // If the user is in a community, we need to check if the currency is supported
    if (!!community && !community.currencies.includes(fiatCode)) {
      await messages.currencyNotSupportedMessage(ctx, community.currencies);
      return;
    }
    // @ts-ignore
    const order = await ordersActions.createOrder(ctx.i18n, ctx, user, {
      type: 'buy',
      amount,
      fiatAmount,
      fiatCode,
      paymentMethod,
      status: 'PENDING',
      priceMargin,
      community_id: communityId,
    });

    if (order) {
      await messages.publishBuyOrderMessage(ctx, user, order, ctx.i18n, true);
    }
  } catch (error) {
    logger.error(error);
  }
};

async function enterWizard(ctx, user, type) {
  const state = {
    type,
    user,
  };
  if (user.default_community_id) {
    const comm = await Community.findById(user.default_community_id);
    state.community = comm;
    state.currencies = comm.currencies;
    if (comm.currencies.length === 1) {
      state.currency = comm.currencies[0];
    }
  }
  await ctx.scene.enter(Scenes.CREATE_ORDER, state);
}

const isMaxPending = async user => {
  const pendingOrders = await Order.count({
    status: 'PENDING',
    creator_id: user._id,
  });
  // We don't let users create too PENDING many orders
  if (pendingOrders >= parseInt(process.env.MAX_PENDING_ORDERS)) {
    return true;
  }
  return false;
};

const chat = async ctx => {
  try {
    const { user } = ctx;
    const [, orderId] = ctx.message.text.split(' ');
    const order = await Order.findById(orderId);
    await ctx.scene.enter('ORDER_CHAT', { user, order });
  } catch (err) {
    await ctx.reply(err.message);
  }
};

module.exports = { buyWizard, sellWizard, buy, sell, chat, isMaxPending };
