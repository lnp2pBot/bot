const { payViaPaymentRequest } = require('lightning');
const { parsePaymentRequest } = require('invoices');
const { User, PendingPayment } = require('../models');
const lnd = require('./connect');
const { handleReputationItems } = require('../util');
const messages = require('../bot/messages');

const payRequest = async ({ request, amount }) => {
  try {
    const invoice = parsePaymentRequest({ request });
    if (!invoice) {
      return false;
    }
    const params = {
      lnd,
      request,
    };
    if (!invoice.tokens) params.tokens = amount;
    const payment = await payViaPaymentRequest(params);

    return payment;
  } catch (e) {
    console.log(e);
    return false;
  }
};
  
const payToBuyer = async (bot, order) => {
  try {
    const payment = await payRequest({
      request: order.buyer_invoice,
      amount: order.amount,
    });
    console.log('payToBuyer response: ', payment);
    const buyerUser = await User.findOne({ _id: order.buyer_id });
    const sellerUser = await User.findOne({ _id: order.seller_id });
    if (!!payment && !!payment.confirmed_at) {
      order.status = 'SUCCESS';
      await order.save();
      await handleReputationItems(buyerUser, sellerUser, order.amount);
      await messages.buyerReceivedSatsMessage(bot, buyerUser, sellerUser);
    } else {
      await messages.invoicePaymentFailedMessage(bot, buyerUser, sellerUser);
      const pp = new PendingPayment({
        amount: order.amount,
        payment_request: order.buyer_invoice,
        user_id: buyerUser._id,
        description: order.description,
        hash: order.hash,
        order_id: order._id,
      });
      await pp.save();
    }
  } catch (error) {
    console.log(error);
  }
};

  module.exports = {
    payRequest,
    payToBuyer,
  };
  