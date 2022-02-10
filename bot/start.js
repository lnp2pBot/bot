const { Telegraf, Scenes, session } = require('telegraf');
const schedule = require('node-schedule');
const { Order, User, PendingPayment } = require('../models');
const { getCurrenciesWithPrice } = require('../util');
const ordersActions = require('./ordersActions');
const {
  takebuy,
  takesell,
  rateUser,
  cancelAddInvoice,
  addInvoice,
  cancelShowHoldInvoice,
  showHoldInvoice,
} = require('./commands');
const {
  settleHoldInvoice,
  cancelHoldInvoice,
  payToBuyer,
  getInfo,
  isPendingPayment,
} = require('../ln');
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
  validateLightningAddress,
} = require('./validations');
const messages = require('./messages');
const { attemptPendingPayments, cancelOrders, deleteOrders } = require('../jobs');
const { addInvoiceWizard, addFiatAmountWizard } = require('./scenes');

const initialize = (botToken, options) => {
  const bot = new Telegraf(botToken, options);

  // We schedule pending payments job
  const pendingPaymentJob = schedule.scheduleJob(`*/${process.env.PENDING_PAYMENT_WINDOW} * * * *`, async () => {
    await attemptPendingPayments(bot);
  });
  const cancelOrderJob = schedule.scheduleJob(`*/2 * * * *`, async () => {
    await cancelOrders(bot);
  });
  const deleteOrdersJob = schedule.scheduleJob(`25 * * * *`, async () => {
    await deleteOrders(bot);
  });

  const stage = new Scenes.Stage([addInvoiceWizard, addFiatAmountWizard]);
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
      const { amount, fiatAmount, fiatCode, paymentMethod, priceMargin } = sellOrderParams;
      const order = await ordersActions.createOrder(ctx, bot, user, {
        type: 'sell',
        amount,
        fiatAmount,
        fiatCode,
        paymentMethod,
        status: 'PENDING',
        priceMargin,
      });

      if (!!order) {
        await messages.publishSellOrderMessage(bot, order);
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

      const { amount, fiatAmount, fiatCode, paymentMethod, priceMargin } = buyOrderParams;
      //revisar por que esta creando invoice sin monto
      const order = await ordersActions.createOrder(ctx, bot, user, {
        type: 'buy',
        amount,
        fiatAmount,
        fiatCode,
        paymentMethod,
        status: 'PENDING',
        priceMargin,
      });

      if (!!order) {
        await messages.publishBuyOrderMessage(bot, order);
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

      const [orderId] = await validateParams(ctx, bot, user, 2, '\\<_order id_\\>');

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

      const [orderId] = await validateParams(ctx, bot, user, 2, '\\<_order id_\\>');

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

      const [orderId] = await validateParams(ctx, bot, user, 2, '\\<_order id_\\>');

      if (!orderId) return;
      if (!(await validateObjectId(bot, user, orderId))) return;
      const order = await ordersActions.getOrder(bot, user, orderId);

      if (!order) return;

      if (order.status !== 'PENDING' && order.status !== 'WAITING_PAYMENT') {
        await messages.badStatusOnCancelOrderMessage(bot, user);
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
      await messages.successCancelOrderMessage(bot, user, order);
      // We delete the messages related to that order from the channel
      await bot.telegram.deleteMessage(process.env.CHANNEL, order.tg_channel_message1);
      await bot.telegram.deleteMessage(process.env.CHANNEL, order.tg_channel_message2);
    } catch (error) {
      console.log(error);
    }
  });

  // We allow users cancel all pending orders,
  // pending orders are the ones that are not taken by another user
  bot.command('cancelall', async (ctx) => {
    try {
      const user = await validateUser(ctx, bot, false);
      if (!user) return;

      const orders = await ordersActions.getOrders(bot, user, 'PENDING');

      if (!orders) return;

      for (const order of orders) {
        order.status = 'CANCELED';
        order.canceled_by = user._id;
        await order.save();
        // We delete the messages related to that order from the channel
        await bot.telegram.deleteMessage(process.env.CHANNEL, order.tg_channel_message1);
        await bot.telegram.deleteMessage(process.env.CHANNEL, order.tg_channel_message2);
      }
      // we sent a private message to the user
      await messages.successCancelAllOrdersMessage(bot, user);
    } catch (error) {
      console.log(error);
    }
  });

  bot.command('cancelorder', async (ctx) => {
    try {
      const user = await validateAdmin(ctx, bot);
      if (!user) return;

      const [orderId] = await validateParams(ctx, bot, user, 2, '\\<_order id_\\>');

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
      await messages.successCancelOrderMessage(bot, user, order);
      // we sent a private message to the seller
      await messages.successCancelOrderByAdminMessage(bot, seller, order);
      // we sent a private message to the buyer
      await messages.successCancelOrderByAdminMessage(bot, buyer, order);
    } catch (error) {
      console.log(error);
    }
  });


  bot.command('settleorder', async (ctx) => {
    try {
      const user = await validateAdmin(ctx, bot);
      if (!user) return;

      const [orderId] = await validateParams(ctx, bot, user, 2, '\\<_order id_\\>');

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
      await messages.successCompleteOrderMessage(bot, user, order);
      // we sent a private message to the seller
      await messages.successCompleteOrderByAdminMessage(bot, seller, order);
      // we sent a private message to the buyer
      await messages.successCompleteOrderByAdminMessage(bot, buyer, order);
    } catch (error) {
      console.log(error);
    }
  });


  bot.command('checkorder', async (ctx) => {
    try {
      const user = await validateAdmin(ctx, bot);
      if (!user) return;

      const [orderId] = await validateParams(ctx, bot, user, 2, '\\<_order id_\\>');

      if (!orderId) return;
      if (!(await validateObjectId(bot, user, orderId))) return;
      const order = await Order.findOne({_id: orderId});

      if (!order) return;

      const creator = await User.findOne({ _id: order.creator_id });
      const buyer = await User.findOne({ _id: order.buyer_id });
      const seller = await User.findOne({ _id: order.seller_id });
      const buyerUsername = !!buyer ? buyer.username : '';
      const sellerUsername = !!seller ? seller.username : '';

      await messages.checkOrderMessage(ctx, order, creator.username, buyerUsername, sellerUsername);

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
      const [orderId] = await validateParams(ctx, bot, user, 2, '\\<_order id_\\>');

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

      const [orderId] = await validateParams(ctx, bot, user, 2, '\\<_order id_\\>');

      if (!orderId) return;
      if (!(await validateObjectId(bot, user, orderId))) return;
      const order = await ordersActions.getOrder(bot, user, orderId);

      if (!order) return;

      if (order.status != 'ACTIVE') {
        await messages.onlyActiveCooperativeCancelMessage(bot, user);
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
        await messages.shouldWaitCooperativeCancelMessage(bot, initiatorUser);
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
        await messages.successCancelOrderMessage(bot, initiatorUser, order, true);
        await messages.okCooperativeCancelMessage(bot, counterPartyUser, order);
      } else {
        await messages.initCooperativeCancelMessage(bot, initiatorUser, order);
        await messages.counterPartyWantsCooperativeCancelMessage(bot, counterPartyUser, order);
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

      const [ username ] = await validateParams(ctx, bot, adminUser, 2, '\\<_username_\\>');

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

  bot.command('setaddress', async (ctx) => {
    try {
      const user = await validateUser(ctx, bot, false);

      if (!user)
        return;

      let [ lightningAddress ] = await validateParams(ctx, bot, user, 2, '\\<_lightningAddress / off_\\>');
      if (!lightningAddress) {
        return;
      }

      if (lightningAddress == 'off') {
        user.lightning_address = null;
        await user.save();
        await messages.disableLightningAddress(bot, user)
        return;
      }

      if (!await validateLightningAddress(lightningAddress)) {
        await messages.invalidLightningAddress(bot, user)
        return;
      }
      
      user.lightning_address = lightningAddress;
      await user.save();
      await messages.successSetAddress(bot, user)
      
    } catch (error) {
      console.log(error);
    }
  });

  // Only buyers can use this command
  bot.command('setinvoice', async (ctx) => {
    try {
      const user = await validateUser(ctx, bot, false);

      if (!user) return;
      const [orderId, lnInvoice] = await validateParams(ctx, bot, user, 3, '\\<_order id_\\> \\<_lightning invoice_\\>');

      if (!orderId) return;
      const invoice = await validateInvoice(bot, user, lnInvoice);
      if (!invoice) return;
      if (!(await validateObjectId(bot, user, orderId))) return;
      const order = await Order.findOne({
        _id: orderId,
        buyer_id: user._id,
      });
      if (!order) {
        await messages.notActiveOrderMessage(bot, user);
        return;
      };
      if (order.status == 'SUCCESS') {
        await messages.successCompleteOrderMessage(bot, user, order);
        return;
      }
      if (invoice.tokens && invoice.tokens != order.amount) {
        await messages.incorrectAmountInvoiceMessage(bot, user);
        return;
      }
      order.buyer_invoice = lnInvoice;
      // When a seller release funds but the buyer didn't get the invoice paid
      if (order.status == 'PAID_HOLD_INVOICE') {
        const isScheduled = await PendingPayment.findOne({
          order_id: order._id,
          attempts: { $lt: 3 },
        });
        // We check if the payment is on flight
        const isPending = await isPendingPayment(order.buyer_invoice);

        if (!!isScheduled || !!isPending) {
          await messages.invoiceAlreadyUpdatedMessage(bot, user);
          return;
        }

        if (!order.paid_hold_buyer_invoice_updated) {
          order.paid_hold_buyer_invoice_updated = true;
          const pp = new PendingPayment({
            amount: order.amount,
            payment_request: lnInvoice,
            user_id: user._id,
            description: order.description,
            hash: order.hash,
            order_id: order._id,
          });
          await pp.save();
          await messages.invoiceUpdatedPaymentWillBeSendMessage(bot, user);
        } else {
          await messages.invoiceAlreadyUpdatedMessage(bot, user);
        }
      } else {
        await messages.invoiceUpdatedMessage(bot, user);
      }

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
    await addInvoice(ctx, bot);
  });

  bot.action('cancelAddInvoiceBtn', async (ctx) => {
    await cancelAddInvoice(ctx, bot);
  });

  bot.action('showHoldInvoiceBtn', async (ctx) => {
    await showHoldInvoice(ctx, bot);
  });

  bot.action('cancelShowHoldInvoiceBtn', async (ctx) => {
    await cancelShowHoldInvoice(ctx, bot);
  });

  bot.action(/^showStarBtn\(([1-5]),(\w{24})\)$/, async (ctx) => {
    await rateUser(ctx, bot, ctx.match[1], ctx.match[2]);
  });

  bot.command('paytobuyer', async (ctx) => {
    try {
      const adminUser = await validateAdmin(ctx, bot);
      if (!adminUser) return;
      const [ orderId ] = await validateParams(ctx, bot, adminUser, 2, '\\<_order id_\\>');
      if (!orderId) return;
      if (!(await validateObjectId(bot, adminUser, orderId))) return;
      const order = await Order.findOne({
        _id: orderId,
      });
      if (!order) {
        await messages.notActiveOrderMessage(bot, adminUser);
        return;
      };

      // We make sure the buyers invoice is not being paid
      const isPending = await PendingPayment.findOne({
        order_id: order._id,
        attempts: { $lt: 3 },
      });

      if (!!isPending) {
        return;
      }
      await payToBuyer(bot, order);
    } catch (error) {
      console.log(error);
    }
  });

  bot.command('listcurrencies', async (ctx) => {
    try {
      const user = await validateUser(ctx, bot, false);

      if (!user) return;

      const currencies = getCurrenciesWithPrice();

      await messages.listCurrenciesResponse(bot, user, currencies);
    } catch (error) {
      console.log(error);
    }
  });

  bot.command('info', async (ctx) => {
    try {
      const user = await validateUser(ctx, bot, false);

      if (!user) return;

      const info = await getInfo();

      await messages.showInfoMessage(bot, user, info);
    } catch (error) {
      console.log(error);
    }
  });

  bot.command('showusername', async (ctx) => {
    try {
      const user = await validateUser(ctx, bot, false);

      if (!user) return;

      let [ show ] = await validateParams(ctx, bot, user, 2, '_yes/no_');
      if (!show) return;
      show = show == 'yes' ? true : false;
      user.show_username = show;
      await user.save();
      messages.updateUserSettingsMessage(bot, user, 'showusername', show);
    } catch (error) {
      console.log(error);
    }
  });

  bot.command('showvolume', async (ctx) => {
    try {
      const user = await validateUser(ctx, bot, false);

      if (!user) return;

      let [ show ] = await validateParams(ctx, bot, user, 2, '_yes/no_');
      if (!show) return;
      show = show == 'yes' ? true : false;
      user.show_volume_traded = show;
      await user.save();
      messages.updateUserSettingsMessage(bot, user, 'showvolume', show);
    } catch (error) {
      console.log(error);
    }
  });

  return bot;
};

const start = (botToken) => {
  const bot = initialize(botToken);

  bot.launch();

  console.log('Bot launched.');

  // Enable graceful stop
  process.once('SIGINT', () => bot.stop('SIGINT'));
  process.once('SIGTERM', () => bot.stop('SIGTERM'));

  return bot;
};

module.exports = { initialize, start };
