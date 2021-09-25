const {
    validateSeller,
    validateObjectId,
    validateTakeBuyOrder,
    validateTakeSellOrder,
  } = require('./validations');
const { Order, User } = require('../models');
const { createHoldInvoice, subscribeInvoice } = require('../ln');
const messages = require('./messages');
const { getBtcFiatPrice } = require('../util');

const takebuy = async (ctx, bot) => {
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

    // Sellers with orders in status = FIAT_SENT, have to solve the order
    const isOnFiatSentStatus = await validateSeller(bot, user);

    if (!isOnFiatSentStatus) return;

    if (!orderId) return;
    if (!(await validateObjectId(bot, user, orderId))) return;
    const order = await Order.findOne({ _id: orderId });
    if (!(await validateTakeBuyOrder(bot, user, order))) return;

    const description = `Venta por @${ctx.botInfo.username}`;
    const amount = Math.floor(order.amount + order.fee);
    const { request, hash, secret } = await createHoldInvoice({
        description,
        amount,
    });
    order.hash = hash;
    order.secret = secret;
    order.status = 'WAITING_PAYMENT';
    order.seller_id = user._id;
    order.taken_at = Date.now();
    await order.save();

    // We monitor the invoice to know when the seller makes the payment
    await subscribeInvoice(bot, hash);
    // We delete the messages related to that order from the channel
    await bot.telegram.deleteMessage(process.env.CHANNEL, order.tg_channel_message1);
    await bot.telegram.deleteMessage(process.env.CHANNEL, order.tg_channel_message2);
    await messages.beginTakeBuyMessage(bot, user, request, order);
  } catch (error) {
    console.log(error);
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

    const order = await Order.findOne({ _id: orderId });
    if (!(await validateTakeSellOrder(bot, user, order))) return;

    order.status = 'ACTIVE';
    order.buyer_id = user._id;
    if (!order.amount) {
        const amount = await getBtcFiatPrice(order.fiat_code, order.fiat_amount);
        const fee = amount * parseFloat(process.env.FEE);
        order.fee = fee;
        order.amount = amount;
    }
    await order.save();
    // We delete the messages related to that order from the channel
    await bot.telegram.deleteMessage(process.env.CHANNEL, order.tg_channel_message1);
    await bot.telegram.deleteMessage(process.env.CHANNEL, order.tg_channel_message2);
    await messages.notLightningInvoiceMessage(bot, user, order);
  } catch (error) {
    console.log(error);
  }
};

module.exports = { takebuy, takesell };