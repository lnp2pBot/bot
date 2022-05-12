const { subscribeToInvoice } = require('lightning');
const { Order, User } = require('../models');
const { payToBuyer } = require('./pay_request');
const lnd = require('./connect');
const messages = require('../bot/messages');
const ordersActions = require('../bot/ordersActions');
const { getUserI18nContext } = require('../util');
const logger = require('../logger');

const subscribeInvoice = async (bot, id, resub) => {
  try {
    const sub = subscribeToInvoice({ id, lnd });
    sub.on('invoice_updated', async (invoice) => {
      if (invoice.is_held && !resub) {
        logger.info(`invoice with hash: ${id} is being held!`);
        const order = await Order.findOne({ hash: invoice.id });
        const buyerUser = await User.findOne({ _id: order.buyer_id });
        const sellerUser = await User.findOne({ _id: order.seller_id });
        order.status = 'ACTIVE';
        // This is the i18n context we need to pass to the message
        i18nCtxBuyer = await getUserI18nContext(buyerUser);
        i18nCtxSeller = await getUserI18nContext(sellerUser);
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
        logger.info(`Invoice with hash: ${id} was settled!`);
        const order = await Order.findOne({ hash: id });
        order.status = 'PAID_HOLD_INVOICE';
        await order.save();
        const buyerUser = await User.findOne({ _id: order.buyer_id });
        const sellerUser = await User.findOne({ _id: order.seller_id });
        // We need two i18n contexts to send messages to each user
        i18nCtxBuyer = await getUserI18nContext(buyerUser);
        i18nCtxSeller = await getUserI18nContext(sellerUser);
        await messages.releasedSatsMessage(bot, sellerUser, buyerUser, i18nCtxBuyer, i18nCtxSeller);
        // If this is a range order, probably we need to created a new child range order
        const orderData = await ordersActions.getNewRangeOrderPayload(order);
        let i18nCtx;
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
            if (order.type === 'sell') {
              await messages.publishSellOrderMessage(bot, user, newOrder, i18nCtx);
            } else {
              await messages.publishBuyOrderMessage(bot, user, newOrder, i18nCtx);
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
    logger.error('subscribeInvoice catch: ', error);
    return false;
  }
};

module.exports = subscribeInvoice;
