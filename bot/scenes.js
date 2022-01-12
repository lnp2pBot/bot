const { Scenes } = require('telegraf');
const { isValidInvoice } = require('./validations');
const messages = require('./messages');
const { Order } = require('../models');
const { waitPayment, saveUserReview } = require("./commands")


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
      await waitPayment(bot, buyer, seller, order,lnInvoice)

      return ctx.scene.leave();
    } catch (error) {
      console.log(error);
    }
  },
);

const addUserReviewWizard = new Scenes.WizardScene(
  'ADD_USER_REVIEW_WIZARD_SCENE_ID',
  async (ctx) => {
    try {
      const { bot, callerId } = ctx.wizard.state;
      const message = await bot.telegram.sendMessage(callerId,
        'Tienes 140 caracteres extras para ponderar a tu contraparte:'
      );
      ctx.scene.session.prev_message_id = [message.message_id];
      return ctx.wizard.next()
    } catch (error) {
      console.log(error)
      return ctx.reply('Ha ocurrido un error, por favor contacta al administrador');
    }
  },
  async (ctx) => {
    try {
      const { targetUser, rating } = ctx.wizard.state;
      let response = {
        rating: rating,
      };

      if (ctx.message === undefined) {
        return ctx.scene.leave();
      }

      const comment = ctx.message.text;
      if (comment.length > 140) {
        ctx.deleteMessage()
        const warning = await ctx.reply(
          'Por favor, mantenga su comentario dentro de la cantidad de caracteres solicitada. Puede editarlo a continuación:'
        );
        const commentTooLong = await ctx.reply(`${comment}`);
        ctx.scene.session.prev_message_id.push(warning.message_id, commentTooLong.message_id);
        return;
      }

      if (comment == 'exit') {
        const exitMessage = await ctx.reply(
          'Saliendo del modo wizard, ahora podras escribir comandos.\nSolo sera guardado el puntaje ingresado.'
        );
        ctx.scene.session.prev_message_id.push(exitMessage.message_id);
      } else {
        response.review = comment;
      }

      await saveUserReview(targetUser, response);
  
      ctx.deleteMessage();

      const sceneMessages = ctx.scene.session.prev_message_id;
      if (Array.isArray(sceneMessages) && sceneMessages.length > 0) {
        sceneMessages.forEach((message) => ctx.deleteMessage(message));
      }

      return ctx.scene.leave();
    } catch (error) {
      console.log(error);
    }
  },
);

module.exports = {
  addInvoiceWizard,
  addUserReviewWizard,
};