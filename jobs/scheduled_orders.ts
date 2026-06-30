import { Telegraf } from 'telegraf';

import { ScheduledOrder, User } from '../models';
import { getUserI18nContext } from '../util';
import { logger } from '../logger';
import { CommunityContext } from '../bot/modules/community/communityContext';
import * as ordersActions from '../bot/ordersActions';
import {
  publishBuyOrderMessage,
  publishSellOrderMessage,
} from '../bot/messages';

// Runs every hour. For each active ScheduledOrder whose days/hour (UTC) match
// now, publishes a brand-new Order from the stored mold. The mold is never
// mutated into an order; each publication has its own id and lifecycle.
const publishScheduledOrders = async (bot: Telegraf<CommunityContext>) => {
  try {
    const now = new Date();
    const currentDay = now.getUTCDay(); // 0 (Sunday) .. 6 (Saturday)
    const currentHour = now.getUTCHours(); // 0 .. 23

    const schedules = await ScheduledOrder.find({
      active: true,
      days: currentDay,
      hour: currentHour,
    });

    for (const schedule of schedules) {
      try {
        if (schedule.republish_count <= 0) {
          schedule.active = false;
          await schedule.save();
          continue;
        }

        const user = await User.findById(schedule.creator_id);
        if (!user) {
          logger.warning(
            `ScheduledOrder ${schedule._id}: creator ${schedule.creator_id} not found, deactivating`,
          );
          schedule.active = false;
          await schedule.save();
          continue;
        }

        const i18n = await getUserI18nContext(user);

        const order = await ordersActions.createOrder(i18n, bot, user, {
          type: schedule.type,
          amount: schedule.amount,
          fiatAmount: schedule.fiat_amount,
          fiatCode: schedule.fiat_code,
          paymentMethod: schedule.payment_method,
          status: 'PENDING',
          priceMargin: schedule.price_margin,
          community_id: schedule.community_id,
        });

        if (!order) {
          logger.warning(
            `ScheduledOrder ${schedule._id}: failed to create order`,
          );
          continue;
        }

        const publishFn =
          schedule.type === 'buy'
            ? publishBuyOrderMessage
            : publishSellOrderMessage;
        await publishFn(bot, user, order, i18n, false);

        // publishFn swallows errors and returns void, so we detect success from
        // the side effects it leaves on the order: a populated channel message
        // id, and a status that was not closed because the channel was
        // unreachable. Only advance the schedule on a confirmed publish.
        if (order.status === 'CLOSED' || !order.tg_channel_message1) {
          logger.warning(
            `ScheduledOrder ${schedule._id}: publish failed, schedule not advanced`,
          );
          continue;
        }

        schedule.last_order_id = order._id;
        schedule.republish_count -= 1;
        if (schedule.republish_count <= 0) schedule.active = false;
        await schedule.save();

        logger.info(
          `ScheduledOrder ${schedule._id} published order ${order._id}, ${schedule.republish_count} cycles left`,
        );
      } catch (error) {
        logger.error(`publishScheduledOrders inner error: ${String(error)}`);
      }
    }
  } catch (error) {
    logger.error(`publishScheduledOrders error: ${String(error)}`);
  }
};

export default publishScheduledOrders;
