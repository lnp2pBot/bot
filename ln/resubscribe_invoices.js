const { getInvoices } = require('lightning');
const lnd = require('./connect');
const subscribeInvoice = require('./subscribe_invoice');
const { Order } = require('../models');


const resubscribeInvoices = async (bot) => {
  try {
    let invoicesReSubscribed = 0;
    const isHeld = (invoice) => !!invoice.is_held;
    const unconfirmedInvoices = (await getInvoices({ 
      lnd, is_unconfirmed: true 
    })).invoices;
    if (Array.isArray(unconfirmedInvoices) && unconfirmedInvoices.length > 0) {
        const heldInvoices = unconfirmedInvoices.filter(isHeld);
        for (const invoice of heldInvoices) {
            const orderInDB = Order.findById(invoice.id);
            if(!!orderInDB) {
                await subscribeInvoice(bot, invoice.id);
                invoicesReSubscribed++;
            } 
        };
    }
    console.log(`Invoices resubscribed: ${invoicesReSubscribed}`);
  } catch (error) {
    console.log(`resuscribeInvoice catch: ${error}`);
    return false;
  }
};

module.exports = resubscribeInvoices;