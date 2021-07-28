const { Telegraf } = require('telegraf');
const { Order, User } = require('../models');
const { createOrder, getOrder } = require('./ordersActions');
const {
  settleHoldInvoice,
  createHoldInvoice,
  cancelHoldInvoice,
  subscribeInvoice,
} = require('../ln');
const {
  validateSellOrder,
  validateUser,
  validateBuyOrder,
  validateTakeSell,
  validateTakeBuyOrder,
  validateReleaseOrder,
  validateTakeBuy,
  validateTakeSellOrder,
  validateRelease,
  validateDispute,
  validateDisputeOrder,
  validateCancel,
} = require('./validations');
const messages = require('./messages');

const start = () => {
  const bot = new Telegraf(process.env.BOT_TOKEN);

  bot.start(async (ctx) => {
    try {
      messages.startMessage(ctx);
      await validateUser(ctx, true);
    } catch (error) {
      console.log(error);
    }
  });

  bot.command('sell', async (ctx) => {
    try {
      const user = await validateUser(ctx, false);
      if (!user) return;

      const sellOrderParams = await validateSellOrder(ctx, bot, user);
      if (!sellOrderParams) return;

      const {amount, fiatAmount, fiatCode, paymentMethod} = sellOrderParams;
console.log(sellOrderParams)
      const { request, order } = await createOrder(ctx, bot, {
        type: 'sell',
        amount,
        seller: user,
        fiatAmount,
        fiatCode,
        paymentMethod,
        status: 'WAITING_PAYMENT',
      });

      if (!!order) await messages.invoicePaymentRequestMessage(bot, user, request);
    } catch (error) {
      console.log(error);
    }
  });

  bot.command('buy', async (ctx) => {
    try {
      const user = await validateUser(ctx, false);
      if (!user) return;

      const buyOrderParams = await validateBuyOrder(ctx, bot, user);

      if (!buyOrderParams) {
        await messages.invalidDataMessage(bot, user);

        return;
      };

      const {amount, fiatAmount, fiatCode, paymentMethod, lnInvoice} = buyOrderParams;

      const { order } = await createOrder(ctx, bot, {
        type: 'buy',
        amount,
        buyer: user,
        fiatAmount,
        fiatCode,
        paymentMethod,
        buyerInvoice: lnInvoice || '',
        status: 'PENDING',
      });

      if (!!order) {
        await messages.publishBuyOrderMessage(ctx, bot, order);
        await messages.pendingBuyMessage(bot, user);
      }
    } catch (error) {
      console.log(error);
    }
  });

  bot.command('takesell', async (ctx) => {
    try {
      const user = await validateUser(ctx, false);
      if (!user) return;

      const takeSellParams = await validateTakeSell(ctx, bot, user);
      if (!takeSellParams) return;

      const {orderId, lnInvoice} = takeSellParams;

      try {
        const order = await Order.findOne({ _id: orderId });
        if (!(await validateTakeSellOrder(bot, user, lnInvoice, order))) return;

        order.status = 'ACTIVE';
        order.buyer_id = user._id;
        order.buyer_invoice = lnInvoice;
        await order.save();

        const orderUser = await User.findOne({ _id: order.creator_id });
        await messages.beginTakeSellMessage(bot, orderUser, user, order);
      } catch (e) {
        console.log(e);
        await messages.invalidDataMessage(bot, user);
      }
    } catch (error) {
      console.log(error);
    }
  });

  bot.command('takebuy', async (ctx) => {
    try {
      const user = await validateUser(ctx, false);

      if (!user) return;

      const orderId = await validateTakeBuy(ctx, bot, user);

      if (!orderId) return;

      const order = await Order.findOne({ _id: orderId });
      if (!(await validateTakeBuyOrder(bot, user, order))) return;

      const invoiceDescription = `Venta por @P2PLNBot`;
      let amount = order.amount + order.amount * parseFloat(process.env.FEE);
      amount = Math.floor(amount);
      const { request, hash, secret } = await createHoldInvoice({
        description: invoiceDescription,
        amount,
      });
      order.hash = hash;
      order.secret = secret;
      order.status = 'ACTIVE';
      order.seller_id = user._id;
      await order.save();

      // monitoreamos esa invoice para saber cuando el usuario realice el pago
      await subscribeInvoice(ctx, bot, hash);

      const orderUser = await User.findOne({ _id: order.creator_id });
      await messages.beginTakeBuyMessage(bot, user, orderUser, request, order);
    } catch (error) {
      console.log(error);
      await messages.invalidDataMessage(bot, user);
    }
  });

  bot.command('release', async (ctx) => {
    try {
      const user = await validateUser(ctx, false);
      if (!user) return;

      const orderId = await validateRelease(ctx, bot, user);

      if (!orderId) return;

      const order = await validateReleaseOrder(bot, user, orderId);

      if (!order) return;

      await settleHoldInvoice({ secret: order.secret });
    } catch (error) {
      console.log(error);
    }
  });

  bot.command('dispute', async (ctx) => {
    try {
      const user = await validateUser(ctx, false);

      if (!user) return;

      const orderId = await validateDispute(ctx, bot, user);

      if (!orderId) return;

      const order = await validateDisputeOrder(bot, user, orderId);

      if (!order) return;
      let userType = 'buyer';
      let counterPartyUser = await User.findOne({ _id: order.seller_id });
      if (user._id === order.seller_id) {
        userType = 'seller';
      }

      order[`${userType}_dispute`] = true;
      order.status = 'DISPUTE';
      await order.save();
      // we increment the number of disputes on both users
      await User.updateOne(
        { _id: user._id },
        { $inc: { disputes: 1 } }).exec();
      await User.updateOne(
        { _id: counterPartyUser._id },
        { $inc: { disputes: 1 } }).exec();
      await messages.beginDisputeMessage(bot, user, counterPartyUser, order, userType);
    } catch (error) {
      console.log(error);
    }
  });

  // For now we only cancel pending orders, probably this will change
  bot.command('cancel', async (ctx) => {
    try {
      const user = await validateUser(ctx, false);
      if (!user) return;

      const orderId = await validateCancel(ctx, bot, user);

      if (!orderId) return;

      const order = await getOrder(bot, user, orderId);

      if (!order) return;

      if (order.status === 'PENDING') {
        // if we already have a holdInvoice we cancel it and return the money
        if (!!order.hash) {
          await cancelHoldInvoice({ hash: order.hash });
        }

        order.status = 'CANCELED';
        order.canceled_by = user._id;
        await order.save();
        // we sent a private message to the user
        await messages.customMessage(bot, user, `Has cancelado la orden Id: ${order._id}!`);
        // we update this order message in the channel
        await bot.telegram.editMessageText(process.env.CHANNEL, order.tg_channel_message2, null, `${order._id} CANCELADA ❌`);
        if (order.tg_chat_id < 0) {
          await bot.telegram.editMessageText(order.tg_chat_id, order.tg_group_message2, null, `${order._id} CANCELADA ❌`);
        }
      } else {
        await messages.customMessage(bot, user, `Solo se pueden cancelar las ordenes con status = PENDING`);
      }
    } catch (error) {
      console.log(error);
    }
  });

  bot.launch();

  // Enable graceful stop
  process.once('SIGINT', () => bot.stop('SIGINT'));
  process.once('SIGTERM', () => bot.stop('SIGTERM'));
};

module.exports = start;
