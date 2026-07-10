import { logger } from '../../../logger';
import { Block, Order, User } from '../../../models';
import { UserDocument } from '../../../models/user';
import {
  deleteOrderFromChannel,
  generateRandomImage,
  PerOrderIdMutex,
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

      // Atomically reserve a take slot (enforces the cap and increments the
      // counter in a single conditional update) right before persisting the
      // order, so concurrent takes cannot bypass the limit and validation
      // rejections above never consume a slot.
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

      // Atomically reserve a take slot (enforces the cap and increments the
      // counter in a single conditional update) right before persisting the
      // order, so concurrent takes cannot bypass the limit and validation
      // rejections above never consume a slot.
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

// Atomically reserve a take slot for the user. A single conditional document
// update does everything at once: it (1) rejects the take when the user is
// inside an active cooldown (the filter does not match), (2) resets the counter
// when a previous cooldown has already expired, (3) increments the counter, and
// (4) opens a fresh cooldown as soon as the cap is reached. Because check and
// increment are one atomic update on a single document, concurrent takes by the
// same user cannot each pass a stale read and push the counter past
// MAX_ORDERS_TAKE. Returns true when the take must be blocked.
const reserveTakeSlot = async (
  ctx: MainContext,
  user: UserDocument,
): Promise<boolean> => {
  const { maxOrdersTake, cooldownHours } = getTakeRateLimitConfig();
  const now = new Date();
  const cooldownUntil = new Date(
    now.getTime() + cooldownHours * 60 * 60 * 1000,
  );

  const updatedUser = await User.findOneAndUpdate(
    {
      _id: user._id,
      // Only proceed when there is no active cooldown ({ field: null } also
      // matches a missing field).
      $or: [
        { take_order_cooldown_until: null },
        { take_order_cooldown_until: { $lte: now } },
      ],
    },
    [
      {
        $set: {
          // Reset to 0 before incrementing when the matched cooldown had
          // expired, so a new window starts fresh.
          take_order_count: {
            $add: [
              {
                $cond: [
                  {
                    $and: [
                      { $ne: ['$take_order_cooldown_until', null] },
                      { $lte: ['$take_order_cooldown_until', now] },
                    ],
                  },
                  0,
                  { $ifNull: ['$take_order_count', 0] },
                ],
              },
              1,
            ],
          },
        },
      },
      {
        $set: {
          // Open a new cooldown once the (new) counter reaches the cap; clear it
          // otherwise (this also clears an expired cooldown we just reset).
          take_order_cooldown_until: {
            $cond: [
              { $gte: ['$take_order_count', maxOrdersTake] },
              cooldownUntil,
              null,
            ],
          },
        },
      },
    ],
    { new: true },
  );

  if (updatedUser === null) {
    // The user is inside an active cooldown (or was not found). Re-read to show
    // the accurate remaining time.
    const current = await User.findById(user._id);
    if (current && current.take_order_cooldown_until) {
      user.take_order_count = current.take_order_count;
      user.take_order_cooldown_until = current.take_order_cooldown_until;
      await messages.orderTakeRateLimitMessage(
        ctx,
        user,
        current.take_order_cooldown_until,
      );
    }
    return true;
  }

  // Keep the in-memory document consistent for any later use by the caller.
  user.take_order_count = updatedUser.take_order_count;
  user.take_order_cooldown_until = updatedUser.take_order_cooldown_until;
  return false;
};

// Release a slot reserved by reserveTakeSlot when the take could not be
// completed. Decrements the counter and, if that drops the user back below the
// cap, clears any cooldown the reservation had just opened.
const releaseTakeSlot = async (user: UserDocument): Promise<void> => {
  const { maxOrdersTake } = getTakeRateLimitConfig();
  const updatedUser = await User.findOneAndUpdate(
    { _id: user._id, take_order_count: { $gt: 0 } },
    [
      { $set: { take_order_count: { $add: ['$take_order_count', -1] } } },
      {
        $set: {
          take_order_cooldown_until: {
            $cond: [
              { $gte: ['$take_order_count', maxOrdersTake] },
              '$take_order_cooldown_until',
              null,
            ],
          },
        },
      },
    ],
    { new: true },
  );
  if (updatedUser !== null) {
    user.take_order_count = updatedUser.take_order_count;
    user.take_order_cooldown_until = updatedUser.take_order_cooldown_until;
  }
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
