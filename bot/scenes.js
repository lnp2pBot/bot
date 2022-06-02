const { Scenes } = require('telegraf');
const { isValidInvoice } = require('./validations');
const { Order, PendingPayment } = require('../models');
const { waitPayment, addInvoice, showHoldInvoice } = require('./commands');
const { getCurrency, getUserI18nContext } = require('../util');
const messages = require('./messages');
const { isPendingPayment } = require('../ln');
const logger = require('../logger');

const addInvoiceWizard = new Scenes.WizardScene(
  'ADD_INVOICE_WIZARD_SCENE_ID',
  async ctx => {
    try {
      const { order } = ctx.wizard.state;
      const expirationTime =
        parseInt(process.env.HOLD_INVOICE_EXPIRATION_WINDOW) / 60;
      const currency = getCurrency(order.fiat_code);
      const symbol =
        !!currency && !!currency.symbol_native
          ? currency.symbol_native
          : order.fiat_code;
      await messages.wizardAddInvoiceInitMessage(
        ctx,
        order,
        symbol,
        expirationTime
      );

      order.status = 'WAITING_BUYER_INVOICE';
      await order.save();
      return ctx.wizard.next();
    } catch (error) {
      logger.error(error);
    }
  },
  async ctx => {
    try {
      if (ctx.message === undefined) return ctx.scene.leave();
      const lnInvoice = ctx.message.text.trim();
      let { bot, buyer, seller, order } = ctx.wizard.state;
      // We get an updated order from the DB
      order = await Order.findOne({ _id: order._id });
      if (!order) {
        await ctx.reply(ctx.i18n.t('generic_error'));
        return ctx.scene.leave();
      }

      const res = await isValidInvoice(ctx, lnInvoice);
      if (!res.success) {
        return;
      }

      if (order.status === 'EXPIRED') {
        await messages.orderExpiredMessage(ctx);
        return ctx.scene.leave();
      }

      if (order.status !== 'WAITING_BUYER_INVOICE') {
        await messages.cantAddInvoiceMessage(ctx);
        return ctx.scene.leave();
      }

      if (res.invoice.tokens && res.invoice.tokens !== order.amount)
        return await messages.incorrectAmountInvoiceMessage(ctx);

      await waitPayment(ctx, bot, buyer, seller, order, lnInvoice);

      return ctx.scene.leave();
    } catch (error) {
      logger.error(error);
      ctx.scene.leave();
    }
  }
);

const addInvoicePHIWizard = new Scenes.WizardScene(
  'ADD_INVOICE_PHI_WIZARD_SCENE_ID',
  async ctx => {
    try {
      const { buyer, order } = ctx.wizard.state;
      const i18nCtx = await getUserI18nContext(buyer);
      await messages.sendMeAnInvoiceMessage(ctx, order.amount, i18nCtx);

      return ctx.wizard.next();
    } catch (error) {
      logger.error(error);
    }
  },
  async ctx => {
    try {
      if (ctx.message === undefined) return ctx.scene.leave();
      const lnInvoice = ctx.message.text.trim();
      let { buyer, order } = ctx.wizard.state;
      // We get an updated order from the DB
      order = await Order.findOne({ _id: order._id });
      if (!order) {
        await ctx.reply(ctx.i18n.t('generic_error'));
        return ctx.scene.leave();
      }

      const res = await isValidInvoice(ctx, lnInvoice);
      if (!res.success) {
        return;
      }

      if (!!res.invoice.tokens && res.invoice.tokens !== order.amount)
        return await messages.incorrectAmountInvoiceMessage(ctx);

      const isScheduled = await PendingPayment.findOne({
        order_id: order._id,
        attempts: { $lt: process.env.PAYMENT_ATTEMPTS },
        is_invoice_expired: false,
      });
      // We check if the payment is on flight
      const isPending = await isPendingPayment(order.buyer_invoice);

      if (!!isScheduled || !!isPending)
        return await messages.invoiceAlreadyUpdatedMessage(ctx);

      // if the payment is not on flight, we create a pending payment
      if (!order.paid_hold_buyer_invoice_updated) {
        logger.debug(`Creating pending payment for order ${order._id}`);
        order.paid_hold_buyer_invoice_updated = true;
        const pp = new PendingPayment({
          amount: order.amount,
          payment_request: lnInvoice,
          user_id: buyer._id,
          description: order.description,
          hash: order.hash,
          order_id: order._id,
        });
        await order.save();
        await pp.save();
        await messages.invoiceUpdatedPaymentWillBeSendMessage(ctx);
      } else {
        await messages.invoiceAlreadyUpdatedMessage(ctx);
      }

      return ctx.scene.leave();
    } catch (error) {
      logger.error(error);
      ctx.scene.leave();
    }
  }
);

const addFiatAmountWizard = new Scenes.WizardScene(
  'ADD_FIAT_AMOUNT_WIZARD_SCENE_ID',
  async ctx => {
    try {
      const { order } = ctx.wizard.state;
      const currency = getCurrency(order.fiat_code);
      const action =
        order.type === 'buy' ? ctx.i18n.t('receive') : ctx.i18n.t('send');
      const currencyName =
        !!currency && !!currency.name_plural
          ? currency.name_plural
          : order.fiat_code;
      await messages.wizardAddFiatAmountMessage(
        ctx,
        currencyName,
        action,
        order
      );

      return ctx.wizard.next();
    } catch (error) {
      logger.error(error);
    }
  },
  async ctx => {
    try {
      const { bot, order } = ctx.wizard.state;

      if (ctx.message === undefined) return ctx.scene.leave();

      const fiatAmount = parseInt(ctx.message.text.trim());
      if (!Number.isInteger(fiatAmount)) {
        await messages.wizardAddFiatAmountWrongAmountMessage(ctx, order);
        return;
      }

      if (fiatAmount < order.min_amount || fiatAmount > order.max_amount) {
        await messages.wizardAddFiatAmountWrongAmountMessage(ctx, order);
        return;
      }

      order.fiat_amount = fiatAmount;
      const currency = getCurrency(order.fiat_code);
      await messages.wizardAddFiatAmountCorrectMessage(
        ctx,
        currency,
        fiatAmount
      );

      if (order.type === 'sell') {
        await addInvoice(ctx, bot, order);
      } else {
        await showHoldInvoice(ctx, bot, order);
      }

      return ctx.scene.leave();
    } catch (error) {
      logger.error(error);
    }
  }
);

module.exports = {
  addInvoiceWizard,
  addFiatAmountWizard,
  addInvoicePHIWizard,
};
