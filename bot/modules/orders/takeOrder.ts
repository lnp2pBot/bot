import { logger } from '../../../logger';
import { Block, Order, User, ScheduledOrder } from '../../../models';
import { UserDocument } from '../../../models/user';
import {
  deleteOrderFromChannel,
  generateRandomImage,
  getUserI18nContext,
  PerOrderIdMutex,
} from '../../../util';
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
import { getRepublishCount } from '../schedule/helpers';

const OrderEvents = require('../../modules/events/orders');

export const takeOrderActionValidation = async (
  ctx: MainContext,
  next: () => void,
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
  next: () => void,
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
  orderId: string,
) => {
  try {
    await PerOrderIdMutex.instance.runExclusive(orderId, async () => {
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

      const { randomImage } = generateRandomImage(user._id.toString());

      order.status = 'WAITING_PAYMENT';
      order.seller_id = user._id;
      order.taken_at = new Date(Date.now());

      order.random_image = randomImage;

      await order.save();
      order.status = 'in-progress';
      OrderEvents.orderUpdated(order);

      await deleteOrderFromChannel(order, bot.telegram);
      const refreshBuyPromise = refreshScheduledOrder(order._id, bot);
      await messages.beginTakeBuyMessage(ctx, bot, user, order);
      await refreshBuyPromise;
    });
  } catch (error) {
    logger.error(error);
  }
};
export const takesell = async (
  ctx: MainContext,
  bot: HasTelegram,
  orderId: string,
) => {
  try {
    await PerOrderIdMutex.instance.runExclusive(orderId, async () => {
      const { user } = ctx;
      if (!orderId) return;
      const order = await Order.findOne({ _id: orderId });
      if (!order) return;
      const seller = await User.findOne({ _id: order.seller_id });
      if (seller === null) {
        throw new Error('seller is null');
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
      const refreshSellPromise = refreshScheduledOrder(order._id, bot);
      await messages.beginTakeSellMessage(ctx, bot, user, order);
      await refreshSellPromise;
    });
  } catch (error) {
    logger.error(error);
  }
};

// When a scheduled order is taken, reset its cycle counter and publish a
// fresh order from the mold so the trader's offer stays live on the channel.
const refreshScheduledOrder = async (
  orderId: string,
  bot: HasTelegram,
): Promise<void> => {
  try {
    const schedule = await ScheduledOrder.findOne({
      last_order_id: orderId,
      active: true,
    });
    if (!schedule) return;

    const creator = await User.findById(schedule.creator_id);
    if (!creator) return;

    const i18n = await getUserI18nContext(creator);

    const ordersActions = require('../../ordersActions');
    const {
      publishBuyOrderMessage,
      publishSellOrderMessage,
    } = require('../../messages');

    const newOrder = await ordersActions.createOrder(i18n, bot, creator, {
      type: schedule.type,
      amount: schedule.amount,
      fiatAmount: schedule.fiat_amount,
      fiatCode: schedule.fiat_code,
      paymentMethod: schedule.payment_method,
      status: 'PENDING',
      priceMargin: schedule.price_margin,
      community_id: schedule.community_id,
    });

    if (!newOrder) return;

    // Claim the refresh atomically BEFORE the external publish. Guarding on the
    // old last_order_id moves the mold->order link to newOrder in a single step,
    // so a concurrent take or a retry after a crash can't republish twice: once
    // the link points at newOrder, this branch no longer matches the old id.
    const claimed = await ScheduledOrder.findOneAndUpdate(
      { _id: schedule._id, last_order_id: orderId, active: true },
      { last_order_id: newOrder._id, republish_count: getRepublishCount() },
      { new: true },
    );
    if (!claimed) return; // already refreshed by a concurrent take

    const publishFn =
      schedule.type === 'buy'
        ? publishBuyOrderMessage
        : publishSellOrderMessage;
    await publishFn(bot, creator, newOrder, i18n, false);

    // publishFn swallows errors and returns void; surface a failed publish for
    // observability, but the refresh is already claimed either way.
    if (newOrder.status === 'CLOSED' || !newOrder.tg_channel_message1) {
      logger.warning(
        `refreshScheduledOrder: publish failed for schedule ${schedule._id} after claim`,
      );
    }
  } catch (error) {
    logger.error(`refreshScheduledOrder error: ${String(error)}`);
  }
};

const checkBlockingStatus = async (
  ctx: MainContext,
  user: UserDocument,
  otherUser: UserDocument,
) => {
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
