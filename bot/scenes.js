const { Scenes } = require('telegraf');
const { isValidInvoice } = require('./validations');
const { getCurrency } = require('../util');
const messages = require('./messages');
const { createHoldInvoice, subscribeInvoice } = require('../ln');

const addInvoiceWizard = new Scenes.WizardScene(
  'ADD_INVOICE_WIZARD_SCENE_ID',
  async (ctx) => {
    const { bot, buyer, order } = ctx.wizard.state;
    const expirationTime = parseInt(process.env.HOLD_INVOICE_EXPIRATION_WINDOW) / 60;
    await bot.telegram.sendMessage(buyer.tg_id, `Para poder enviarte los satoshis necesito que me envíes una factura con monto ${order.amount} satoshis`);
    await bot.telegram.sendMessage(buyer.tg_id, `Si no la envías en ${expirationTime} minutos la orden será cancelada`);
    order.status = 'WAITING_BUYER_INVOICE';
    await order.save();
    return ctx.wizard.next();
  },
  async (ctx) => {
    try {
      const lnInvoice = ctx.message.text;
      if (lnInvoice == 'exit') {
        ctx.reply('Has salido del modo wizard, ahora puedes escribir comandos, si aún necesitas ingresar una invoice a la orden utiliza el comando /setinvoice');
        return ctx.scene.leave();
      }
      const res = await isValidInvoice(lnInvoice);
      if (!res.success) {
        ctx.reply(res.error);
        return;
      };
      const { bot, buyer, seller, order } = ctx.wizard.state;
  
      if (res.invoice.tokens && res.invoice.tokens != order.amount) {
        ctx.reply('La factura tiene un monto incorrecto');
        return;
      }
      order.buyer_invoice = lnInvoice;
      // If the buyer is the creator, at this moment the seller already paid the hold invoice
      if (order.creator_id == order.buyer_id) {
        order.status = 'ACTIVE';
        const currency = getCurrency(order.fiat_code);
        await bot.telegram.sendMessage(buyer.tg_id, `🤖 He recibido tu factura, ponte en contacto con @${seller.username} para que te indique como enviarle ${currency.symbol_native} ${order.fiat_amount}`);
        await bot.telegram.sendMessage(buyer.tg_id, `En cuanto hayas enviado el dinero fiat hazmelo saber con el comando 👇`);
        await bot.telegram.sendMessage(buyer.tg_id, `/fiatsent ${order._id}`);
      } else {
        // We create a hold invoice
        const description = `Venta por @${ctx.botInfo.username}`;
        const amount = Math.floor(order.amount + order.fee);
        const { request, hash, secret } = await createHoldInvoice({
          amount,
          description,
        });
        order.hash = hash;
        order.secret = secret;
        order.taken_at = Date.now();
        order.status = 'WAITING_PAYMENT';
        // We monitor the invoice to know when the seller makes the payment
        await subscribeInvoice(bot, hash);
        // We send the hold invoice to the seller
        await messages.invoicePaymentRequestMessage(bot, seller, request);
        await messages.takeSellWaitingSellerToPayMessage(bot, buyer, order);
      }
      await order.save();
      return ctx.scene.leave();
    } catch (error) {
      console.log(error);
    }
  },
);

module.exports = addInvoiceWizard;