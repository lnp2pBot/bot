const { payRequest, isPendingPayment } = require('../ln');
const { PendingPayment, Order, User } = require('../models');
const messages = require('../bot/messages');
const { getUserI18nContext } = require('../util');
const logger = require('../logger');

const attemptPendingPayments = async bot => {
  const pendingPayments = await PendingPayment.find({
    paid: false,
    attempts: { $lt: process.env.PAYMENT_ATTEMPTS },
    is_invoice_expired: false,
  });

  for (const pending of pendingPayments) {
    const order = await Order.findOne({ _id: pending.order_id });
    try {
      pending.attempts++;
      if (order.status === 'SUCCESS') {
        pending.paid = true;
        await pending.save();
        logger.info(`Order id: ${order._id} was already paid`);
        return;
      }
      // We check if the old payment is on flight
      const isPendingOldPayment = await isPendingPayment(order.buyer_invoice);

      // We check if this new payment is on flight
      const isPending = await isPendingPayment(pending.payment_request);

      // If one of the payments is on flight we don't do anything
      if (isPending || isPendingOldPayment) return;

      const payment = await payRequest({
        amount: pending.amount,
        request: pending.payment_request,
      });
      const buyerUser = await User.findOne({ _id: order.buyer_id });
      const i18nCtx = await getUserI18nContext(buyerUser);
      // If the buyer's invoice is expired we let it know and don't try to pay again
      if (!!payment && payment.is_expired) {
        pending.is_invoice_expired = true;
        order.paid_hold_buyer_invoice_updated = false;
        await messages.expiredInvoiceOnPendingMessage(
          bot,
          buyerUser,
          order,
          i18nCtx
        );
        return;
      }

      if (!!payment && !!payment.confirmed_at) {
        order.status = 'SUCCESS';
        order.routing_fee = payment.fee;
        pending.paid = true;
        // We add a new completed trade for the buyer
        buyerUser.trades_completed++;
        await buyerUser.save();
        // We add a new completed trade for the seller
        const sellerUser = await User.findOne({ _id: order.seller_id });
        sellerUser.trades_completed++;
        sellerUser.save();
        logger.info(`Invoice with hash: ${pending.hash} paid`);
        await messages.toAdminChannelPendingPaymentSuccessMessage(
          bot,
          buyerUser,
          order,
          pending,
          payment,
          i18nCtx
        );
        await messages.toBuyerPendingPaymentSuccessMessage(
          bot,
          buyerUser,
          order,
          payment,
          i18nCtx
        );
        await messages.rateUserMessage(bot, buyerUser, order, i18nCtx);
      } else {
        if (pending.attempts === parseInt(process.env.PAYMENT_ATTEMPTS)) {
          order.paid_hold_buyer_invoice_updated = false;
          await messages.toBuyerPendingPaymentFailedMessage(
            bot,
            buyerUser,
            order,
            i18nCtx
          );
        }
        await messages.toAdminChannelPendingPaymentFailedMessage(
          bot,
          buyerUser,
          order,
          pending,
          i18nCtx
        );
      }
    } catch (error) {
      const message = error.toString();
      logger.error(`attemptPendingPayments catch error: ${message}`);
    } finally {
      await order.save();
      await pending.save();
    }
  }
};

module.exports = attemptPendingPayments;
