import { Telegraf } from 'telegraf';
import { MainContext } from "../bot/start";
import { getInvoices, GetInvoicesResult } from 'lightning';
import { lnd } from './connect';
const subscribeInvoice = require('./subscribe_invoice');
import { Order } from '../models';
import { logger } from "../logger";

const resubscribeInvoices = async (bot: Telegraf<MainContext>) => {
  try {
    let invoicesReSubscribed = 0;
    const isHeld = (invoice: any) => !!invoice.is_held;
    const unconfirmedInvoices = (
      await getInvoices({
        lnd,
        is_unconfirmed: true,
      })
    ).invoices;
    if (Array.isArray(unconfirmedInvoices) && unconfirmedInvoices.length > 0) {
      const heldInvoices = unconfirmedInvoices.filter(isHeld);
      for (const invoice of heldInvoices) {
        const orderInDB = await Order.findOne({ hash: invoice.id });
        if (orderInDB) {
          logger.info(
            `Re-subscribing Order ${orderInDB._id} - Invoice with hash ${invoice.id} is being held!`
          );
          await subscribeInvoice(bot, invoice.id, true);
          invoicesReSubscribed++;
        }
      }
    }
    logger.info(`Invoices resubscribed: ${invoicesReSubscribed}`);
  } catch (error) {
    logger.error(`ResuscribeInvoice catch: ${String(error)}`);
    return false;
  }
};

export { resubscribeInvoices };
