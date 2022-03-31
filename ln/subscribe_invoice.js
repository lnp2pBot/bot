const { subscribeToInvoice } = require('lightning');
const { I18n } = require('@grammyjs/i18n');
const { Order, User } = require('../models');
const { payToBuyer } = require('./pay_request');
const lnd = require('./connect');
const messages = require('../bot/messages');
const ordersActions = require('../bot/ordersActions');

const subscribeInvoice = async (bot, id, resub) => {
  try {
    const sub = subscribeToInvoice({ id, lnd });
    sub.on('invoice_updated', async (invoice) => {
      // We need to create a i18n object to create a context
      const i18n = new I18n({
        defaultLanguageOnMissing: true,
        directory: 'locales',
      });
      let i18nCtx;
      if (invoice.is_held && !resub) {
        console.log(`invoice with hash: ${id} is being held!`);
        const order = await Order.findOne({ hash: invoice.id });
        const buyerUser = await User.findOne({ _id: order.buyer_id });
        const sellerUser = await User.findOne({ _id: order.seller_id });
        order.status = 'ACTIVE';
        // This is the i18n context we need to pass to the message
        i18nCtxBuyer = i18n.createContext(buyerUser.lang);
        i18nCtxSeller = i18n.createContext(sellerUser.lang);
        if (order.type === 'sell') {
          await messages.onGoingTakeSellMessage(bot, sellerUser, buyerUser, order, i18nCtxBuyer, i18nCtxSeller);
        } else if (order.type === 'buy') {
          order.status = 'WAITING_BUYER_INVOICE';
          await messages.onGoingTakeBuyMessage(bot, sellerUser, buyerUser, order, i18nCtxBuyer, i18nCtxSeller);
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
        // We need two i18n contexts to send messages to each user
        i18nCtxBuyer = i18n.createContext(buyerUser.lang);
        i18nCtxSeller = i18n.createContext(sellerUser.lang);
        await messages.releasedSatsMessage(bot, sellerUser, buyerUser, i18nCtxBuyer, i18nCtxSeller);
        // If this is a range order, probably we need to created a new child range order
        const orderData = await ordersActions.getNewRangeOrderPayload(order);
        if (!!orderData) {
          let user;
          if (order.type === 'sell') {
            user = sellerUser;
            i18nCtx = i18nCtxSeller;
          } else {
            user = buyerUser;
            i18nCtx = i18nCtxBuyer;
          }

          const newOrder = await ordersActions.createOrder(i18nCtx, bot, user, orderData);

          if (!!newOrder) {
            // This is the i18n context we need to pass to the message
            const i18nCtx = i18n.createContext(user.lang);
            if (order.type === 'sell') {
              await messages.publishSellOrderMessage(bot, newOrder, i18nCtx);
              await messages.pendingSellMessage(bot, user, newOrder, i18nCtx);
            } else {
              await messages.publishBuyOrderMessage(bot, newOrder, i18nCtx);
              await messages.pendingBuyMessage(bot, user, newOrder, i18nCtx);
            }
          }
        }
        // The seller get reputation after release
        await messages.rateUserMessage(bot, sellerUser, order, i18nCtxSeller);
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
