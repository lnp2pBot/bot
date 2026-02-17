import { HasTelegram } from '../bot/start';
import { Order, User, Dispute } from '../models';
import { holdInvoiceExpirationInSecs, getUserI18nContext } from '../util';
import { logger } from '../logger';
import { cancelHoldInvoice } from '../ln';
import { PerOrderIdMutex } from '../ln/subscribe_invoice';
import * as OrderEvents from '../bot/modules/events/orders';
import * as messages from '../bot/messages';

const checkHoldInvoiceExpired = async (bot: HasTelegram) => {
  try {
    const holdInvoiceExpiration = holdInvoiceExpirationInSecs();
    const expirationTimeInMs =
      holdInvoiceExpiration.expirationTimeInSecs * 1000;
    const now = new Date();
    const holdExpiredBefore = new Date(now.getTime() - expirationTimeInMs);

    // Orders in ACTIVE, DISPUTE or FIAT_SENT whose hold invoice has exceeded the hold time
    const orderStatuses = ['ACTIVE', 'DISPUTE', 'FIAT_SENT'];
    const ordersWithHoldInvoice = await Order.find({
      $or: orderStatuses.map(status => ({ status })),
      hash: { $ne: null },
      invoice_held_at: { $ne: null, $lte: holdExpiredBefore },
    });

    for (const order of ordersWithHoldInvoice) {
      try {
        if (!order.hash || !order.invoice_held_at) continue;

        await PerOrderIdMutex.instance.runExclusive(
          String(order._id),
          async () => {
            const updatedOrder = await Order.findById(order._id);
            if (!updatedOrder) return;
            if (!orderStatuses.includes(updatedOrder.status)) {
              return;
            }
            if (!updatedOrder.hash || !updatedOrder.invoice_held_at) return;

            // Cancel the hold invoice ourselves so our LND state is clean (idempotent if node already canceled via CLTV).
            try {
              await cancelHoldInvoice({ hash: updatedOrder.hash });

              const isDispute = updatedOrder.status === 'DISPUTE';
              if (isDispute) {
                const dispute = await Dispute.findOne({
                  order_id: String(updatedOrder._id),
                });
                if (dispute) {
                  dispute.status = 'SELLER_REFUNDED';
                  await dispute.save();
                }
              }
            } catch (err) {
              logger.error(
                `checkHoldInvoiceExpired: cancelHoldInvoice for order ${updatedOrder._id}: ${err}`,
              );
            }

            updatedOrder.status = 'HOLD_INVOICE_EXPIRED';
            await updatedOrder.save();

            const buyerUser = await User.findOne({
              _id: updatedOrder.buyer_id,
            });
            const sellerUser = await User.findOne({
              _id: updatedOrder.seller_id,
            });
            if (buyerUser !== null && sellerUser !== null) {
              const i18nCtxBuyer = await getUserI18nContext(buyerUser);
              const i18nCtxSeller = await getUserI18nContext(sellerUser);
              await messages.toBuyerHoldInvoiceExpiredMessage(
                bot,
                buyerUser,
                updatedOrder,
                i18nCtxBuyer,
              );
              await messages.toSellerHoldInvoiceExpiredMessage(
                bot,
                sellerUser,
                updatedOrder,
                i18nCtxSeller,
              );
            }

            OrderEvents.orderUpdated(updatedOrder);
            logger.info(`Order ${updatedOrder._id} hold invoice expired`);
          },
        );
      } catch (error) {
        logger.error(`Error in checkHoldInvoiceExpired: ${error}`);
      }
    }
  } catch (error) {
    logger.error(`Error in checkHoldInvoiceExpired: ${error}`);
  }
};

export default checkHoldInvoiceExpired;
