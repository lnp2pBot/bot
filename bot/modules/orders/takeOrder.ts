import { logger } from '../../../logger';
import { Block, Order, User, ScheduledOrder } from '../../../models';
import { UserDocument } from '../../../models/user';
import {
  deleteOrderFromChannel,
  generateRandomImage,
  getUserI18nContext,
  PerOrderIdMutex,
  PerUserIdMutex,
  getUserAge,
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

      if (!(await meetsCounterpartyRequirements(ctx, user, userOffer))) return;

      const { randomImage } = generateRandomImage(user._id.toString());

      order.status = 'WAITING_PAYMENT';
      order.seller_id = user._id;
      order.taken_at = new Date(Date.now());

      order.random_image = randomImage;

      // Reserve a take slot (enforces the cap and increments the counter under a
      // per-user mutex) right before persisting the order, so concurrent takes
      // cannot bypass the limit and validation rejections above never consume a
      // slot.
      if (await reserveTakeSlot(ctx, user)) return;

      try {
        await order.save();
      } catch (error) {
        // The take did not complete; release the reserved slot so a failed save
        // does not penalize the user for a take that never happened.
        await releaseTakeSlot(user);
        throw error;
      }

      order.status = 'in-progress';
      OrderEvents.orderUpdated(order);

      await deleteOrderFromChannel(order, bot.telegram);
      await refreshScheduledOrder(order._id, bot);

      await messages.beginTakeBuyMessage(ctx, bot, user, order);
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

      if (!(await meetsCounterpartyRequirements(ctx, user, seller))) return;

      order.status = 'WAITING_BUYER_INVOICE';
      order.buyer_id = user._id;
      order.taken_at = new Date(Date.now());

      // Reserve a take slot (enforces the cap and increments the counter under a
      // per-user mutex) right before persisting the order, so concurrent takes
      // cannot bypass the limit and validation rejections above never consume a
      // slot.
      if (await reserveTakeSlot(ctx, user)) return;

      try {
        await order.save();
      } catch (error) {
        // The take did not complete; release the reserved slot so a failed save
        // does not penalize the user for a take that never happened.
        await releaseTakeSlot(user);
        throw error;
      }

      order.status = 'in-progress';
      OrderEvents.orderUpdated(order);
      // We delete the messages related to that order from the channel
      await deleteOrderFromChannel(order, bot.telegram);
      await refreshScheduledOrder(order._id, bot);
      await messages.beginTakeSellMessage(ctx, bot, user, order);
    });
  } catch (error) {
    logger.error(error);
  }
};

const getTakeRateLimitConfig = (): {
  maxOrdersTake: number;
  cooldownHours: number;
} => {
  const maxOrdersTakeRaw = Number(process.env.MAX_ORDERS_TAKE ?? 10);
  const cooldownHoursRaw = Number(process.env.ORDER_TAKE_COOLDOWN_HOURS ?? 24);
  const maxOrdersTake =
    Number.isInteger(maxOrdersTakeRaw) && maxOrdersTakeRaw > 0
      ? maxOrdersTakeRaw
      : 10;
  const cooldownHours =
    Number.isFinite(cooldownHoursRaw) && cooldownHoursRaw > 0
      ? cooldownHoursRaw
      : 24;
  return { maxOrdersTake, cooldownHours };
};

// Reserve a take slot for the user. Enforces the cap and increments the
// counter. Everything runs inside a per-user lock, so concurrent takes by the
// same user are serialized and cannot push the counter past MAX_ORDERS_TAKE.
// Returns true when the take must be blocked.
export const reserveTakeSlot = async (
  ctx: MainContext,
  user: UserDocument,
): Promise<boolean> => {
  const { maxOrdersTake, cooldownHours } = getTakeRateLimitConfig();

  return PerUserIdMutex.instance.runExclusive(
    user._id.toString(),
    async (): Promise<boolean> => {
      const now = new Date();
      const dbUser = await User.findById(user._id);
      // The user should always exist (middleware creates it), but if it somehow
      // does not we block the take rather than let it bypass the limit, and give
      // the user feedback instead of failing silently.
      if (dbUser === null) {
        await messages.genericErrorMessage(ctx, user, ctx.i18n);
        return true;
      }

      // Still inside an active cooldown: block and show the remaining time.
      if (
        dbUser.take_order_cooldown_until &&
        dbUser.take_order_cooldown_until > now
      ) {
        user.take_order_count = dbUser.take_order_count;
        user.take_order_cooldown_until = dbUser.take_order_cooldown_until;
        await messages.orderTakeRateLimitMessage(
          ctx,
          user,
          dbUser.take_order_cooldown_until,
        );
        return true;
      }

      // A previous cooldown has expired: start a fresh window.
      if (dbUser.take_order_cooldown_until) {
        dbUser.take_order_count = 0;
        dbUser.take_order_cooldown_until = null;
      }

      // Consume a slot and open a new cooldown once the cap is reached.
      dbUser.take_order_count += 1;
      dbUser.take_order_cooldown_until =
        dbUser.take_order_count >= maxOrdersTake
          ? new Date(now.getTime() + cooldownHours * 60 * 60 * 1000)
          : null;

      await dbUser.save();

      // Keep the in-memory document consistent for any later use by the caller.
      user.take_order_count = dbUser.take_order_count;
      user.take_order_cooldown_until = dbUser.take_order_cooldown_until;
      return false;
    },
  );
};

// Release a slot reserved by reserveTakeSlot when the take could not be
// completed. Decrements the counter and, if that drops the user back below the
// cap, clears any cooldown the reservation had just opened.
export const releaseTakeSlot = async (user: UserDocument): Promise<void> => {
  const { maxOrdersTake } = getTakeRateLimitConfig();

  await PerUserIdMutex.instance.runExclusive(
    user._id.toString(),
    async (): Promise<void> => {
      const dbUser = await User.findById(user._id);
      if (dbUser === null || dbUser.take_order_count <= 0) return;

      dbUser.take_order_count -= 1;
      // Dropping back below the cap clears the cooldown. In the rare case where
      // several concurrent takes opened a cooldown and only one save() failed,
      // this lets the user take again slightly early; the impact is minimal and
      // it keeps count/cooldown consistent (a sub-cap user should never be in a
      // cooldown).
      if (dbUser.take_order_count < maxOrdersTake) {
        dbUser.take_order_cooldown_until = null;
      }

      await dbUser.save();

      user.take_order_count = dbUser.take_order_count;
      user.take_order_cooldown_until = dbUser.take_order_cooldown_until;
    },
  );
};

export const meetsCounterpartyRequirements = async (
  ctx: MainContext,
  user: UserDocument,
  orderCreator: UserDocument,
) => {
  if (!orderCreator.counterparty_requirements) return true;

  const { min_days_using_bot, min_completed_orders } =
    orderCreator.counterparty_requirements;

  const failures = {
    age: false,
    orders: false,
  };

  if (min_days_using_bot > 0) {
    const ageInDays = getUserAge(user);
    if (!Number.isNaN(ageInDays) && ageInDays < min_days_using_bot) {
      failures.age = true;
    }
  }

  if (min_completed_orders > 0) {
    if (user.trades_completed < min_completed_orders) {
      failures.orders = true;
    }
  }

  if (failures.age || failures.orders) {
    await messages.notMeetingRequirementsMessage(ctx, user, {
      failures,
      min_days_using_bot,
      min_completed_orders,
      user_age: getUserAge(user),
      user_trades: user.trades_completed,
    });
    return false;
  }

  return true;
};

// When a scheduled order is taken, reset its cycle counter and publish a
// fresh order from the mold so the trader's offer stays live on the channel.
const refreshScheduledOrder = async (
  orderId: string,
  bot: HasTelegram,
): Promise<void> => {
  try {
    const REPUBLISH_DAYS_DEFAULT = 10;
    const raw = parseInt(process.env.REPUBLISH_ORDER_DAYS || '');
    const republishCount =
      Number.isInteger(raw) && raw > 0 ? raw : REPUBLISH_DAYS_DEFAULT;

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

    const publishFn =
      schedule.type === 'buy'
        ? publishBuyOrderMessage
        : publishSellOrderMessage;
    await publishFn(bot, creator, newOrder, i18n, false);

    schedule.last_order_id = newOrder._id;
    schedule.republish_count = republishCount;
    await schedule.save();
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
