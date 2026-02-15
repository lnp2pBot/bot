import { HasTelegram } from '../bot/start';
import { Order, User } from '../models';
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

    // Orders in ACTIVE or FIAT_SENT whose hold invoice has exceeded the hold time
    const ordersWithHoldInvoice = await Order.find({
      $or: [{ status: 'ACTIVE' }, { status: 'FIAT_SENT' }],
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
            if (
              updatedOrder.status !== 'ACTIVE' &&
              updatedOrder.status !== 'FIAT_SENT'
            ) {
              return;
            }
            if (!updatedOrder.hash || !updatedOrder.invoice_held_at) return;

            // Cancel the hold invoice ourselves so our LND state is clean (idempotent if node already canceled via CLTV).
            try {
              await cancelHoldInvoice({ hash: updatedOrder.hash });
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
