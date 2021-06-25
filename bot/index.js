const { Telegraf } = require('telegraf');
const { parsePaymentRequest } = require('invoices');
const { Order, User } = require('../models');
const { getUser, createOrder } = require('./actions');
const { settleHoldInvoice, createHoldInvoice, subscribeInvoice } = require('../ln');

const start = () => {
  const bot = new Telegraf(process.env.BOT_TOKEN)
  bot.start(async (ctx) => {
    ctx.reply(`Este bot te ayudará a completar tus intercambios P2P usando Bitcoin vía Lightning Network.\n\n
    Es fácil:\n\n
    1. Únete al grupo @satoshienvenezuela.\n
    2. Publica tu oferta de compra o venta en el grupo, usando SIEMPRE el hashtag #P2PLN.\n
    3. Tu oferta o calificación estará visible en el canal @SEVLIGHTNING.\n\n
    ¡Intercambia seguro y rápido!\n\n
    Support: @franklinzerocr`);
  });

  bot.command('sell', async (ctx) => {
    const params = ctx.update.message.text.split(' ');
    if (params.length !== 5) {
      ctx.reply(`/sell <monto_en_sats> <monto_en_fiat> <codigo_fiat> <método_de_pago>`);
      return;
    }
    const [_, amount, fiatAmount, fiatCode, paymentMethod] = params;
    const user = await getUser(ctx.update.message.from);
    const { request, order } = await createOrder({
      type: 'sell',
      amount,
      seller: user,
      fiatAmount,
      fiatCode,
      paymentMethod,
    });

    ctx.reply(`Por favor paga esta invoice para comenzar la venta:\n\n ${request}`);
  });

  bot.command('buy', async (ctx) => {
    const params = ctx.update.message.text.split(' ');
    if (params.length !== 6) {
      ctx.reply(`/buy <monto_en_sats> <monto_en_fiat> <codigo_fiat> <método_de_pago> <lightning_invoice>`);
      return;
    }
    const [_, amount, fiatAmount, fiatCode, paymentMethod, lnInvoice] = params;
    // validamos la invoice
    const invoice = parsePaymentRequest({ request: lnInvoice });
    const latestDate = new Date(Date.now() + parseInt(process.env.INVOICE_EXPIRATION_WINDOW)).toISOString();
    if (invoice.tokens < 100) {
      ctx.reply(`La invoice debe ser mayor o igual a 100 satoshis`);
      return;
    }
    if (invoice.tokens != amount) {
      ctx.reply(`La invoice tener un monto igual a ${amount} satoshis`);
      return;
    }
    if (invoice.expires_at < latestDate) {
      ctx.reply(`El tiempo de expiración de la invoice debe ser de al menos 1 hora`);
      return;
    }
    if (invoice.is_expired !== false) {
      ctx.reply(`La invoice ha expirado`);
      return;
    }
    if (!invoice.destination) {
      ctx.reply(`La invoice necesita una dirección destino`);
      return;
    }
    if (!invoice.id) {
      ctx.reply(`La invoice necesita un hash`);
      return;
    }
    const user = await getUser(ctx.update.message.from);
    const { order } = await createOrder({
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
      // envio un mensaje al canal del bot con el trade
      const messageToBotChannel = `${order.description}
Si quieres tomar esta oferta escríbele en privado al bot

/takebuy ${order._id}

#P2PLN ⚡️🍊⚡️`;
      // NOTA: esto tiene que enviarlo al canal del bot para que otra gente
      // pueda tomar esta orden
      ctx.reply(messageToBotChannel);
    }
  });

  bot.command('takesell', async (ctx) => {
    const params = ctx.update.message.text.split(' ');
    if (params.length !== 3) {
      ctx.reply(`/takesell <order_id> <lightning_invoice>`);
      return;
    }
    const [_, orderId, lnInvoice] = params;
    try {
      // validamos la invoice
      const invoice = parsePaymentRequest({ request: lnInvoice });
      const latestDate = new Date(Date.now() + parseInt(process.env.INVOICE_EXPIRATION_WINDOW)).toISOString();
      const user = await getUser(ctx.update.message.from);
      const order = await Order.findOne({ _id: orderId });
      if (invoice.tokens !== order.amount) {
        ctx.reply(`La invoice debe ser tener un monto de ${order.amount}`);
        return;
      }
      if (invoice.expires_at < latestDate) {
        ctx.reply(`El tiempo de expiración de la invoice debe ser de 1 hora`);
        return;
      }
      if (invoice.is_expired !== false) {
        ctx.reply(`La invoice ha expirado`);
        return;
      }
      if (!invoice.destination) {
        ctx.reply(`La invoice necesita una dirección destino`);
        return;
      }
      if (!invoice.id) {
        ctx.reply(`La invoice necesita un hash`);
        return;
      }
      if (!order) {
        ctx.reply(`Código de orden incorrecto`);
        return;
      }
      if (order.type === 'buy') {
        ctx.reply(`Esta orden no es una venta`);
        return;
      }

      if (order.status !== 'PENDING') {
        ctx.reply(`Esta orden ya ha sido tomada por otro usuario`);
        return;
      }

      order.status = 'ACTIVE';
      order.buyerId = user._id;
      order.buyerInvoice = lnInvoice;
      await order.save();
      const orderUser = await User.findOne({ _id: order.creatorId });

      ctx.reply(`Ponte en contacto con el usuario @${orderUser.username} para
que te de detalle de como enviarle el dinero fiat.

Cuando @${orderUser.username} confirme que recibió el dinero estaré pagando tu invoice`);
    } catch (e) {
      console.log(e);
      ctx.reply(`Haz enviado datos incorrectos, inténtalo nuevamente.`);
    }
  });

  bot.command('takebuy', async (ctx) => {
    const params = ctx.update.message.text.split(' ');
    if (params.length !== 2) {
      ctx.reply(`/takebuy <order_id>`);
      return;
    }
    const [_, orderId] = params;
    try {
      const user = await getUser(ctx.update.message.from);
      const order = await Order.findOne({ _id: orderId });
      if (!order) {
        ctx.reply(`Código de orden incorrecto`);
        return;
      }
      if (order.type === 'sell') {
        ctx.reply(`Esta orden no es una compra`);
        return;
      }

      if (order.status !== 'PENDING') {
        ctx.reply(`Esta orden ya ha sido tomada por otro usuario`);
        return;
      }
      const invoiceDescription = `Venta por @P2PLNBot`;
      const {
        request,
        hash,
        secret,
      } = await createHoldInvoice({
        amount: order.amount + (order.amount * process.env.FEE),
        description: invoiceDescription,
      });
      order.hash = hash;
      order.secret = secret;
      order.status = 'ACTIVE';
      order.sellerId = user._id;
      await order.save();
      // monitoreamos esa invoice para saber cuando el usuario realice el pago
      await subscribeInvoice(hash);
      const orderUser = await User.findOne({ _id: order.creatorId });
      ctx.reply(`Por favor paga esta invoice para comenzar la venta:\n\n ${request}`);
    } catch (e) {
      console.log(e);
      ctx.reply(`Haz enviado datos incorrectos, inténtalo nuevamente.`);
    }
  });

  bot.command('release', async (ctx) => {
    const params = ctx.update.message.text.split(' ');
    if (params.length > 2) {
      ctx.reply(`/release [order_id]>`);
      return;
    }
    const [_, orderId] = params;
    const user = await getUser(ctx.update.message.from);
    const where = {
      sellerId: user._id,
      status: 'ACTIVE',
    };
    if (!!orderId) {
      where._id = orderId;
    }
    const order = await Order.findOne(where);
    if (!order) {
      ctx.reply(`No tienes orden activa`);
      return;
    }
    await settleHoldInvoice({ secret: order.secret });
  });
  bot.launch();

  // Enable graceful stop
  process.once('SIGINT', () => bot.stop('SIGINT'));
  process.once('SIGTERM', () => bot.stop('SIGTERM'));
}

module.exports = start;
