const { subscribeToInvoice } = require('lightning');
const { Order, User } = require('../models');
const { payToBuyer } = require('./pay_request');
const lnd = require('./connect');
const messages = require('../bot/messages');

const subscribeInvoice = async (bot, id) => {
  const sub = subscribeToInvoice({ id, lnd });
  sub.on('invoice_updated', async (invoice) => {
    if (invoice.is_held) {
      console.log(`invoice with hash: ${id} is being held!`);
      const order = await Order.findOne({ hash: invoice.id });
      const buyerUser = await User.findOne({ _id: order.buyer_id });
      const sellerUser = await User.findOne({ _id: order.seller_id });
      order.status = 'ACTIVE';
      if (order.type === 'sell') {
        await messages.onGoingTakeSellMessage(bot, sellerUser, buyerUser, order);
      } else if (order.type === 'buy') {
        order.status = 'WAITING_BUYER_INVOICE';
        await messages.onGoingTakeBuyMessage(bot, sellerUser, buyerUser, order);
      }
      order.invoice_held_at = Date.now();
      order.save();
    }
    if (invoice.is_confirmed) {
      console.log(`Invoice with hash: ${id} was settled!`);
      const order = await Order.findOne({ hash: id });
      order.status = 'PAID_HOLD_INVOICE';
      await order.save();
      const buyerUser = await User.findOne({ _id: order.buyer_id });
      const sellerUser = await User.findOne({ _id: order.seller_id });
      await messages.releasedSatsMessage(bot, sellerUser, buyerUser);
      await payToBuyer(bot, order);
    }
  });
};

module.exports = subscribeInvoice;
