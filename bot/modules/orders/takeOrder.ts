import { logger } from '../../../logger';
import { Block, Order, User } from '../../../models';
import { UserDocument } from '../../../models/user';
import { deleteOrderFromChannel, generateRandomImage } from '../../../util';
import * as messages from '../../messages';
import { HasTelegram, MainContext } from '../../start';
import {
  isBannedFromCommunity,
  validateObjectId,
  validateSeller,
  validateTakeBuyOrder,
  validateTakeSellOrder,
  validateUserWaitingOrder,
} from '../../validations';

const OrderEvents = require('../../modules/events/orders');

export const takeOrderActionValidation = async (
  ctx: MainContext,
  next: () => void
) => {
  try {
    const text = (ctx.update as any).callback_query.message.text;
    if (!text) return;
    next();
  } catch (err) {
    logger.error(err);
  }
};
export const takeOrderValidation = async (
  ctx: MainContext,
  next: () => void
) => {
  try {
    const { user } = ctx;
    if (!(await validateUserWaitingOrder(ctx, ctx, user))) return;
    next();
  } catch (err) {
    logger.error(err);
  }
};
export const takebuyValidation = async (ctx: MainContext, next: () => void) => {
  try {
    // Sellers with orders in status = FIAT_SENT, have to solve the order
    const isOnFiatSentStatus = await validateSeller(ctx, ctx.user);
    if (!isOnFiatSentStatus) return;
    next();
  } catch (err) {
    logger.error(err);
  }
};
export const takebuy = async (
  ctx: MainContext,
  bot: HasTelegram,
  orderId: string
) => {
  try {
    if (!orderId) return;
    const { user } = ctx;
    if (!(await validateObjectId(ctx, orderId))) return;
    const order = await Order.findOne({ _id: orderId });
    if (!order) return;

    const userOffer = await User.findOne({ _id: order.buyer_id });

    if (!userOffer) {
      return await messages.notFoundUserMessage(ctx);
    } else if (await checkBlockingStatus(ctx, user, userOffer)) {
      return;
    }

    // We verify if the user is not banned on this community
    if (await isBannedFromCommunity(user, order.community_id))
      return await messages.bannedUserErrorMessage(ctx, user);

    if (!(await validateTakeBuyOrder(ctx, bot, user, order))) return;

    const { randomImage, isGoldenHoneyBadger } = await generateRandomImage(user._id.toString());

    order.status = 'WAITING_PAYMENT';
    order.seller_id = user._id;
    order.taken_at = new Date(Date.now());

    order.random_image = randomImage;
    order.is_golden_honey_badger = isGoldenHoneyBadger;

    await order.save();
    order.status = 'in-progress';
    OrderEvents.orderUpdated(order);

    await deleteOrderFromChannel(order, bot.telegram);

    await messages.beginTakeBuyMessage(ctx, bot, user, order);
  } catch (error) {
    logger.error(error);
  }
};
export const takesell = async (
  ctx: MainContext,
  bot: HasTelegram,
  orderId: string
) => {
  try {
    const { user } = ctx;
    if (!orderId) return;
    const order = await Order.findOne({ _id: orderId });
    if (!order) return;
    const seller = await User.findOne({ _id: order.seller_id });
    if(seller === null) {
      throw new Error("seller is null");
    }

    const sellerIsBlocked = await Block.exists({
      blocker_tg_id: user.tg_id,
      blocked_tg_id: seller.tg_id,
    });
    const buyerIsBlocked = await Block.exists({
      blocker_tg_id: seller.tg_id,
      blocked_tg_id: user.tg_id,
    });

    if (sellerIsBlocked)
      return await messages.userOrderIsBlockedByUserTaker(ctx, user);

    if (buyerIsBlocked)
      return await messages.userTakerIsBlockedByUserOrder(ctx, user);

    // We verify if the user is not banned on this community
    if (await isBannedFromCommunity(user, order.community_id))
      return await messages.bannedUserErrorMessage(ctx, user);
    if (!(await validateTakeSellOrder(ctx, bot, user, order))) return;
    order.status = 'WAITING_BUYER_INVOICE';
    order.buyer_id = user._id;
    order.taken_at = new Date(Date.now());

    await order.save();
    order.status = 'in-progress';
    OrderEvents.orderUpdated(order);
    // We delete the messages related to that order from the channel
    await deleteOrderFromChannel(order, bot.telegram);
    await messages.beginTakeSellMessage(ctx, bot, user, order);
  } catch (error) {
    logger.error(error);
  }
};

const checkBlockingStatus = async (ctx: MainContext, user: UserDocument, otherUser: UserDocument) => {
  const userIsBlocked = await Block.exists({
    blocker_tg_id: user.tg_id,
    blocked_tg_id: otherUser.tg_id,
  });
  if (userIsBlocked) {
    await messages.userOrderIsBlockedByUserTaker(ctx, user);
    return true;
  }

  const takerIsBlocked = await Block.exists({
    blocker_tg_id: otherUser.tg_id,
    blocked_tg_id: user.tg_id,
  });
  if (takerIsBlocked) {
    await messages.userTakerIsBlockedByUserOrder(ctx, user);
    return true;
  }

  return false;
};
