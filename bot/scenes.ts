import { Scenes } from 'telegraf';
// @ts-ignore
import { parsePaymentRequest } from 'invoices';
import { isValidInvoice, validateLightningAddress } from './validations';
import { Order, PendingPayment, User } from '../models';
import { waitPayment, addInvoice, showHoldInvoice } from './commands';
import { getCurrency, getUserI18nContext } from '../util';
import * as messages from './messages';
import { getPaymentStatus } from '../ln';
import { completeOrderAsSuccess } from '../jobs/pending_payments';
import { logger } from '../logger';
import { resolvLightningAddress } from '../lnurl/lnurl-pay';
import { CommunityContext } from './modules/community/communityContext';

interface InvoiceParseResult {
  invoice?: any;
  success?: boolean;
}

const addInvoiceWizard = new Scenes.WizardScene(
  'ADD_INVOICE_WIZARD_SCENE_ID',
  async ctx => {
    try {
      const communityCtx = ctx as CommunityContext;
      const { order } = communityCtx.wizard.state;
      const holdInvoiceExpirationWindow =
        process.env.HOLD_INVOICE_EXPIRATION_WINDOW;
      if (holdInvoiceExpirationWindow === undefined)
        throw new Error(
          'Enviroment variable HOLD_INVOICE_EXPIRATION_WINDOW not defined',
        );
      const expirationTime = parseInt(holdInvoiceExpirationWindow) / 60;
      await messages.wizardAddInvoiceInitMessage(
        communityCtx,
        order,
        order.fiat_code,
        expirationTime,
      );
      order.status = 'WAITING_BUYER_INVOICE';
      await order.save();

      return ctx.wizard.next();
    } catch (error) {
      logger.error(error);
    }
  },
  async (ctx: CommunityContext) => {
    try {
      if (ctx.message === undefined) return ctx.scene.leave();
      if ((ctx.message as any).document)
        return await ctx.reply(ctx.i18n.t('must_enter_text'));

      let { bot, buyer, seller, order } = ctx.wizard.state;
      // We get an updated order from the DB
      const updatedOrder = await Order.findOne({ _id: order._id });
      if (updatedOrder === null) {
        await ctx.reply(ctx.i18n.t('generic_error'));
        return ctx.scene.leave();
      } else {
        order = updatedOrder;
      }

      let lnInvoice = ctx.message.text.trim();
      const isValidLN = await validateLightningAddress(lnInvoice);
      // Temporary mitigation: Lightning Address payouts are disabled.
      // The buyer can still receive sats by pasting a regular BOLT11 invoice.
      if (isValidLN && process.env.DISABLE_LN_ADDRESS === 'true') {
        await ctx.reply(ctx.i18n.t('ln_address_temporarily_disabled'));
        return;
      }
      let res: InvoiceParseResult = {};
      if (isValidLN) {
        const laRes = await resolvLightningAddress(
          lnInvoice,
          order.amount * 1000,
        );
        if (!laRes || !laRes.pr) {
          await ctx.reply(
            ctx.i18n.t('unavailable_lightning_address', { la: lnInvoice }),
          );
          return;
        }
        lnInvoice = laRes.pr;
        res.invoice = parsePaymentRequest({ request: lnInvoice });
      } else {
        res = await isValidInvoice(ctx, lnInvoice);
        if (!res.success) return;
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
  },
);

const addInvoicePHIWizard = new Scenes.WizardScene(
  'ADD_INVOICE_PHI_WIZARD_SCENE_ID',
  async (ctx: CommunityContext) => {
    try {
      const { buyer, order } = ctx.wizard.state;
      const i18nCtx = await getUserI18nContext(buyer);
      await messages.sendMeAnInvoiceMessage(ctx, order.amount, i18nCtx);

      return ctx.wizard.next();
    } catch (error) {
      logger.error(error);
    }
  },
  async (ctx: CommunityContext) => {
    try {
      if (ctx.message === undefined) return ctx.scene.leave();
      if ((ctx.message as any).document)
        return await ctx.reply(ctx.i18n.t('must_enter_text'));

      let { buyer, order } = ctx.wizard.state;
      const bot = ctx.wizard.bot;
      // We get an updated order from the DB
      const updatedOrder = await Order.findOne({ _id: order._id });
      if (updatedOrder === null) {
        await ctx.reply(ctx.i18n.t('generic_error'));
        return ctx.scene.leave();
      } else {
        order = updatedOrder;
      }

      let lnInvoice = ctx.message.text.trim();
      const isValidLN = await validateLightningAddress(lnInvoice);
      // Temporary mitigation: Lightning Address payouts are disabled.
      // The buyer can still receive sats by pasting a regular BOLT11 invoice.
      if (isValidLN && process.env.DISABLE_LN_ADDRESS === 'true') {
        await ctx.reply(ctx.i18n.t('ln_address_temporarily_disabled'));
        return;
      }
      let res: InvoiceParseResult = {};
      if (isValidLN) {
        const laRes = await resolvLightningAddress(
          lnInvoice,
          order.amount * 1000,
        );
        if (!laRes || !laRes.pr) {
          await ctx.reply(
            ctx.i18n.t('unavailable_lightning_address', { la: lnInvoice }),
          );
          return;
        }
        lnInvoice = laRes.pr;
        res.invoice = parsePaymentRequest({ request: lnInvoice });
      } else {
        res = await isValidInvoice(ctx, lnInvoice);
        if (!res.success) return;
      }

      if (!!res.invoice.tokens && res.invoice.tokens !== order.amount)
        return await messages.incorrectAmountInvoiceMessage(ctx);

      // If the original invoice was already paid (e.g. bot restarted mid-payment
      // while a hold invoice was ACCEPTED), heal the order and reject the update.
      // Without this check an attacker can settle the hold invoice after restart
      // and then claim a second payment via /setinvoice.
      // We fetch the status once and reuse it for the in-flight check below.
      const originalStatus = order.buyer_invoice
        ? await getPaymentStatus(order.buyer_invoice)
        : undefined;
      if (originalStatus?.is_confirmed) {
        const i18nCtx = await getUserI18nContext(buyer);
        const sellerUser = await User.findOne({ _id: order.seller_id });
        if (originalStatus.payment && sellerUser !== null) {
          // Shared, idempotent success routine: if the pending-payments job
          // already closed this order the compare-and-set inside makes this a
          // no-op so the buyer is not notified twice.
          await completeOrderAsSuccess(
            bot,
            order,
            originalStatus.payment,
            buyer,
            sellerUser,
            i18nCtx,
          );
        } else {
          order.status = 'SUCCESS';
          await order.save();
          await messages.invoiceAlreadyUpdatedMessage(ctx);
        }
        return ctx.scene.leave();
      }

      const isScheduled = await PendingPayment.findOne({
        order_id: order._id,
        attempts: { $lt: process.env.PAYMENT_ATTEMPTS },
        is_invoice_expired: false,
      });
      // Block update if payment is already in-flight (confirmed is handled above)
      if (!!isScheduled || !!originalStatus?.is_pending)
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
  },
);

const addFiatAmountWizard = new Scenes.WizardScene(
  'ADD_FIAT_AMOUNT_WIZARD_SCENE_ID',
  async (ctx: CommunityContext) => {
    try {
      const { order } = ctx.wizard.state;
      const action =
        order.type === 'buy' ? ctx.i18n.t('receive') : ctx.i18n.t('send');
      await messages.wizardAddFiatAmountMessage(
        ctx,
        order.fiat_code,
        action,
        order,
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
      if (!Number.isInteger(fiatAmount))
        return await messages.wizardAddFiatAmountWrongAmountMessage(ctx, order);

      if (fiatAmount < order.min_amount || fiatAmount > order.max_amount)
        return await messages.wizardAddFiatAmountWrongAmountMessage(ctx, order);

      order.fiat_amount = fiatAmount;
      const currency = getCurrency(order.fiat_code);
      if (currency === null) throw new Error('currency is null');
      await messages.wizardAddFiatAmountCorrectMessage(
        ctx,
        currency,
        fiatAmount,
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
  },
);

export { addInvoiceWizard, addFiatAmountWizard, addInvoicePHIWizard };
