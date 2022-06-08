const { Telegraf, session } = require('telegraf');
const { I18n } = require('@grammyjs/i18n');
const schedule = require('node-schedule');
const {
  Order,
  User,
  PendingPayment,
  Community,
  Dispute,
} = require('../models');
const { getCurrenciesWithPrice, deleteOrderFromChannel } = require('../util');
const ordersActions = require('./ordersActions');
const CommunityModule = require('./modules/community');
const OrdersModule = require('./modules/orders');
const DisputeModule = require('./modules/dispute');
const {
  takebuy,
  takesell,
  rateUser,
  cancelAddInvoice,
  addInvoice,
  cancelShowHoldInvoice,
  showHoldInvoice,
  waitPayment,
  updateCommunity,
  addInvoicePHI,
} = require('./commands');
const {
  settleHoldInvoice,
  cancelHoldInvoice,
  payToBuyer,
  isPendingPayment,
} = require('../ln');
const {
  validateUser,
  validateReleaseOrder,
  validateAdmin,
  validateFiatSentOrder,
  validateParams,
  validateObjectId,
  validateInvoice,
  validateLightningAddress,
} = require('./validations');
const messages = require('./messages');
const { updateCommunityMessage } = require('./modules/community/messages');
const {
  attemptPendingPayments,
  cancelOrders,
  deleteOrders,
} = require('../jobs');
const logger = require('../logger');

const initialize = (botToken, options) => {
  const i18n = new I18n({
    defaultLanguageOnMissing: true, // implies allowMissing = true
    directory: 'locales',
    useSession: true,
  });

  const bot = new Telegraf(botToken, options);
  bot.catch(err => {
    logger.error(err);
  });

  // We schedule pending payments job
  schedule.scheduleJob(
    `*/${process.env.PENDING_PAYMENT_WINDOW} * * * *`,
    async () => {
      await attemptPendingPayments(bot);
    }
  );

  schedule.scheduleJob(`*/2 * * * *`, async () => {
    await cancelOrders(bot);
  });

  schedule.scheduleJob(`25 * * * *`, async () => {
    await deleteOrders(bot);
  });

  bot.use(session());
  bot.use(i18n.middleware());
  bot.use(require('./stage').middleware());

  bot.start(async ctx => {
    try {
      const tgUser = ctx.update.message.from;
      if (!tgUser.username) return await messages.nonHandleErrorMessage(ctx);

      messages.startMessage(ctx);
      await validateUser(ctx, true);
    } catch (error) {
      logger.error(error);
    }
  });

  bot.command('version', async ctx => {
    try {
      const pckg = require('../package.json');
      await ctx.reply(pckg.version);
    } catch (err) {
      logger.error(err);
    }
  });

  CommunityModule.configure(bot);

  bot.action('takesell', async ctx => {
    await takesell(ctx, bot);
  });

  bot.action('takebuy', async ctx => {
    await takebuy(ctx, bot);
  });

  bot.command('release', async ctx => {
    try {
      const user = await validateUser(ctx, false);
      if (!user) return;

      const [orderId] = await validateParams(ctx, 2, '\\<_order id_\\>');

      if (!orderId) return;
      if (!(await validateObjectId(ctx, orderId))) return;
      const order = await validateReleaseOrder(ctx, user, orderId);

      if (!order) return;
      // We look for a dispute for this order
      const dispute = await Dispute.findOne({ order_id: order._id });

      if (dispute) {
        dispute.status = 'RELEASED';
        await dispute.save();
      }

      await settleHoldInvoice({ secret: order.secret });
    } catch (error) {
      logger.error(error);
    }
  });

  DisputeModule.configure(bot);

  bot.command('cancelorder', async ctx => {
    try {
      const user = await validateAdmin(ctx);
      if (!user) return;

      const [orderId] = await validateParams(ctx, 2, '\\<_order id_\\>');

      if (!orderId) return;
      if (!(await validateObjectId(ctx, orderId))) return;
      const order = await Order.findOne({ _id: orderId });

      if (!order) return;

      // We look for a dispute for this order
      const dispute = await Dispute.findOne({ order_id: order._id });

      // We check if this is a solver, the order must be from the same community
      if (!user.admin) {
        if (!order.community_id) {
          logger.debug(
            `cancelorder ${order._id}: The order is not in a community`
          );
          return await messages.notAuthorized(ctx);
        }

        if (order.community_id != user.default_community_id) {
          logger.debug(
            `cancelorder ${order._id}: The community and the default user community are not the same`
          );
          return await messages.notAuthorized(ctx);
        }

        // We check if this dispute is from a community we validate that
        // the solver is running this command
        if (dispute && dispute.solver_id != user._id) {
          logger.debug(
            `cancelorder ${order._id}: @${user.username} is not the solver of this dispute`
          );
          return await messages.notAuthorized(ctx);
        }
      }

      if (order.hash) await cancelHoldInvoice({ hash: order.hash });

      if (dispute) {
        dispute.status = 'SELLER_REFUNDED';
        await dispute.save();
      }

      order.status = 'CANCELED_BY_ADMIN';
      order.canceled_by = user._id;
      const buyer = await User.findOne({ _id: order.buyer_id });
      const seller = await User.findOne({ _id: order.seller_id });
      await order.save();
      // we sent a private message to the admin
      await messages.successCancelOrderMessage(bot, user, order, ctx.i18n);
      // we sent a private message to the seller
      await messages.successCancelOrderByAdminMessage(ctx, bot, seller, order);
      // we sent a private message to the buyer
      await messages.successCancelOrderByAdminMessage(ctx, bot, buyer, order);
    } catch (error) {
      logger.error(error);
    }
  });

  // We allow users cancel pending orders,
  // pending orders are the ones that are not taken by another user
  bot.command('cancel', async ctx => {
    try {
      const user = await validateUser(ctx, false);
      if (!user) return;

      const [orderId] = await validateParams(ctx, 2, '\\<_order id_\\>');

      if (!orderId) return;
      if (!(await validateObjectId(ctx, orderId))) return;
      const order = await ordersActions.getOrder(ctx, user, orderId);

      if (!order) return;

      if (order.status === 'PENDING') {
        // If we already have a holdInvoice we cancel it and return the money
        if (order.hash) {
          await cancelHoldInvoice({ hash: order.hash });
        }

        order.status = 'CANCELED';
        order.canceled_by = user._id;
        await order.save();
        // we sent a private message to the user
        await messages.successCancelOrderMessage(bot, user, order, ctx.i18n);
        // We delete the messages related to that order from the channel
        return await deleteOrderFromChannel(order, bot.telegram);
      }

      if (
        !(
          order.status === 'ACTIVE' ||
          order.status === 'FIAT_SENT' ||
          order.status === 'DISPUTE'
        )
      )
        return await messages.badStatusOnCancelOrderMessage(ctx);

      // If the order is active we start a cooperative cancellation
      let counterPartyUser, initiator, counterParty;

      const initiatorUser = user;
      if (initiatorUser._id == order.buyer_id) {
        counterPartyUser = await User.findOne({ _id: order.seller_id });
        initiator = 'buyer';
        counterParty = 'seller';
      } else {
        counterPartyUser = await User.findOne({ _id: order.buyer_id });
        initiator = 'seller';
        counterParty = 'buyer';
      }

      if (order[`${initiator}_cooperativecancel`])
        return await messages.shouldWaitCooperativeCancelMessage(
          ctx,
          bot,
          initiatorUser
        );

      order[`${initiator}_cooperativecancel`] = true;

      const i18nCtxCP = i18n.createContext(counterPartyUser.lang);
      // If the counter party already requested a cooperative cancel order
      if (order[`${counterParty}_cooperativecancel`]) {
        // If we already have a holdInvoice we cancel it and return the money
        if (order.hash) await cancelHoldInvoice({ hash: order.hash });

        order.status = 'CANCELED';
        let seller = initiatorUser;
        let i18nCtxSeller = ctx.i18n;
        if (order.seller_id == counterPartyUser._id) {
          seller = counterPartyUser;
          i18nCtxSeller = i18nCtxCP;
        }
        // We sent a private message to the users
        await messages.successCancelOrderMessage(
          bot,
          initiatorUser,
          order,
          ctx.i18n
        );
        await messages.refundCooperativeCancelMessage(
          bot,
          seller,
          i18nCtxSeller
        );
        await messages.okCooperativeCancelMessage(
          bot,
          counterPartyUser,
          order,
          i18nCtxCP
        );
      } else {
        await messages.initCooperativeCancelMessage(ctx, order);
        await messages.counterPartyWantsCooperativeCancelMessage(
          bot,
          counterPartyUser,
          order,
          i18nCtxCP
        );
      }
      await order.save();
    } catch (error) {
      logger.error(error);
    }
  });

  // We allow users cancel all pending orders,
  // pending orders are the ones that are not taken by another user
  bot.command('cancelall', async ctx => {
    try {
      const user = await validateUser(ctx, false);
      if (!user) return;

      const orders = await ordersActions.getOrders(ctx, user, 'PENDING');

      if (!orders) return;

      for (const order of orders) {
        order.status = 'CANCELED';
        order.canceled_by = user._id;
        await order.save();
        // We delete the messages related to that order from the channel
        await deleteOrderFromChannel(order, bot.telegram);
      }
      // we sent a private message to the user
      await messages.successCancelAllOrdersMessage(ctx);
    } catch (error) {
      logger.error(error);
    }
  });

  bot.command('settleorder', async ctx => {
    try {
      const user = await validateAdmin(ctx);
      if (!user) return;

      const [orderId] = await validateParams(ctx, 2, '\\<_order id_\\>');

      if (!orderId) return;
      if (!(await validateObjectId(ctx, orderId))) return;

      const order = await Order.findOne({ _id: orderId });
      if (!order) return;

      // We look for a dispute for this order
      const dispute = await Dispute.findOne({ order_id: order._id });

      // We check if this is a solver, the order must be from the same community
      if (!user.admin) {
        if (!order.community_id) {
          return await messages.notAuthorized(ctx);
        }

        if (order.community_id != user.default_community_id) {
          return await messages.notAuthorized(ctx);
        }

        // We check if this dispute is from a community we validate that
        // the solver is running this command
        if (dispute && dispute.solver_id != user._id) {
          return await messages.notAuthorized(ctx);
        }
      }

      if (order.secret) await settleHoldInvoice({ secret: order.secret });

      if (dispute) {
        dispute.status = 'SETTLED';
        await dispute.save();
      }

      order.status = 'COMPLETED_BY_ADMIN';
      const buyer = await User.findOne({ _id: order.buyer_id });
      const seller = await User.findOne({ _id: order.seller_id });
      await order.save();
      // we sent a private message to the admin
      await messages.successCompleteOrderMessage(ctx, order);
      // we sent a private message to the seller
      await messages.successCompleteOrderByAdminMessage(
        ctx,
        bot,
        seller,
        order
      );
      // we sent a private message to the buyer
      await messages.successCompleteOrderByAdminMessage(ctx, bot, buyer, order);
    } catch (error) {
      logger.error(error);
    }
  });

  bot.command('checkorder', async ctx => {
    try {
      const user = await validateAdmin(ctx);
      if (!user) return;

      const [orderId] = await validateParams(ctx, 2, '\\<_order id_\\>');

      if (!orderId) return;
      if (!(await validateObjectId(ctx, orderId))) return;
      const order = await Order.findOne({ _id: orderId });

      if (!order) return;

      const buyer = await User.findOne({ _id: order.buyer_id });
      const seller = await User.findOne({ _id: order.seller_id });

      await messages.checkOrderMessage(ctx, order, buyer, seller);
    } catch (error) {
      logger.error(error);
    }
  });

  bot.command('help', async ctx => {
    try {
      const user = await validateUser(ctx, false);
      if (!user) return;

      await messages.helpMessage(ctx);
    } catch (error) {
      logger.error(error);
    }
  });

  // Only buyers can use this command
  bot.command('fiatsent', async ctx => {
    try {
      const user = await validateUser(ctx, false);

      if (!user) return;
      const [orderId] = await validateParams(ctx, 2, '\\<_order id_\\>');

      if (!orderId) return;
      if (!(await validateObjectId(ctx, orderId))) return;
      const order = await validateFiatSentOrder(ctx, bot, user, orderId);
      if (!order) return;

      order.status = 'FIAT_SENT';
      const seller = await User.findOne({ _id: order.seller_id });
      await order.save();
      // We sent messages to both parties
      // We need to create i18n context for each user
      const i18nCtxBuyer = i18n.createContext(user.lang);
      const i18nCtxSeller = i18n.createContext(seller.lang);
      await messages.fiatSentMessages(
        bot,
        user,
        seller,
        order,
        i18nCtxBuyer,
        i18nCtxSeller
      );
    } catch (error) {
      logger.error(error);
    }
  });

  bot.command('ban', async ctx => {
    try {
      const adminUser = await validateAdmin(ctx);

      if (!adminUser) return;

      let [username] = await validateParams(ctx, 2, '\\<_username_\\>');

      if (!username) return;

      username = username[0] == '@' ? username.slice(1) : username;

      const user = await User.findOne({ username });
      if (!user) {
        await messages.notFoundUserMessage(ctx);
        return;
      }

      // We check if this is a solver, we ban the user only in the default community of the solver
      if (!adminUser.admin) {
        if (adminUser.default_community_id) {
          const community = await Community.findOne({
            _id: user.default_community_id,
          });
          community.banned_users.push({
            id: user._id,
            username: user.username,
          });
          await community.save();
        } else {
          await messages.needDefaultCommunity(ctx);
          return;
        }
      } else {
        user.banned = true;
        await user.save();
      }
      await messages.userBannedMessage(ctx);
    } catch (error) {
      logger.error(error);
    }
  });

  bot.command('setaddress', async ctx => {
    try {
      const user = await validateUser(ctx, false);

      if (!user) return;

      const [lightningAddress] = await validateParams(
        ctx,
        2,
        '\\<_lightningAddress / off_\\>'
      );
      if (!lightningAddress) return;

      if (lightningAddress === 'off') {
        user.lightning_address = null;
        await user.save();
        return await messages.disableLightningAddress(ctx);
      }

      if (!(await validateLightningAddress(lightningAddress)))
        return await messages.invalidLightningAddress(ctx);

      user.lightning_address = lightningAddress;
      await user.save();
      await messages.successSetAddress(ctx);
    } catch (error) {
      logger.error(error);
    }
  });

  // Only buyers can use this command
  bot.command('setinvoice', async ctx => {
    try {
      const user = await validateUser(ctx, false);

      if (!user) return;
      const [orderId, lnInvoice] = await validateParams(
        ctx,
        3,
        '\\<_order id_\\> \\<_lightning invoice_\\>'
      );

      if (!orderId) return;
      if (!(await validateObjectId(ctx, orderId))) return;
      const invoice = await validateInvoice(ctx, lnInvoice);
      if (!invoice) return;
      const order = await Order.findOne({
        _id: orderId,
        buyer_id: user._id,
      });
      if (!order) return await messages.notActiveOrderMessage(ctx);

      if (order.status === 'SUCCESS')
        return await messages.successCompleteOrderMessage(ctx, order);

      if (invoice.tokens && invoice.tokens !== order.amount)
        return await messages.incorrectAmountInvoiceMessage(ctx);

      order.buyer_invoice = lnInvoice;
      // When a seller release funds but the buyer didn't get the invoice paid
      if (order.status === 'PAID_HOLD_INVOICE') {
        const isScheduled = await PendingPayment.findOne({
          order_id: order._id,
          attempts: { $lt: process.env.PAYMENT_ATTEMPTS },
          is_invoice_expired: false,
        });
        // We check if the payment is on flight
        const isPending = await isPendingPayment(order.buyer_invoice);

        if (!!isScheduled || !!isPending)
          return await messages.invoiceAlreadyUpdatedMessage(ctx);

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
          await messages.invoiceUpdatedPaymentWillBeSendMessage(ctx);
        } else {
          await messages.invoiceAlreadyUpdatedMessage(ctx);
        }
      } else if (order.status === 'WAITING_BUYER_INVOICE') {
        const seller = await User.findOne({ _id: order.seller_id });
        await waitPayment(ctx, bot, user, seller, order, lnInvoice);
      } else {
        await messages.invoiceUpdatedMessage(ctx);
      }

      await order.save();
    } catch (error) {
      logger.error(error);
    }
  });

  OrdersModule.configure(bot);

  bot.action('addInvoiceBtn', async ctx => {
    await addInvoice(ctx, bot);
  });

  bot.action('cancelAddInvoiceBtn', async ctx => {
    await cancelAddInvoice(ctx, bot);
  });

  bot.action('showHoldInvoiceBtn', async ctx => {
    await showHoldInvoice(ctx, bot);
  });

  bot.action('cancelShowHoldInvoiceBtn', async ctx => {
    await cancelShowHoldInvoice(ctx, bot);
  });

  bot.action(/^showStarBtn\(([1-5]),(\w{24})\)$/, async ctx => {
    await rateUser(ctx, bot, ctx.match[1], ctx.match[2]);
  });

  bot.action(/^updateCommunity_([0-9a-f]{24})$/, async ctx => {
    await updateCommunityMessage(ctx, ctx.match[1]);
  });

  bot.action(/^editNameBtn_([0-9a-f]{24})$/, async ctx => {
    await updateCommunity(ctx, ctx.match[1], 'name');
  });

  bot.action(/^editFeeBtn_([0-9a-f]{24})$/, async ctx => {
    await updateCommunity(ctx, ctx.match[1], 'fee');
  });

  bot.action(/^editCurrenciesBtn_([0-9a-f]{24})$/, async ctx => {
    await updateCommunity(ctx, ctx.match[1], 'currencies');
  });

  bot.action(/^editGroupBtn_([0-9a-f]{24})$/, async ctx => {
    await updateCommunity(ctx, ctx.match[1], 'group', bot);
  });

  bot.action(/^editChannelsBtn_([0-9a-f]{24})$/, async ctx => {
    await updateCommunity(ctx, ctx.match[1], 'channels', bot);
  });

  bot.action(/^editSolversBtn_([0-9a-f]{24})$/, async ctx => {
    await updateCommunity(ctx, ctx.match[1], 'solvers', bot);
  });

  bot.action(/^editDisputeChannelBtn_([0-9a-f]{24})$/, async ctx => {
    await updateCommunity(ctx, ctx.match[1], 'disputeChannel', bot);
  });

  bot.action(/^addInvoicePHIBtn_([0-9a-f]{24})$/, async ctx => {
    await addInvoicePHI(ctx, bot, ctx.match[1]);
  });

  bot.command('paytobuyer', async ctx => {
    try {
      const adminUser = await validateAdmin(ctx);
      if (!adminUser) return;
      const [orderId] = await validateParams(ctx, 2, '\\<_order id_\\>');
      if (!orderId) return;
      if (!(await validateObjectId(ctx, orderId))) return;
      const order = await Order.findOne({
        _id: orderId,
      });
      if (!order) return await messages.notActiveOrderMessage(ctx);

      // We make sure the buyers invoice is not being paid
      const isPending = await PendingPayment.findOne({
        order_id: order._id,
        attempts: { $lt: process.env.PAYMENT_ATTEMPTS },
      });

      if (isPending) return;

      await payToBuyer(bot, order);
    } catch (error) {
      logger.error(error);
    }
  });

  bot.command('listcurrencies', async ctx => {
    try {
      const user = await validateUser(ctx, false);

      if (!user) return;

      const currencies = getCurrenciesWithPrice();

      await messages.listCurrenciesResponse(ctx, currencies);
    } catch (error) {
      logger.error(error);
    }
  });

  bot.command('info', async ctx => {
    try {
      const user = await validateUser(ctx, false);

      if (!user) return;

      await messages.showInfoMessage(bot, user);
    } catch (error) {
      logger.error(error);
    }
  });

  bot.command('showusername', async ctx => {
    try {
      const user = await validateUser(ctx, false);

      if (!user) return;

      let [show] = await validateParams(ctx, 2, '_yes/no_');
      if (!show) return;
      show = show === 'yes';
      user.show_username = show;
      await user.save();
      messages.updateUserSettingsMessage(ctx, 'showusername', show);
    } catch (error) {
      logger.error(error);
    }
  });

  bot.command('showvolume', async ctx => {
    try {
      const user = await validateUser(ctx, false);

      if (!user) return;

      let [show] = await validateParams(ctx, 2, '_yes/no_');
      if (!show) return;
      show = show === 'yes';
      user.show_volume_traded = show;
      await user.save();
      messages.updateUserSettingsMessage(ctx, 'showvolume', show);
    } catch (error) {
      logger.error(error);
    }
  });

  bot.command('exit', async ctx => {
    try {
      if (ctx.message.chat.type !== 'private') return;

      const user = await validateUser(ctx, false);

      if (!user) return;

      await ctx.reply(ctx.i18n.t('not_wizard'));
    } catch (error) {
      logger.error(error);
    }
  });

  bot.on('text', async ctx => {
    try {
      if (ctx.message.chat.type !== 'private') return;

      const user = await validateUser(ctx, false);

      if (!user) return;
      const text = ctx.message.text;
      let message;
      // If the user is trying to enter a command with first letter uppercase
      if (text[0] === '/' && text[1] === text[1].toUpperCase()) {
        message = ctx.i18n.t('no_capital_letters');
      } else {
        message = ctx.i18n.t('unknown_command');
      }
      ctx.reply(message);
    } catch (error) {
      logger.error(error);
    }
  });

  return bot;
};

const start = (botToken, options) => {
  const bot = initialize(botToken, options);

  bot.launch();

  logger.notice('Bot launched.');

  // Enable graceful stop
  process.once('SIGINT', () => bot.stop('SIGINT'));
  process.once('SIGTERM', () => bot.stop('SIGTERM'));

  return bot;
};

module.exports = { initialize, start };
