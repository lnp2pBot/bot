const {
    validateSeller,
    validateObjectId,
    validateTakeBuyOrder,
    validateTakeSellOrder,
    validateUserWaitingOrder,
  } = require('./validations');
const { Order, User } = require('../models');
const messages = require('./messages');

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
    // We delete only the button
    ctx.deleteMessage();
    // We change the status to trigger the expiration of this order
    // if the user don't do anything
    order.status = 'WAITING_PAYMENT';
    order.seller_id = user._id;
    order.taken_at = Date.now();
    await order.save();
    // Now we are commenting this cause in the future we will stop showing orders
    // on channels and we are having a bug deleting old messages
    // ------------------------------
    // We delete the messages related to that order from the channel
    // await bot.telegram.deleteMessage(process.env.CHANNEL, order.tg_channel_message1);
    // await bot.telegram.deleteMessage(process.env.CHANNEL, order.tg_channel_message2);
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
    // We delete only the button
    ctx.deleteMessage();
    order.status = 'WAITING_BUYER_INVOICE';
    order.buyer_id = user._id;
    order.taken_at = Date.now();

    await order.save();
    // Now we are commenting this cause in the future we will stop showing orders
    // on channels and we are having a bug deleting old messages
    // ------------------------------
    // We delete the messages related to that order from the channel
    // await bot.telegram.deleteMessage(process.env.CHANNEL, order.tg_channel_message1);
    // await bot.telegram.deleteMessage(process.env.CHANNEL, order.tg_channel_message2);
    await messages.beginTakeSellMessage(bot, user, order);
  } catch (error) {
    console.log(error);
    const tgUser = ctx.update.callback_query.from;
    if (!tgUser) return;
    let user = await User.findOne({ tg_id: tgUser.id });
    await messages.invalidDataMessage(bot, user);
  }
};

module.exports = { takebuy, takesell };