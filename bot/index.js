const { Telegraf } = require('telegraf');
const { Order, User } = require('../models');
const { createOrder } = require('./createOrders');
const { settleHoldInvoice, createHoldInvoice, subscribeInvoice } = require('../ln');
const { validateSellOrder, validateUser, validateBuyOrder, validateTakeSell, validateBuyInvoice, validateTakeBuyOrder, validateReleaseOrder, validateTakeBuy, validateTakeSellOrder, validateRelease } = require('./validations');
const messages = require('./messages');

const start = () => {
  const bot = new Telegraf(process.env.BOT_TOKEN);

  bot.start(async (ctx) => {
    messages.startMessage(ctx);
    await validateUser(ctx, true);
  });

  bot.command('sell', async (ctx) => {
    const user = await validateUser(ctx, false);
    if (!user) return;

    const sellOrderParams = await validateSellOrder(ctx, bot, user);

    if (!sellOrderParams) {
      await messages.invalidDataMessage(bot, user);

      return;
    };

    const [_, amount, fiatAmount, fiatCode, paymentMethod] = sellOrderParams;

    const { request, order } = await createOrder(ctx, bot, {
      type: 'sell',
      amount,
      seller: user,
      fiatAmount,
      fiatCode,
      paymentMethod,
    });

    if (!!order) await messages.invoicePaymentRequestMessage(bot, user, request);
  });

  bot.command('buy', async (ctx) => {
    const user = await validateUser(ctx, false);
    if (!user) return;

    const buyOrderParams = await validateBuyOrder(ctx, bot, user);

    if (!buyOrderParams) {
      await messages.invalidDataMessage(bot, user);

      return;
    };

    const [_, amount, fiatAmount, fiatCode, paymentMethod, lnInvoice] = buyOrderParams;

    const { order } = await createOrder(ctx, bot, {
      type: 'buy',
      amount,
      buyer: user,
      fiatAmount,
      fiatCode,
      paymentMethod,
      buyer_invoice: lnInvoice || '',
      status: 'PENDING',
    });

    if (!!order) {
      await messages.publishBuyOrderMessage(ctx, bot, order);
      await messages.pendingBuyMessage(bot, user);
    }
  });

  bot.command('takesell', async (ctx) => {
    const user = await validateUser(ctx, false);
    if (!user) return;

    const takeSellParams = await validateTakeSell(ctx, bot, user);
    if (!takeSellParams) return;

    const [_, orderId, lnInvoice] = takeSellParams;

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
  });

  bot.command('takebuy', async (ctx) => {
    const user = await validateUser(ctx, false);
    if (!user) return;

    const takeBuyParams = await validateTakeBuy(ctx, bot, user);
    if (!takeBuyParams) return;

    const [_, orderId] = takeBuyParams;
    try {
      const order = await Order.findOne({ _id: orderId });
      if (!(await validateTakeBuyOrder(bot, user, order))) return;

      const invoiceDescription = `Venta por @P2PLNBot`;
      const { request, hash, secret } = await createHoldInvoice({
        description: invoiceDescription,
        amount: order.amount + order.amount * parseFloat(process.env.FEE),
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
    } catch (e) {
      console.log(e);
      await messages.invalidDataMessage(bot, user);
    }
  });

  bot.command('release', async (ctx) => {
    const user = await validateUser(ctx, false);
    if (!user) return;

    const releaseParams = await validateRelease(ctx, bot, user);
    if (!releaseParams) return;

    const [_, orderId] = releaseParams;

    const order = await validateReleaseOrder(bot, user, orderId);
    if (!order) return;

    await settleHoldInvoice({ secret: order.secret });
  });

  bot.launch();

  // Enable graceful stop
  process.once('SIGINT', () => bot.stop('SIGINT'));
  process.once('SIGTERM', () => bot.stop('SIGTERM'));
};

module.exports = start;
