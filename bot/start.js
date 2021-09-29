const { Telegraf, Scenes, session } = require('telegraf');
const schedule = require('node-schedule');
const { Order, User } = require('../models');
const ordersActions = require('./ordersActions');
const { takebuy, takesell } = require('./commands');
const { settleHoldInvoice, createHoldInvoice, cancelHoldInvoice, subscribeInvoice } = require('../ln');
const {
  validateSellOrder,
  validateUser,
  validateBuyOrder,
  validateReleaseOrder,
  validateDisputeOrder,
  validateAdmin,
  validateFiatSentOrder,
  validateSeller,
  validateParams,
  validateObjectId,
  validateInvoice,
} = require('./validations');
const messages = require('./messages');
const { attemptPendingPayments, cancelOrders } = require('../jobs');
const addInvoiceWizard = require('./scenes');

const initialize = (botToken, options) => {
  const bot = new Telegraf(botToken, options);

  // We schedule pending payments job
  const pendingPaymentJob = schedule.scheduleJob(`*/${process.env.PENDING_PAYMENT_WINDOW} * * * *`, async () => {
    await attemptPendingPayments(bot);
  });
  const cancelOrderJob = schedule.scheduleJob(`*/5 * * * *`, async () => {
    await cancelOrders(bot);
  });

  const stage = new Scenes.Stage([addInvoiceWizard]);
  bot.use(session());

  bot.use(stage.middleware());

  bot.start(async (ctx) => {
    try {
      const tgUser = ctx.update.message.from;
      if (!tgUser.username) {
        await messages.nonHandleErrorMessage(ctx);
        return;
      }
      messages.startMessage(ctx);
      await validateUser(ctx, bot, true);
    } catch (error) {
      console.log(error);
    }
  });

  bot.command('sell', async (ctx) => {
    try {
      const user = await validateUser(ctx, bot, false);

      if (!user) return;
      // Sellers with orders in status = FIAT_SENT, have to solve the order
      const isOnFiatSentStatus = await validateSeller(bot, user);

      if (!isOnFiatSentStatus) return;

      const sellOrderParams = await validateSellOrder(ctx, bot, user);

      if (!sellOrderParams) return;
      const { amount, fiatAmount, fiatCode, paymentMethod } = sellOrderParams;
      const order = await ordersActions.createOrder(ctx, bot, user, {
        type: 'sell',
        amount,
        seller: user,
        fiatAmount,
        fiatCode,
        paymentMethod,
        status: 'PENDING',
      });

      if (!!order) {
        await messages.publishSellOrderMessage(ctx, bot, order);
        await messages.pendingSellMessage(bot, user, order);
      }
    } catch (error) {
      console.log(error);
    }
  });

  bot.command('buy', async (ctx) => {
    try {
      const user = await validateUser(ctx, bot, false);

      if (!user) return;

      const buyOrderParams = await validateBuyOrder(ctx, bot, user);
      if (!buyOrderParams) return;

      const { amount, fiatAmount, fiatCode, paymentMethod } = buyOrderParams;
      //revisar por que esta creando invoice sin monto
      const order = await ordersActions.createOrder(ctx, bot, user, {
        type: 'buy',
        amount,
        buyer: user,
        fiatAmount,
        fiatCode,
        paymentMethod,
        status: 'PENDING',
      });

      if (!!order) {
        await messages.publishBuyOrderMessage(ctx, bot, order);
        await messages.pendingBuyMessage(bot, user, order);
      }
    } catch (error) {
      console.log(error);
    }
  });

  bot.action('takesell', async (ctx) => {
    await takesell(ctx, bot);
  });

  bot.action('takebuy', async (ctx) => {
    await takebuy(ctx, bot);
  });

  bot.command('release', async (ctx) => {
    try {
      const user = await validateUser(ctx, bot, false);
      if (!user) return;

      const [orderId] = await validateParams(ctx, bot, user, 2, '<order_id>');

      if (!orderId) return;
      if (!(await validateObjectId(bot, user, orderId))) return;
      const order = await validateReleaseOrder(bot, user, orderId);

      if (!order) return;

      await settleHoldInvoice({ secret: order.secret });
    } catch (error) {
      console.log(error);
    }
  });

  bot.command('dispute', async (ctx) => {
    try {
      const user = await validateUser(ctx, bot, false);

      if (!user) return;

      const [orderId] = await validateParams(ctx, bot, user, 2, '<order_id>');

      if (!orderId) return;
      if (!(await validateObjectId(bot, user, orderId))) return;
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
      const user = await validateUser(ctx, bot, false);
      if (!user) return;

      const [orderId] = await validateParams(ctx, bot, user, 2, '<order_id>');

      if (!orderId) return;
      if (!(await validateObjectId(bot, user, orderId))) return;
      const order = await ordersActions.getOrder(bot, user, orderId);

      if (!order) return;

      if (order.status !== 'PENDING' && order.status !== 'WAITING_PAYMENT') {
        await messages.customMessage(bot, user, `Esta opción solo permite cancelar las ordenes que no han sido tomadas o en las cuales el vendedor ha tardado mucho para pagar la factura`);
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
      // We delete the messages related to that order from the channel
      await bot.telegram.deleteMessage(process.env.CHANNEL, order.tg_channel_message1);
      await bot.telegram.deleteMessage(process.env.CHANNEL, order.tg_channel_message2);
    } catch (error) {
      console.log(error);
    }
  });

  bot.command('cancelorder', async (ctx) => {
    try {
      const user = await validateAdmin(ctx, bot);
      if (!user) return;

      const [orderId] = await validateParams(ctx, bot, user, 2, '<order_id>');

      if (!orderId) return;
      if (!(await validateObjectId(bot, user, orderId))) return;
      const order = await Order.findOne({ _id: orderId });

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
      // We delete the messages related to that order from the channel
      await bot.telegram.deleteMessage(process.env.CHANNEL, order.tg_channel_message1);
      await bot.telegram.deleteMessage(process.env.CHANNEL, order.tg_channel_message2);
    } catch (error) {
      console.log(error);
    }
  });


  bot.command('settleorder', async (ctx) => {
    try {
      const user = await validateAdmin(ctx, bot);
      if (!user) return;

      const [orderId] = await validateParams(ctx, bot, user, 2, '<order_id>');

      if (!orderId) return;
      if (!(await validateObjectId(bot, user, orderId))) return;

      const order = await Order.findOne({_id: orderId});
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
    } catch (error) {
      console.log(error);
    }
  });


  bot.command('checkorder', async (ctx) => {
    try {
      const user = await validateAdmin(ctx, bot);
      if (!user) return;

      const [orderId] = await validateParams(ctx, bot, user, 2, '<order_id>');

      if (!orderId) return;
      if (!(await validateObjectId(bot, user, orderId))) return;
      const order = await Order.findOne({_id: orderId});

      if (!order) return;

      const creator = await User.findOne({ _id: order.seller_id });
      const buyer = await User.findOne({ _id: order.buyer_id });
      const seller = await User.findOne({ _id: order.seller_id });

      await messages.checkOrderMessage(ctx, order, creator.username, buyer.username, seller.username);

    } catch (error) {
      console.log(error);
    }
  });

  bot.command('help', async (ctx) => {
    try {
      const user = await validateUser(ctx, bot, false);
      if (!user) return;

      await messages.helpMessage(ctx);
    } catch (error) {
      console.log(error);
    }
  });

  // Only buyers can use this command
  bot.command('fiatsent', async (ctx) => {
    try {
      const user = await validateUser(ctx, bot, false);

      if (!user) return;
      const [orderId] = await validateParams(ctx, bot, user, 2, '<order_id>');

      if (!orderId) return;
      if (!(await validateObjectId(bot, user, orderId))) return;
      const order = await validateFiatSentOrder(bot, user, orderId);

      if (!order) return;

      order.status = 'FIAT_SENT';
      const seller = await User.findOne({ _id: order.seller_id });
      await order.save();
      // We sent messages to both parties
      await messages.fiatSentMessages(bot, user, seller, order);

    } catch (error) {
      console.log(error);
    }
  });

  bot.command('cooperativecancel', async (ctx) => {
    try {
      const user = await validateUser(ctx, bot, false);

      if (!user) return;

      const [orderId] = await validateParams(ctx, bot, user, 2, '<order_id>');

      if (!orderId) return;
      if (!(await validateObjectId(bot, user, orderId))) return;
      const order = await ordersActions.getOrder(bot, user, orderId);

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
        // We delete the messages related to that order from the channel
        await bot.telegram.deleteMessage(process.env.CHANNEL, order.tg_channel_message1);
        await bot.telegram.deleteMessage(process.env.CHANNEL, order.tg_channel_message2);
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

  bot.command('ban', async (ctx) => {
    try {
      const adminUser = await validateAdmin(ctx, bot);

      if (!adminUser) return;

      const [ username ] = await validateParams(ctx, bot, adminUser, 2, '<username>');

      if (!username) return;
      
      const user = await User.findOne({ username });
      if (!user) {
        await messages.notFoundUserMessage(bot, adminUser);
        return;
      }

      if (!(await validateObjectId(bot, user, params[0]))) return;
      user.banned = true;
      await user.save();
      await messages.userBannedMessage(bot, adminUser);
    } catch (error) {
      console.log(error);
    }
  });

  // Only buyers can use this command
  bot.command('setinvoice', async (ctx) => {
    try {
      const user = await validateUser(ctx, bot, false);

      if (!user) return;
      const [orderId, lnInvoice] = await validateParams(ctx, bot, user, 3, '<order_id> <lightning_invoice>');

      if (!orderId) return;
      const invoice = await validateInvoice(bot, user, lnInvoice);
      if (!(await validateObjectId(bot, user, orderId))) return;
      if (!invoice) return;
      const order = await Order.findOne({
        _id: orderId,
        buyer_id: user._id,
      });
      if (!order) {
        await messages.notActiveOrderMessage(bot, user);
        return;
      };
      if (invoice.tokens && invoice.tokens != order.amount) {
        await messages.incorrectAmountInvoiceMessage(bot, user);
        return;
      }

      order.buyer_invoice = lnInvoice;
      await order.save();
    } catch (error) {
      console.log(error);
      const user = await validateUser(ctx, bot, false);
      await messages.genericErrorMessage(bot, user);
    }
  });

  bot.command('listorders', async (ctx) => {
    try {
      const user = await validateUser(ctx, bot, false);

      if (!user) return;

      const orders = await ordersActions.getOrders(bot, user);

      if (!orders) return;

      await messages.listOrdersResponse(bot, user, orders);

    } catch (error) {
      console.log(error);
    }
  });

  bot.action('addInvoiceBtn', async (ctx) => {
    try {
      const orderId = ctx.update.callback_query.message.text;
      if (!orderId) return;
      const order = await Order.findOne({ _id: orderId });
      if (!orderId) return;
      let buyer = await User.findOne({ _id: order.buyer_id });
      let seller = await User.findOne({ _id: order.seller_id });
      ctx.scene.enter('ADD_INVOICE_WIZARD_SCENE_ID', { order, seller, buyer, bot });
    } catch (error) {
      console.log(error);
    }
  });

  return bot;
};

const start = (botToken) => {
  const bot = initialize(botToken);

  bot.launch();

  // Enable graceful stop
  process.once('SIGINT', () => bot.stop('SIGINT'));
  process.once('SIGTERM', () => bot.stop('SIGTERM'));
};

module.exports = { initialize, start };
