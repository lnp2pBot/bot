const { subscribeToInvoice } = require('lightning');
const { Order, User } = require('../models');
const { payToBuyer } = require('./pay_request');
const lnd = require('./connect');
const messages = require('../bot/messages');
const ordersActions = require('../bot/ordersActions');

const subscribeInvoice = async (bot, id, resub) => {
  try {
    const sub = subscribeToInvoice({ id, lnd });
    sub.on('invoice_updated', async (invoice) => {
      if (invoice.is_held && !resub) {
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
        // If this is a range order, probably we need to created a new child range order
        const newOrderPayload = await ordersActions.getNewRangeOrderPayload(order);
        if (!!newOrderPayload) {
          let user;
          if (order.type === 'sell') {
            user = sellerUser;
          } else {
            user = buyerUser;
          }
          const { orderCtx, orderData } = newOrderPayload;
          const newOrder = await ordersActions.createOrder(orderCtx, bot, user, orderData);

          if (!!newOrder) {
            if (order.type === 'sell') {
              await messages.publishSellOrderMessage(bot, newOrder);
              await messages.pendingSellMessage(ctx, bot, user, newOrder);
            } else {
              await messages.publishBuyOrderMessage(bot, newOrder);
              await messages.pendingBuyMessage(ctx, bot, user, newOrder);
            }
          }
        }
        // The seller get reputation after release
        await messages.rateUserMessage(bot, sellerUser, order);
        // We proceed to pay to buyer
        await payToBuyer(bot, order);
      }
    });
  } catch (error) {
    console.log('subscribeInvoice catch: ', error);
    return false;
  }
};

module.exports = subscribeInvoice;
