import { HasTelegram } from '../bot/start';
import { User, Order } from '../models';
import { cancelShowHoldInvoice, cancelAddInvoice } from '../bot/commands';
import { cancelHoldInvoice } from '../ln';
import * as messages from '../bot/messages';
import {
  getUserI18nContext,
  holdInvoiceExpirationInSecs,
  PerOrderIdMutex,
} from '../util';
import { logger } from '../logger';
import { CommunityContext } from '../bot/modules/community/communityContext';
import * as OrderEvents from '../bot/modules/events/orders';

const cancelOrders = async (bot: HasTelegram) => {
  try {
    const holdInvoiceTime = new Date();
    holdInvoiceTime.setSeconds(
      holdInvoiceTime.getSeconds() -
        Number(process.env.HOLD_INVOICE_EXPIRATION_WINDOW),
    );
    // We get the orders where the seller didn't pay the hold invoice before expired
    // or where the buyer didn't add the invoice
    const waitingPaymentOrders = await Order.find({
      $or: [{ status: 'WAITING_PAYMENT' }, { status: 'WAITING_BUYER_INVOICE' }],
      $and: [
        {
          taken_at: { $lte: holdInvoiceTime },
          $or: [
            { invoice_held_at: { $eq: null } },
            { invoice_held_at: { $lte: holdInvoiceTime } },
          ],
        },
      ],
    });
    for (const order of waitingPaymentOrders) {
      if (order.status === 'WAITING_PAYMENT') {
        await PerOrderIdMutex.instance.runExclusive(
          String(order._id),
          async () => {
            const updatedOrder = await Order.findById(order._id);
            // In the case the orderId was modified then we don't cancel the order
            if (!updatedOrder || updatedOrder.status !== 'WAITING_PAYMENT')
              return;
            await cancelShowHoldInvoice(
              bot as CommunityContext,
              updatedOrder,
              true,
            );
          },
        );
      } else {
        await cancelAddInvoice(bot as CommunityContext, order, true);
      }
    }
    // We get the expired order where the seller sent the sats but never released the order
    // In this case we use another time field, `invoice_held_at` is the time when the
    // seller sent the money to the hold invoice, this is an important moment cause
    // we don't want to have a CLTV timeout
    let orderTime = new Date();
    const holdInvoiceExpiration = holdInvoiceExpirationInSecs();
    orderTime.setSeconds(
      orderTime.getSeconds() - holdInvoiceExpiration.expirationTimeInSecs,
    );
    const activeOrders = await Order.find({
      invoice_held_at: { $lte: orderTime },
      $or: [
        {
          status: 'FIAT_SENT',
        },
      ],
      admin_warned: false,
    });
    for (const order of activeOrders) {
      const buyerUser = await User.findOne({ _id: order.buyer_id });
      const sellerUser = await User.findOne({ _id: order.seller_id });
      if (buyerUser === null || sellerUser === null) return;
      const i18nCtxBuyer = await getUserI18nContext(buyerUser);
      const i18nCtxSeller = await getUserI18nContext(sellerUser);
      // Instead of cancel this order we should send this to the admins
      // and they decide what to do
      await messages.expiredOrderMessage(
        bot,
        order,
        buyerUser,
        sellerUser,
        i18nCtxBuyer,
      );
      // We send messages about the expired order to each party
      await messages.toBuyerExpiredOrderMessage(bot, buyerUser, i18nCtxBuyer);
      await messages.toSellerExpiredOrderMessage(
        bot,
        sellerUser,
        i18nCtxSeller,
      );
      order.admin_warned = true;
      await order.save();
    }
    // ==============================
    // Now we cancel orders expired
    // ==============================
    orderTime = new Date();
    let orderExpirationTime = Number(
      process.env.ORDER_PUBLISHED_EXPIRATION_WINDOW,
    );
    orderExpirationTime = orderExpirationTime + orderExpirationTime * 0.2;
    orderTime.setSeconds(orderTime.getSeconds() - orderExpirationTime);
    const expiredOrders = await Order.find({
      invoice_held_at: { $lte: orderTime },
      $or: [
        {
          status: 'ACTIVE',
        },
        {
          status: 'FIAT_SENT',
        },
      ],
    });
    for (const order of expiredOrders) {
      await PerOrderIdMutex.instance.runExclusive(
        String(order._id),
        async () => {
          const updatedOrder = await Order.findById(order._id);
          if (!updatedOrder) return;
          // Don't stomp an order that advanced after the find above (e.g. a
          // release/payout currently in flight under the same mutex).
          if (
            updatedOrder.status !== 'ACTIVE' &&
            updatedOrder.status !== 'FIAT_SENT'
          )
            return;

          // For ACTIVE orders the buyer never signalled fiat-sent, so it is
          // safe to cancel the hold invoice and refund the seller instead of
          // orphaning the hash. check_hold_invoice_expired ignores EXPIRED
          // orders, so without this the seller's funds would stay locked until
          // the on-chain CLTV timeout. FIAT_SENT orders are NOT auto-refunded
          // here (the buyer claims to have paid) and are left for the
          // dispute/admin flow.
          if (updatedOrder.status === 'ACTIVE' && updatedOrder.hash) {
            await cancelHoldInvoice({ hash: updatedOrder.hash });
          } else if (updatedOrder.status === 'FIAT_SENT' && updatedOrder.hash) {
            logger.warning(
              `Order Id ${updatedOrder.id} expired in FIAT_SENT with an open ` +
                `hold invoice; leaving it for dispute/admin handling`,
            );
          }

          updatedOrder.status = 'EXPIRED';
          await updatedOrder.save();
          OrderEvents.orderUpdated(updatedOrder);
          logger.info(`Order Id ${updatedOrder.id} expired!`);
        },
      );
    }
  } catch (error) {
    logger.error(error);
  }
};

export default cancelOrders;
