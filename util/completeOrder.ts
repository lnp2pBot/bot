import { Telegraf } from 'telegraf';
import { I18nContext } from '@grammyjs/i18n';
import { Order, User } from '../models';
import { IOrder } from '../models/order';
import { IPendingPayment } from '../models/pending_payment';
import { UserDocument } from '../models/user';
import * as messages from '../bot/messages';
import { LndPayment, PaymentStatus } from '../ln';
import { CommunityContext } from '../bot/modules/community/communityContext';
import { getUserI18nContext } from '../util';
import { logger } from '../logger';

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
  // If this coroutine come first and successfully updated the order status then continue the routine
  const won = await Order.findOneAndUpdate(
    { _id: order._id, status: { $ne: 'SUCCESS' } },
    { $set: { status: 'SUCCESS', routing_fee: payment.fee } },
  );
  if (won === null) return false;
  // Keep the in-memory document consistent for any later save by the caller.
  order.status = 'SUCCESS';
  order.routing_fee = payment.fee;

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

// Shared fail-closed healing routine for a payment that LND reports as
// confirmed: if the payment payload is present the order is closed as SUCCESS
// (idempotent CAS inside completeOrderAsSuccess); if LND returned no payload we
// do NOT mark SUCCESS — the order is flagged ERROR and the admin channel is
// notified for manual resolution. Every caller that finds a confirmed payment
// must go through here so no call site can reopen the double-pay window.
// Returns true if the order was healed as SUCCESS.
export const healConfirmedOrder = async (
  bot: Telegraf<CommunityContext>,
  order: IOrder,
  status: PaymentStatus,
  pending?: IPendingPayment,
): Promise<boolean> => {
  const buyerUser = await User.findOne({ _id: order.buyer_id });
  if (buyerUser === null) throw Error('buyerUser was not found in DB');
  const sellerUser = await User.findOne({ _id: order.seller_id });
  if (sellerUser === null) throw Error('sellerUser was not found in DB');
  const i18nCtx: I18nContext = await getUserI18nContext(buyerUser);
  if (status.payment) {
    await completeOrderAsSuccess(
      bot,
      order,
      status.payment,
      buyerUser,
      sellerUser,
      i18nCtx,
      pending,
    );
    return true;
  }
  // Fail closed: confirmed but no payment payload. Do not re-pay and do not
  // silently mark SUCCESS — leave the order for manual resolution.
  logger.error(
    `Order ${order._id}: payment confirmed but LND returned no details; ` +
      `not marking SUCCESS — needs manual resolution`,
  );
  order.status = 'ERROR';
  await order.save();
  await messages.toAdminChannelOrderErrorMessage(
    bot,
    order,
    'getPaymentStatus confirmed but no payment details in LND response',
  );
  return false;
};
