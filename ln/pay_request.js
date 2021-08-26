const { pay } = require('lightning');
const { parsePaymentRequest } = require('invoices');
const lnd = require('./connect');

const payRequest = async ({ request, amount }) => {
    try {
      const invoice = parsePaymentRequest({ request });
      const params = {
        lnd,
        request,
      };
      if (!invoice.tokens) params.tokens = amount;
      const payment = await pay(params);

      return payment;
    } catch (e) {
      console.log(e);
      return false;
    }
  };
  
  module.exports = payRequest;
  