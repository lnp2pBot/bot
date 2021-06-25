const { subscribeToInvoices } = require('lightning');
const lnd = require('./connect');

const subscribeInvoices = async () => {
  try {
    const sub = subscribeToInvoices({ lnd });
    sub.on('invoice_updated', async invoice => {
      if (!invoice.is_confirmed) return;

      // Una vez una invoice generada por el nodo haya sido pagada
      // guardamos en base de datos la invoice como pagada
      console.log('Invoice paid!');
    });
  } catch (e) {
    console.log(e);
    return e;
  }
};

module.exports = subscribeInvoices;
