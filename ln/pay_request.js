const { pay } = require('lightning');
const { parsePaymentRequest } = require('invoices');
const { Order, User, PendingPayment } = require('../models');
const lnd = require('./connect');
const { handleReputationItems } = require('../util');
const messages = require('../bot/messages');

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
  
  const payToBuyer = async (bot, order) => {
    try {
      const payment = await payRequest({
        request: order.buyer_invoice,
        amount: order.amount,
      });
      const buyerUser = await User.findOne({ _id: order.buyer_id });
      if (!!payment.is_confirmed) {
        order.status = 'SUCCESS';
        await order.save();
        const sellerUser = await User.findOne({ _id: order.seller_id });
        await handleReputationItems(buyerUser, sellerUser, order.amount);
        await messages.buyerReceivedSatsMessage(bot, buyerUser, sellerUser);
      } else {
        await messages.invoicePaymentFailedMessage(bot, buyerUser);
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
  