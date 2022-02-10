const { Scenes } = require('telegraf');
const { isValidInvoice } = require('./validations');
const { Order } = require('../models');
const { waitPayment, addInvoice, showHoldInvoice } = require("./commands")
const { getCurrency } = require('../util');


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
      await waitPayment(ctx, bot, buyer, seller, order, lnInvoice)

      return ctx.scene.leave();
    } catch (error) {
      console.log(error);
    }
  },
);

const addFiatAmountWizard = new Scenes.WizardScene(
  'ADD_FIAT_AMOUNT_WIZARD_SCENE_ID',
  async (ctx) => {
    try {
      const { bot, order, caller } = ctx.wizard.state;
      const action = order.type == 'buy' ? `vender` : `comprar`;
      const currency = getCurrency(order.fiat_code);
      const symbol = (!!currency && !!currency.symbol_native) ? currency.symbol_native : order.fiat_code;
      let message = `Ingrese la cantidad de ${symbol} que desea ${action}.\n`;
      message += `Recuerde que debe estar entre ${order.min_amount} y ${order.max_amount}:`
      await bot.telegram.sendMessage(caller.tg_id, message);
      return ctx.wizard.next()
    } catch (error) {
      console.log(error);
      return ctx.reply('Ha ocurrido un error, por favor contacta al administrador');
    }
  },
  async (ctx) => {
    try {
      const { bot, order } = ctx.wizard.state;
      const warningMessage = `Ingrese una número entre ${order.min_amount} y ${order.max_amount}`;

      if (ctx.message === undefined) {
        return ctx.scene.leave();
      }

      const fiatAmount = parseInt(ctx.message.text);
      if (!Number.isInteger(fiatAmount)) {
        await ctx.reply(warningMessage);
        return;
      }

      if (fiatAmount < order.min_amount || fiatAmount > order.max_amount) {
        await ctx.reply(warningMessage);
        return;
      }

      order.fiat_amount = fiatAmount;

      const currency = getCurrency(order.fiat_code);

      ctx.reply(`Cantidad elegida: ${currency.symbol_native} ${fiatAmount} .`)
      
      if (order.type == 'sell') {
        await addInvoice(ctx, bot, order);
      } else {
        await showHoldInvoice(ctx, bot, order);
      }

      return ctx.scene.leave();
    } catch (error) {
      console.log(error);
    }
  }
)

module.exports = {
  addInvoiceWizard,
  addFiatAmountWizard,
};
