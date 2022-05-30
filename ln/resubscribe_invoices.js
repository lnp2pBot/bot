const { getInvoices } = require('lightning');
const lnd = require('./connect');
const subscribeInvoice = require('./subscribe_invoice');
const { Order } = require('../models');
const logger = require('../logger');

const resubscribeInvoices = async bot => {
  try {
    let invoicesReSubscribed = 0;
    const isHeld = invoice => !!invoice.is_held;
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
            `Re-subscribing: invoice with hash ${invoice.id} is being held!`
          );
          await subscribeInvoice(bot, invoice.id, true);
          invoicesReSubscribed++;
        }
      }
    }
    logger.info(`Invoices resubscribed: ${invoicesReSubscribed}`);
  } catch (error) {
    logger.error(`ResuscribeInvoice catch: ${error}`);
    return false;
  }
};

module.exports = resubscribeInvoices;
