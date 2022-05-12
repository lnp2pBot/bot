const { subscribeToInvoices } = require('lightning');
const lnd = require('./connect');
const logger = require('../logger');

const subscribeInvoices = async () => {
  try {
    const sub = subscribeToInvoices({ lnd });
    sub.on('invoice_updated', async invoice => {
      if (!invoice.is_confirmed) return;

      // Una vez una invoice generada por el nodo haya sido pagada
      // guardamos en base de datos la invoice como pagada
      logger.info('Invoice paid!');
    });
  } catch (error) {
    logger.error(error);
  }
};

module.exports = subscribeInvoices;
