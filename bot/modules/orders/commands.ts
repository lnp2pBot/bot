import { logger } from '../../../logger';
import { Order } from '../../../models';
import { isFloat } from '../../../util';
import {
  validateBuyOrder,
  validateSeller,
  validateSellOrder,
  validateParams,
  validateObjectId,
} from '../../validations';
import * as messages from '../../messages';
import * as ordersActions from '../../ordersActions';
import { deletedCommunityMessage } from './messages';
import {
  getCommunityInfo,
  isCurrencySupported,
} from '../../../util/communityHelper';
import { takebuy, takesell, takebuyValidation } from './takeOrder';

import * as Scenes from './scenes';
import { CommunityContext } from '../community/communityContext';
import { MainContext } from '../../start';
import { UserDocument } from '../../../models/user';
import { ICommunity } from '../../../models/community';
import { Chat } from 'telegraf/typings/core/types/typegram';

interface EnterWizardState {
  community?: ICommunity;
  currency?: string;
  currencies?: string[];
  type: string;
  user: UserDocument;
}

const buyWizard = async (ctx: CommunityContext) =>
  enterWizard(ctx, ctx.user, 'buy');
const sellWizard = async (ctx: CommunityContext) =>
  enterWizard(ctx, ctx.user, 'sell');

const sell = async (ctx: MainContext, republishCount = 0) => {
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

    // Optimized community lookup - single database query instead of multiple
    const communityInfo = await getCommunityInfo(
      user,
      ctx.message?.chat.type || 'private',
      ctx.message?.chat as Chat.UserNameChat,
    );

    const { community, communityId, isBanned } = communityInfo;

    // Handle community not found in group chat
    if (ctx.message?.chat.type !== 'private' && !community) {
      return ctx.deleteMessage();
    }

    // Handle deleted default community
    if (
      ctx.message?.chat.type === 'private' &&
      user.default_community_id &&
      !community
    ) {
      return deletedCommunityMessage(ctx);
    }

    // Check if user is banned
    if (isBanned) {
      return await messages.bannedUserErrorMessage(ctx, user);
    }

    // Check if currency is supported
    if (!isCurrencySupported(community, fiatCode)) {
      return await messages.currencyNotSupportedMessage(
        ctx,
        community?.currencies || [],
      );
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
      republish_count: republishCount,
    });
    if (order)
      await messages.publishSellOrderMessage(ctx, user, order, ctx.i18n, true);
  } catch (error) {
    logger.error(error);
  }
};

const buy = async (ctx: MainContext, republishCount = 0) => {
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

    // Optimized community lookup - single database query instead of multiple
    const communityInfo = await getCommunityInfo(
      user,
      ctx.message?.chat.type || 'private',
      ctx.message?.chat as Chat.UserNameChat,
    );

    const { community, communityId, isBanned } = communityInfo;

    // Handle community not found in group chat
    if (ctx.message?.chat.type !== 'private' && !community) {
      await ctx.deleteMessage();
      return;
    }

    // Handle deleted default community
    if (
      ctx.message?.chat.type === 'private' &&
      user.default_community_id &&
      !community
    ) {
      return deletedCommunityMessage(ctx);
    }

    // Check if user is banned
    if (isBanned) {
      return await messages.bannedUserErrorMessage(ctx, user);
    }

    // Check if currency is supported
    if (!isCurrencySupported(community, fiatCode)) {
      await messages.currencyNotSupportedMessage(
        ctx,
        community?.currencies || [],
      );
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
      republish_count: republishCount,
    });

    if (order) {
      await messages.publishBuyOrderMessage(ctx, user, order, ctx.i18n, true);
    }
  } catch (error) {
    logger.error(error);
  }
};

// /scheduleorder <buy|sell> <amount> <fiat_amount> <fiat_code> <method> [premium]
// Creates an order that auto-republishes on expiry. It reuses the regular buy/
// sell flow, only seeding republish_count so the delete_published_orders job
// republishes the order instead of deleting it.
const scheduleOrder = async (ctx: MainContext) => {
  try {
    const user = ctx.user;
    const args = ctx.state.command.args;
    const type = (args[0] || '').toString().toLowerCase();
    if (type !== 'buy' && type !== 'sell') {
      return await messages.invalidTypeOrderMessage(ctx, ctx, user, type);
    }
    const republishCount = parseInt(
      process.env.REPUBLISH_ORDER_DAYS || '10',
      10,
    );
    // Drop the buy|sell token so the existing order validators read the params
    ctx.state.command.args = args.slice(1);
    if (type === 'sell') return await sell(ctx, republishCount);
    return await buy(ctx, republishCount);
  } catch (error) {
    logger.error(error);
  }
};

// /cancelschedule <order_id> — stops a scheduled order from auto-republishing
const cancelSchedule = async (ctx: MainContext) => {
  try {
    const user = ctx.user;
    const params = await validateParams(ctx, 2, '\\<_order id_\\>');
    if (params === null || params.length === 0) return;
    const [orderId] = params;
    if (!(await validateObjectId(ctx, orderId))) return;
    // Scope the lookup to the creator so only the owner can cancel its schedule
    const order = await Order.findOne({
      _id: orderId,
      creator_id: user._id.toString(),
    });
    if (order === null) return await messages.notActiveOrderMessage(ctx);
    order.republish_count = 0;
    await order.save();
    await messages.scheduleOrderCanceledMessage(ctx, order);
  } catch (error) {
    logger.error(error);
  }
};

async function enterWizard(
  ctx: CommunityContext,
  user: UserDocument,
  type: string,
) {
  const state: EnterWizardState = {
    type,
    user,
  };
  if (user.default_community_id) {
    // Use optimized community lookup
    const communityInfo = await getCommunityInfo(user, 'private');
    const { community, isBanned } = communityInfo;

    if (!community) {
      return deletedCommunityMessage(ctx);
    }

    // Check if user is banned
    if (isBanned) {
      return await messages.bannedUserErrorMessage(ctx, user);
    }

    state.community = community;
    state.currencies = community.currencies;
    if (community.currencies.length === 1) {
      state.currency = community.currencies[0];
    }
  }

  await ctx.scene.enter(Scenes.CREATE_ORDER, state);
}

const isMaxPending = async (user: UserDocument) => {
  const pendingOrders = await Order.countDocuments({
    creator_id: user._id,
    status: 'PENDING',
  });
  const maxPendingOrders = process.env.MAX_PENDING_ORDERS;
  if (maxPendingOrders === undefined)
    throw new Error('Environment variable MAX_PENDING_ORDERS is not defined');
  // We don't let users create too PENDING many orders
  if (pendingOrders >= parseInt(maxPendingOrders)) {
    return true;
  }
  return false;
};

const takeOrder = async (ctx: MainContext) => {
  try {
    const validateParamsResult = await validateParams(
      ctx,
      2,
      '\\<_order id_\\>',
    );
    if (validateParamsResult === null || validateParamsResult.length === 0)
      throw new Error('validateParams failed');
    const [orderId] = validateParamsResult;
    const order = await Order.findOne({
      _id: orderId,
      status: 'PENDING',
    });
    if (!order) throw new Error('OrderNotFound');
    switch (order.type) {
      case 'buy': {
        let valid = false;
        await takebuyValidation(ctx, () => {
          valid = true;
        });
        if (!valid) return;
        return takebuy(ctx, ctx, orderId);
      }
      case 'sell': {
        return takesell(ctx, ctx, orderId);
      }
    }
  } catch (err: any) {
    switch (err.message) {
      case 'OrderNotFound':
        return ctx.reply(ctx.i18n.t('order_not_found'));
      default:
        return ctx.reply(ctx.i18n.t('generic_error'));
    }
  }
};

export {
  buyWizard,
  sellWizard,
  buy,
  sell,
  scheduleOrder,
  cancelSchedule,
  isMaxPending,
  takeOrder,
};
