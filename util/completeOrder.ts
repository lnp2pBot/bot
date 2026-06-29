import { Telegraf } from 'telegraf';
import { I18nContext } from '@grammyjs/i18n';
import { Order } from '../models';
import { IOrder } from '../models/order';
import { IPendingPayment } from '../models/pending_payment';
import { UserDocument } from '../models/user';
import * as messages from '../bot/messages';
import { LndPayment } from '../ln';
import { CommunityContext } from '../bot/modules/community/communityContext';

// Closes an order as SUCCESS and runs the success side effects (notify buyer,
// rating prompt, trades_completed). The status flip is an atomic compare-and-set
// (findOneAndUpdate with `status != SUCCESS`) instead of a plain `order.save()`
// on purpose: if two callers race (e.g. the pending-payments job and a
// concurrent /setinvoice), a read-modify-save would let both see PENDING and
// both run the side effects, double-notifying the buyer and double-counting
// trades. The conditional update guarantees only the first caller proceeds.
// Returns true if this caller won the race and ran the routine.
export const completeOrderAsSuccess = async (
  bot: Telegraf<CommunityContext>,
  order: IOrder,
  payment: LndPayment,
  buyerUser: UserDocument,
  sellerUser: UserDocument,
  i18nCtx: I18nContext,
  pending?: IPendingPayment,
): Promise<boolean> => {
  // Keep the in-memory document consistent for any later save by the caller.
  order.status = 'SUCCESS';
  order.routing_fee = payment.fee;

  // If this coroutine come first and successfully updated the order status then continue the routine
  const won = await Order.findOneAndUpdate(
    { _id: order._id, status: { $ne: 'SUCCESS' } },
    { $set: { status: 'SUCCESS', routing_fee: payment.fee } },
  );
  if (won === null) return false;

  if (pending) {
    pending.paid = true;
    pending.paid_at = new Date();
    await pending.save();
  }
  buyerUser.trades_completed++;
  await buyerUser.save();
  sellerUser.trades_completed++;
  await sellerUser.save();
  if (pending) {
    await messages.toAdminChannelPendingPaymentSuccessMessage(
      bot,
      buyerUser,
      order,
      pending,
      payment,
      i18nCtx,
    );
  }
  await messages.toBuyerPendingPaymentSuccessMessage(
    bot,
    buyerUser,
    order,
    payment,
    i18nCtx,
  );
  await messages.rateUserMessage(bot, buyerUser, order, i18nCtx);
  return true;
};
