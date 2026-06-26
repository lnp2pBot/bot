import { Telegraf } from 'telegraf';
import { HydratedDocument } from 'mongoose';

import { Order, User } from '../models';
import { deleteOrderFromChannel, getUserI18nContext } from '../util';
import * as messages from '../bot/messages';
import { logger } from '../logger';
import { CommunityContext } from '../bot/modules/community/communityContext';
import { IOrder } from '../models/order';

const deleteOrders = async (bot: Telegraf<CommunityContext>) => {
  try {
    const windowTime = new Date();
    windowTime.setSeconds(
      windowTime.getSeconds() -
        Number(process.env.ORDER_PUBLISHED_EXPIRATION_WINDOW),
    );
    // We get the pending orders where time is expired
    const pendingOrders = await Order.find({
      status: 'PENDING',
      created_at: { $lte: windowTime },
    });
    for (const order of pendingOrders) {
      // /scheduleorder: while there are republish cycles left, republish the
      // order instead of deleting it. We reset created_at (not expires_at, which
      // does not exist in this schema) so the expiration window restarts.
      if (order.republish_count > 0) {
        const republished = await republishOrder(bot, order);
        if (republished) continue;
        // If we could not republish (e.g. creator missing), fall through to the
        // normal deletion flow below.
      }
      logger.info(
        `Pending order Id: ${order._id} expired after ${process.env.ORDER_PUBLISHED_EXPIRATION_WINDOW} seconds, deleting it from database and channel`,
      );
      const orderCloned = order.toObject() as IOrder;
      // We remove the order from the database first, then we remove the message from the channel
      await order.deleteOne();
      // We delete the messages related to that order from the channel
      await deleteOrderFromChannel(orderCloned, bot.telegram);
    }
  } catch (error) {
    const message = String(error);
    logger.error(`deleteOrders catch error: ${message}`);
  }
};

// Republishes a scheduled order: removes the expired channel post, consumes one
// republish cycle, restarts the expiration window and posts a fresh message.
// Returns true if the order was republished, false if it should be deleted.
const republishOrder = async (
  bot: Telegraf<CommunityContext>,
  order: HydratedDocument<IOrder>,
): Promise<boolean> => {
  try {
    const creator = await User.findOne({ _id: order.creator_id });
    if (creator === null) {
      logger.warning(
        `Order ${order._id} has republish_count but its creator was not found; deleting it`,
      );
      return false;
    }

    // Snapshot the current channel post so we can remove it only AFTER a fresh
    // one is published — if publishing fails the existing post stays up instead
    // of hiding the order off-channel.
    const previousPost = order.toObject() as IOrder;

    // Consume one cycle and restart the expiration window. We persist this
    // first so a failure while publishing cannot leave the order republishing
    // forever without ever decrementing the counter.
    order.republish_count -= 1;
    order.created_at = new Date();
    await order.save();

    const i18nCtx = await getUserI18nContext(creator);
    if (order.type === 'buy') {
      await messages.publishBuyOrderMessage(bot, creator, order, i18nCtx);
    } else {
      await messages.publishSellOrderMessage(bot, creator, order, i18nCtx);
    }

    // The fresh post is up (publishX saved its new message id on the order), so
    // remove the previous expired post now.
    await deleteOrderFromChannel(previousPost, bot.telegram);
    logger.info(
      `Republished scheduled order ${order._id}; ${order.republish_count} republish(es) left`,
    );
    return true;
  } catch (error) {
    logger.error(`republishOrder catch error: ${String(error)}`);
    // Skip this order on error; it stays PENDING and will be retried next run.
    return true;
  }
};

export default deleteOrders;
