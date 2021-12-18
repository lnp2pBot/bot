const { Scenes } = require('telegraf');
const { isValidInvoice } = require('./validations');
const messages = require('./messages');
const { Order } = require('../models');
const { createHoldInvoice, subscribeInvoice } = require('../ln');

const addInvoiceWizard = new Scenes.WizardScene(
  'ADD_INVOICE_WIZARD_SCENE_ID',
  async (ctx) => {
    try {
      const { bot, buyer, order } = ctx.wizard.state;
      const expirationTime = parseInt(process.env.HOLD_INVOICE_EXPIRATION_WINDOW) / 60;
      await bot.telegram.sendMessage(buyer.tg_id, `Para poder enviarte los satoshis necesito que me envíes una factura con monto ${order.amount} satoshis`);
      await bot.telegram.sendMessage(buyer.tg_id, `Si no la envías en ${expirationTime} minutos la orden será cancelada`);
      order.status = 'WAITING_BUYER_INVOICE';
      await order.save();
      return ctx.wizard.next();
    } catch (error) {
      console.log(error);
      return ctx.reply('Ha ocurrido un error, por favor contacta al administrador');
    }
  },
  async (ctx) => {
    try {
      if (ctx.message === undefined) {
        return ctx.scene.leave();
      }
      const lnInvoice = ctx.message.text;
      if (lnInvoice == 'exit') {
        await ctx.reply('Has salido del modo wizard, ahora puedes escribir comandos, si aún necesitas ingresar una invoice a la orden utiliza el comando /setinvoice');
        return ctx.scene.leave();
      }
      const res = await isValidInvoice(lnInvoice);
      if (!res.success) {
        await ctx.reply(res.error);
        return;
      };
      let { bot, buyer, seller, order } = ctx.wizard.state;
      // We get an updated order from the DB
      order = await Order.findOne({ _id: order._id });
      if (order.status == 'EXPIRED') {
        await ctx.reply(`¡Esta orden ya expiró!`);
        return ctx.scene.leave();
      }

      if (order.status != 'WAITING_BUYER_INVOICE') {
        await ctx.reply(`¡Ya no puedes agregar una factura para esta orden!`);
        return ctx.scene.leave();
      }

      if (res.invoice.tokens && res.invoice.tokens != order.amount) {
        await ctx.reply('La factura tiene un monto incorrecto');
        return;
      }
      order.buyer_invoice = lnInvoice;
      // If the buyer is the creator, at this moment the seller already paid the hold invoice
      if (order.creator_id == order.buyer_id) {
        order.status = 'ACTIVE';
        // Message to buyer
        await messages.addInvoiceMessage(bot, buyer, seller, order);
        // Message to seller
        await messages.sendBuyerInfo2SellerMessage(bot, buyer, seller, order);
      } else {
        // We create a hold invoice
        const description = `Venta por @${ctx.botInfo.username} #${order._id}`;
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
        await messages.invoicePaymentRequestMessage(bot, seller, request, order);
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