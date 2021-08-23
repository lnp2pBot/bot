const { Telegraf } = require('telegraf');
const { Order, User } = require('../models');
const { createOrder, getOrder } = require('./ordersActions');
const { settleHoldInvoice, createHoldInvoice, cancelHoldInvoice, subscribeInvoice } = require('../ln');
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
  validateCancelAdmin,
  validateAdmin,
  validateSettleAdmin,
  validateFiatSent,
  validateFiatSentOrder,
  validateSeller,
  validateCooperativeCancel,
} = require('./validations');
const messages = require('./messages');

const start = () => {
  const bot = new Telegraf(process.env.BOT_TOKEN);

  bot.start(async (ctx) => {
    try {
      const tgUser = ctx.update.message.from;
      if (!tgUser.username) {
        await messages.nonHandleErrorMessage(ctx);
        return;
      }
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
      // Sellers with orders in status = FIAT_SENT, have to solve the order
      const isOnFiatSentStatus = await validateSeller(bot, user);

      if (!isOnFiatSentStatus) return;

      const sellOrderParams = await validateSellOrder(ctx, bot, user);
      if (!sellOrderParams) return;

      const { amount, fiatAmount, fiatCode, paymentMethod } = sellOrderParams;
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
      }

      const { amount, fiatAmount, fiatCode, paymentMethod, lnInvoice } = buyOrderParams;

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

      const { orderId, lnInvoice } = takeSellParams;

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

      // Sellers with orders in status = FIAT_SENT, have to solve the order
      const isOnFiatSentStatus = await validateSeller(bot, user);

      if (!isOnFiatSentStatus) return;

      const orderId = await validateTakeBuy(ctx, bot, user);

      if (!orderId) return;

      const order = await Order.findOne({ _id: orderId });
      if (!(await validateTakeBuyOrder(bot, user, order))) return;

      const invoiceDescription = `Venta por @${ctx.botInfo.username}`;
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

      await messages.beginTakeBuyMessage(bot, user, request, order);
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

      let buyer = await User.findOne({ _id: order.buyer_id });
      let seller = await User.findOne({ _id: order.seller_id });
      let initiator = 'seller';
      if (user._id == order.buyer_id) initiator = 'buyer';

      order[`${initiator}_dispute`] = true;
      order.status = 'DISPUTE';
      await order.save();
      // We increment the number of disputes on both users
      // If a user disputes is equal to MAX_DISPUTES, we ban the user
      const buyerDisputes = buyer.disputes + 1;
      const sellerDisputes = seller.disputes + 1;
      buyer.disputes = buyerDisputes;
      seller.disputes = sellerDisputes;
      if (buyerDisputes >= process.env.MAX_DISPUTES) {
        buyer.banned = true;
      }
      if (sellerDisputes >= process.env.MAX_DISPUTES) {
        seller.banned = true;
      }
      await buyer.save();
      await seller.save();
      await messages.beginDisputeMessage(bot, buyer, seller, order, initiator);
    } catch (error) {
      console.log(error);
    }
  });

  // We allow users cancel pending orders,
  // pending orders are the ones that are not taken by another user
  bot.command('cancel', async (ctx) => {
    try {
      const user = await validateUser(ctx, false);
      if (!user) return;

      const orderId = await validateCancel(ctx, bot, user);

      if (!orderId) return;

      const order = await getOrder(bot, user, orderId);

      if (!order) return;

      if (order.status !== 'PENDING') {
        await messages.customMessage(bot, user, `Esta opción solo permite cancelar las ordenes que no han sido tomadas`);
        return;
      }

      // If we already have a holdInvoice we cancel it and return the money
      if (!!order.hash) {
        await cancelHoldInvoice({ hash: order.hash });
      }

      order.status = 'CANCELED';
      order.canceled_by = user._id;
      await order.save();
      // we sent a private message to the user
      await messages.customMessage(bot, user, `Has cancelado la orden Id: ${order._id}!`);
      // we update this order message in the channel
      await bot.telegram.editMessageText(process.env.CHANNEL, order.tg_channel_message2, null, `Orden ${order._id} CANCELADA ❌`);
      if (order.tg_chat_id < 0) {
        await bot.telegram.editMessageText(order.tg_chat_id, order.tg_group_message2, null, `Orden ${order._id} CANCELADA ❌`);
      }
    } catch (error) {
      console.log(error);
    }
  });

  bot.command('cancelorder', async (ctx) => {
    try {
      const user = await validateAdmin(ctx);
      if (!user) return;

      const orderId = await validateCancelAdmin(ctx, bot, user);

      if (!orderId) return;

      const order = await getOrder(bot, user, orderId);

      if (!order) return;

      if (!!order.hash) {
        await cancelHoldInvoice({ hash: order.hash });
      }

      order.status = 'CANCELED_BY_ADMIN';
      order.canceled_by = user._id;
      const buyer = await User.findOne({ _id: order.buyer_id });
      const seller = await User.findOne({ _id: order.seller_id });
      await order.save();
      // we sent a private message to the admin
      await messages.customMessage(bot, user, `Has cancelado la orden Id: ${order._id}!`);
      // we sent a private message to the seller
      await messages.customMessage(bot, seller, `El admin ha cancelado la orden Id: ${order._id}!`);
      // we sent a private message to the buyer
      await messages.customMessage(bot, buyer, `El admin cancelado la orden Id: ${order._id}!`);
      // we update this order message in the channel
      await bot.telegram.editMessageText(process.env.CHANNEL, order.tg_channel_message2, null, `Orden ${order._id} CANCELADA ❌`);
      if (order.tg_chat_id < 0) {
        await bot.telegram.editMessageText(order.tg_chat_id, order.tg_group_message2, null, `Orden ${order._id} CANCELADA ❌`);
      }
    } catch (error) {
      console.log(error);
    }
  });


  bot.command('settleorder', async (ctx) => {
    try {
      const user = await validateAdmin(ctx);
      if (!user) return;

      const orderId = await validateSettleAdmin(ctx, bot, user);

      if (!orderId) return;

      const order = await getOrder(bot, user, orderId);

      if (!order) return;

      if (!!order.secret) {
        await settleHoldInvoice({ secret: order.secret });
      }

      order.status = 'COMPLETED_BY_ADMIN';
      const buyer = await User.findOne({ _id: order.buyer_id });
      const seller = await User.findOne({ _id: order.seller_id });
      await order.save();
      // we sent a private message to the admin
      await messages.customMessage(bot, user, `Has completado la orden Id: ${order._id}!`);
      // we sent a private message to the seller
      await messages.customMessage(bot, seller, `El admin ha completado la orden Id: ${order._id}!`);
      // we sent a private message to the buyer
      await messages.customMessage(bot, buyer, `El admin completado la orden Id: ${order._id}!`);
      // we update this order message in the channel
      await bot.telegram.editMessageText(process.env.CHANNEL, order.tg_channel_message2, null, `Orden ${order._id} COMPLETADA ✅`);
      if (order.tg_chat_id < 0) {
        await bot.telegram.editMessageText(order.tg_chat_id, order.tg_group_message2, null, `Orden ${order._id} COMPLETADA ✅`);
      }
    } catch (error) {
      console.log(error);
    }
  });


  bot.command('checkorder', async (ctx) => {
    try {
      const user = await validateAdmin(ctx);
      if (!user) return;

      const orderId = await validateCancelAdmin(ctx, bot, user);

      if (!orderId) return;

      const order = await getOrder(bot, user, orderId);

      if (!order) return; 

      const creator = await User.findOne({ _id: order.seller_id }); 
      const buyer = await User.findOne({ _id: order.buyer_id });
      const seller = await User.findOne({ _id: order.seller_id }); 

      await messages.checkOrderMessage(ctx,order,creator.username,buyer.username,seller.username);

    } catch (error) {
      console.log(error);
    }
  });

  
  bot.command('help', async (ctx) => {
    try {
      const user = await validateUser(ctx, false);
      if (!user) return; 
      
      await messages.helpMessage(ctx);
    } catch (error) {
      console.log(error);
    }
  });

  // Only buyers can use this command
  bot.command('fiatsent', async (ctx) => {
    try {
      const user = await validateUser(ctx, false);

      if (!user) return;

      const orderId = await validateFiatSent(ctx, bot, user);

      if (!orderId) return;

      const order = await validateFiatSentOrder(bot, user, orderId);

      if (!order) return;

      order.status = 'FIAT_SENT';
      const seller = await User.findOne({ _id: order.seller_id });
      await order.save();
      // We sent messages to both parties
      await messages.fiatSentMessages(bot, user, seller);

    } catch (error) {
      console.log(error);
    }
  });

  bot.command('cooperativecancel', async (ctx) => {
    try {
      const user = await validateUser(ctx, false);

      if (!user) return;

      const orderId = await validateCooperativeCancel(ctx, bot, user);

      if (!orderId) return;

      const order = await getOrder(bot, user, orderId);

      if (!order) return;

      if (order.status !== 'ACTIVE') {
        await messages.customMessage(bot, user, `Esta opción solo permite cancelar cooperativamente las ordenes activas`);
        return;
      }
      let initiatorUser, counterPartyUser, initiator, counterParty;

      if (user._id == order.buyer_id) {
        initiatorUser = user;
        counterPartyUser = await User.findOne({ _id: order.seller_id });
        initiator = 'buyer';
        counterParty = 'seller';
      } else {
        counterPartyUser = await User.findOne({ _id: order.buyer_id });
        initiatorUser = user;
        initiator = 'seller';
        counterParty = 'buyer';
      }

      if (order[`${initiator}_cooperativecancel`]) {
        await messages.customMessage(bot, initiatorUser, `Ya has realizado esta operación, debes esperar por tu contraparte`);
        return;
      }

      order[`${initiator}_cooperativecancel`] = true;

      // If the counter party already requested a cooperative cancel order
      if (order[`${counterParty}_cooperativecancel`]) {
        // If we already have a holdInvoice we cancel it and return the money
        if (!!order.hash) {
          await cancelHoldInvoice({ hash: order.hash });
        }

        order.status = 'CANCELED';
        // We sent a private message to the users
        await messages.customMessage(bot, initiatorUser, `Has cancelado la orden Id: ${order._id}!`);
        await messages.customMessage(bot, counterPartyUser, `Tu contraparte ha estado de acuerdo y ha sido cancelada la orden Id: ${order._id}!`);
        // We update this order message in the channel
        await bot.telegram.editMessageText(process.env.CHANNEL, order.tg_channel_message2, null, `Orden ${order._id} CANCELADA ❌`);
        if (order.tg_chat_id < 0) {
          await bot.telegram.editMessageText(order.tg_chat_id, order.tg_group_message2, null, `Orden ${order._id} CANCELADA ❌`);
        }
      } else {
        await messages.customMessage(bot, initiatorUser, `Has iniciado la cancelación de la orden Id: ${order._id}, tu contraparte también debe indicarme que desea cancelar la orden`);
        await messages.customMessage(bot, counterPartyUser, `Tu contraparte quiere cancelar la orden Id: ${order._id}, si estás de acuerdo utiliza el comando 👇`);
        await messages.customMessage(bot, counterPartyUser, `/cooperativecancel ${order._id}`);
      }
      await order.save();

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
