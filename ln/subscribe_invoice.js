const { subscribeToInvoice } = require('lightning');
const { Order, User, PendingPayment } = require('../models');
const payRequest = require('./pay_request');
const lnd = require('./connect');
const messages = require('../bot/messages');
const { handleReputationItems } = require('../util');

const subscribeInvoice = async (bot, id) => {
  const sub = subscribeToInvoice({ id, lnd });
  sub.on('invoice_updated', async (invoice) => {
    if (invoice.is_held) {
      console.log(`invoice with hash: ${id} is being held!`);
      const order = await Order.findOne({ hash: invoice.id });
      const buyerUser = await User.findOne({ _id: order.buyer_id });
      const sellerUser = await User.findOne({ _id: order.seller_id });
      order.status = 'ACTIVE';
      await order.save();
      if (order.type === 'sell') {
        await messages.onGoingTakeSellMessage(bot, sellerUser, buyerUser, order);
      } else if (order.type === 'buy') {
        await messages.onGoingTakeBuyMessage(bot, sellerUser, buyerUser, order);
      }
      order.invoice_held_at = Date.now();
      order.save();
    }
    if (invoice.is_confirmed) {
      try {
        console.log(`Invoice with hash: ${id} is being paid!`);
        const order = await Order.findOne({ hash: invoice.id });
        order.status = 'PAID_HOLD_INVOICE';
        await order.save();
        const payment = await payRequest({
          request: order.buyer_invoice,
          amount: order.amount,
        });
        if (payment.is_confirmed) {
          order.status = 'SUCCESS';
          await order.save();
          const buyerUser = await User.findOne({ _id: order.buyer_id });
          const sellerUser = await User.findOne({ _id: order.seller_id });
          await handleReputationItems(buyerUser, sellerUser, order.amount);
          if (order.type === 'sell') {
            await messages.doneTakeSellMessage(bot, sellerUser, buyerUser);
          } else if (order.type === 'buy') {
            await messages.doneTakeBuyMessage(bot, buyerUser, sellerUser);
          }
        } else {
          const buyerUser = await User.findOne({ _id: order.buyer_id });
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
    }
  });
};

module.exports = subscribeInvoice;
