const {
    validateSeller,
    validateObjectId,
    validateTakeBuyOrder,
    validateTakeSellOrder,
    validateUserWaitingOrder,
  } = require('./validations');
  const {
    createHoldInvoice,
    subscribeInvoice,
  } = require('../ln');
const { Order, User } = require('../models');
const messages = require('./messages');
const { getBtcFiatPrice } = require('../util');

const takebuy = async (ctx, bot) => {
  try {
    const orderId = ctx.update.callback_query.message.text;
    if (!orderId) return;
    const tgUser = ctx.update.callback_query.from;
    if (!tgUser) return;
    const user = await User.findOne({ tg_id: tgUser.id });

    if (!user) {
      await messages.initBotErrorMessage(bot, tgUser.id);
      return;
    }
    if (!(await validateUserWaitingOrder(bot, user))) return;

    // Sellers with orders in status = FIAT_SENT, have to solve the order
    const isOnFiatSentStatus = await validateSeller(bot, user);

    if (!isOnFiatSentStatus) return;

    if (!orderId) return;
    if (!(await validateObjectId(bot, user, orderId))) return;
    const order = await Order.findOne({ _id: orderId });
    if (!(await validateTakeBuyOrder(bot, user, order))) return;
    // We change the status to trigger the expiration of this order
    // if the user don't do anything
    order.status = 'WAITING_PAYMENT';
    order.seller_id = user._id;
    order.taken_at = Date.now();
    await order.save();
    // We delete the messages related to that order from the channel
    await bot.telegram.deleteMessage(process.env.CHANNEL, order.tg_channel_message1);
    await bot.telegram.deleteMessage(process.env.CHANNEL, order.tg_channel_message2);
    await messages.beginTakeBuyMessage(bot, user, order);
  } catch (error) {
    console.log(error);
    const tgUser = ctx.update.callback_query.from;
    if (!tgUser) return;
    let user = await User.findOne({ tg_id: tgUser.id });
    await messages.invalidDataMessage(bot, user);
  }
};

const takesell = async (ctx, bot) => {
  try {
    const orderId = ctx.update.callback_query.message.text;
    if (!orderId) return;
    const tgUser = ctx.update.callback_query.from;
    if (!tgUser) return;
    let user = await User.findOne({ tg_id: tgUser.id });

    if (!user) {
      await messages.initBotErrorMessage(bot, tgUser.id);
      return;
    }
    if (!(await validateUserWaitingOrder(bot, user))) return;

    const order = await Order.findOne({ _id: orderId });
    if (!(await validateTakeSellOrder(bot, user, order))) return;
    order.status = 'WAITING_BUYER_INVOICE';
    order.buyer_id = user._id;
    order.taken_at = Date.now();

    await order.save();
    // We delete the messages related to that order from the channel
    await bot.telegram.deleteMessage(process.env.CHANNEL, order.tg_channel_message1);
    await bot.telegram.deleteMessage(process.env.CHANNEL, order.tg_channel_message2);
    await messages.beginTakeSellMessage(bot, user, order);
  } catch (error) {
    console.log(error);
    const tgUser = ctx.update.callback_query.from;
    if (!tgUser) return;
    let user = await User.findOne({ tg_id: tgUser.id });
    await messages.invalidDataMessage(bot, user);
  }
};

const addInvoice = async (ctx, bot, order) => {
  try {
    ctx.deleteMessage();
    ctx.scene.leave();
    if (!order) {
      const orderId = ctx.update.callback_query.message.text;
      if (!orderId) return;
      order = await Order.findOne({ _id: orderId });
      if (!order) return;
    }
    const buyer = await User.findOne({ _id: order.buyer_id });
    // Buyers only can take orders with status WAITING_BUYER_INVOICE
    if (order.status != 'WAITING_BUYER_INVOICE') {
      await messages.invalidDataMessage(bot, buyer);
      return;
    }
    let amount = order.amount;
    if (amount == 0) {
        amount = await getBtcFiatPrice(order.fiat_code, order.fiat_amount);
        order.fee = amount * parseFloat(process.env.FEE);
        order.amount = amount;
    }
    // If the price API fails we can't continue with the process
    if (order.amount == 0) {
      await messages.priceApiFailedMessage(bot, user);
      return;
    }
    await order.save();
    const seller = await User.findOne({ _id: order.seller_id });
    ctx.scene.enter('ADD_INVOICE_WIZARD_SCENE_ID', { order, seller, buyer, bot });
  } catch (error) {
    console.log(error);
  }
};

const cancelAddInvoice = async (ctx, bot, order) => {
  try {
    if (!!ctx) {
      ctx.deleteMessage();
      ctx.scene.leave();
    }
    if (!order) {
      const orderId = !!ctx && ctx.update.callback_query.message.text;
      if (!orderId) return;
      order = await Order.findOne({ _id: orderId });
      if (!order) return;
    }
    const user = await User.findOne({ _id: order.buyer_id });
    // Buyers only can cancel orders with status WAITING_BUYER_INVOICE
    if (order.status != 'WAITING_BUYER_INVOICE') {
      await messages.invalidDataMessage(bot, user);
      return;
    }
    order.taken_at = null;
    order.status = 'PENDING';
    if (order.price_from_api)
      order.amount = 0;
    if (order.type == 'buy') {
      order.seller_id = null;
      await messages.publishBuyOrderMessage(bot, order);
    } else {
      order.buyer_id = null;
      await messages.publishSellOrderMessage(bot, order);
    }
    await order.save();
  } catch (error) {
    console.log(error);
  }
};

const showHoldInvoice = async (ctx, bot, order) => {
  try {
    ctx.deleteMessage();
    if (!order) {
      const orderId = ctx.update.callback_query.message.text;
      if (!orderId) return;
      order = await Order.findOne({ _id: orderId });
      if (!order) return;
    }
    const user = await User.findOne({ _id: order.seller_id });
    // Sellers only can take orders with status WAITING_PAYMENT
    if (order.status != 'WAITING_PAYMENT') {
      await messages.invalidDataMessage(bot, user);
      return;
    }
    // We create the hold invoice and show it to the seller
    const description = `Venta por @${ctx.botInfo.username} #${order._id}`;
    let amount;
    if (order.amount == 0) {
      amount = await getBtcFiatPrice(order.fiat_code, order.fiat_amount);
      order.fee = amount * parseFloat(process.env.FEE);
      order.amount = amount;
    }
    amount = Math.floor(order.amount + order.fee);
    const { request, hash, secret } = await createHoldInvoice({
      description,
      amount,
    });
    order.hash = hash;
    order.secret = secret;
    await order.save();

    // We monitor the invoice to know when the seller makes the payment
    await subscribeInvoice(bot, hash);
    await messages.showHoldInvoiceMessage(bot, user, request);
  } catch (error) {
    console.log(error);
  }
};

const cancelShowHoldInvoice = async (ctx, bot, order) => {
  try {
    if (!!ctx) ctx.deleteMessage();
    if (!order) {
      const orderId = !!ctx && ctx.update.callback_query.message.text;
      if (!orderId) return;
      order = await Order.findOne({ _id: orderId });
      if (!order) return;
    }
    const user = await User.findOne({ _id: order.seller_id });
    // Sellers only can cancel orders with status WAITING_PAYMENT
    if (order.status != 'WAITING_PAYMENT') {
      await messages.invalidDataMessage(bot, user);
      return;
    }
    order.taken_at = null;
    order.status = 'PENDING';
    if (order.price_from_api)
      order.amount = 0;
    if (order.type == 'buy') {
      order.seller_id = null;
      await messages.publishBuyOrderMessage(bot, order);
    } else {
      order.buyer_id = null;
      await messages.publishSellOrderMessage(bot, order);
    }
    await order.save();
  } catch (error) {
    console.log(error);
  }
};

module.exports = {
  takebuy,
  takesell,
  cancelAddInvoice,
  addInvoice,
  cancelShowHoldInvoice,
  showHoldInvoice,
};