const { Scenes, Markup } = require('telegraf');
const logger = require('../../../logger');
const { getCurrency } = require('../../../util');
const ordersActions = require('../../ordersActions');
const {
  publishBuyOrderMessage,
  publishSellOrderMessage,
} = require('../../messages');
const messages = require('./messages');

const CREATE_ORDER = (exports.CREATE_ORDER = 'CREATE_ORDER_WIZARD');

exports.middleware = () => {
  const stage = new Scenes.Stage([createOrder]);
  return stage.middleware();
};

const createOrder = (exports.createOrder = new Scenes.WizardScene(
  CREATE_ORDER,
  async ctx => {
    try {
      const {
        user,
        community,
        statusMessage,
        type,
        currency,
        fiatAmount,
        sats,
        priceMargin,
        method,
      } = ctx.wizard.state;
      if (!statusMessage) {
        const { text } = messages.createOrderWizardStatus(
          ctx.i18n,
          ctx.wizard.state
        );
        const res = await ctx.reply(text);
        ctx.wizard.state.currentStatusText = text;
        ctx.wizard.state.statusMessage = res;
        ctx.wizard.state.updateUI = async () => {
          try {
            const { text } = messages.createOrderWizardStatus(
              ctx.i18n,
              ctx.wizard.state
            );
            if (ctx.wizard.state.currentStatusText === text) return;
            await ctx.telegram.editMessageText(
              res.chat.id,
              res.message_id,
              null,
              text
            );
            ctx.wizard.state.currentStatusText = text;
          } catch (err) {
            logger.error(err);
          }
        };
      }
      if (undefined === currency) return createOrderSteps.currency(ctx);
      if (undefined === fiatAmount) return createOrderSteps.fiatAmount(ctx);
      if (undefined === sats) return createOrderSteps.sats(ctx);
      if (undefined === priceMargin && sats === 0)
        return createOrderSteps.priceMargin(ctx);
      if (undefined === method) return createOrderSteps.method(ctx);

      const order = await ordersActions.createOrder(ctx.i18n, ctx, user, {
        type,
        amount: sats,
        fiatAmount,
        fiatCode: currency,
        paymentMethod: method,
        status: 'PENDING',
        priceMargin,
        community_id: community && community.id,
      });
      if (order) {
        const publishFn =
          type === 'buy' ? publishBuyOrderMessage : publishSellOrderMessage;
        publishFn(ctx, user, order, ctx.i18n, true);
      }
      return ctx.scene.leave();
    } catch (err) {
      logger.error(err);
      return ctx.scene.leave();
    }
  },
  async ctx => {
    try {
      if (ctx.wizard.state.handler) {
        const ret = await ctx.wizard.state.handler(ctx);
        if (!ret) return;
        delete ctx.wizard.state.handler;
      }
      await ctx.wizard.selectStep(0);
      return ctx.wizard.steps[ctx.wizard.cursor](ctx);
    } catch (err) {
      logger.error(err);
      return ctx.scene.leave();
    }
  }
));

const createOrderSteps = {
  async currency(ctx) {
    if (ctx.message === undefined) return ctx.scene.leave();
    const prompt = await createOrderPrompts.currency(ctx);
    const deletePrompt = () =>
      ctx.telegram.deleteMessage(prompt.chat.id, prompt.message_id);
    ctx.wizard.state.handler = async ctx => {
      ctx.wizard.state.error = null;
      if (!ctx.wizard.state.currencies) {
        await ctx.deleteMessage();
        const currency = getCurrency(ctx.message.text.toUpperCase());
        if (!currency) {
          ctx.wizard.state.error = ctx.i18n.t('invalid_currency');
          return await ctx.wizard.state.updateUI();
        }
        ctx.wizard.state.currency = currency.code;
        await ctx.wizard.state.updateUI();
      } else {
        if (!ctx.callbackQuery) return;
        const currency = ctx.callbackQuery.data;
        ctx.wizard.state.currency = currency;
        await ctx.wizard.state.updateUI();
      }
      return deletePrompt();
    };
    return ctx.wizard.next();
  },
  async fiatAmount(ctx) {
    ctx.wizard.state.handler = async ctx => {
      await createOrderHandlers.fiatAmount(ctx);
      return await ctx.telegram.deleteMessage(
        prompt.chat.id,
        prompt.message_id
      );
    };
    const prompt = await createOrderPrompts.fiatAmount(ctx);
    return ctx.wizard.next();
  },
  async method(ctx) {
    if (ctx.message === undefined) return ctx.scene.leave();
    ctx.wizard.state.handler = async ctx => {
      const { text } = ctx.message;
      if (!text) return;
      ctx.wizard.state.method = text;
      await ctx.wizard.state.updateUI();
      await ctx.deleteMessage();
      return await ctx.telegram.deleteMessage(
        prompt.chat.id,
        prompt.message_id
      );
    };
    const prompt = await ctx.reply(ctx.i18n.t('enter_payment_method'));
    return ctx.wizard.next();
  },
  async priceMargin(ctx) {
    const prompt = await ctx.reply(ctx.i18n.t('enter_premium_discount'));
    ctx.wizard.state.handler = async ctx => {
      ctx.wizard.state.error = null;
      await ctx.deleteMessage();
      const input = ctx.message.text;
      if (isNaN(input)) {
        ctx.wizard.state.error = ctx.i18n.t('not_number');
        await ctx.wizard.state.updateUI();
        return;
      }
      ctx.wizard.state.priceMargin = parseInt(input);
      await ctx.wizard.state.updateUI();
      return await ctx.telegram.deleteMessage(
        prompt.chat.id,
        prompt.message_id
      );
    };
    return ctx.wizard.next();
  },
  async sats(ctx) {
    const prompt = await createOrderPrompts.sats(ctx);
    ctx.wizard.state.handler = async ctx => {
      const ret = await createOrderHandlers.sats(ctx);
      if (!ret) return;
      return await ctx.telegram.deleteMessage(
        prompt.chat.id,
        prompt.message_id
      );
    };
    return ctx.wizard.next();
  },
};

const createOrderPrompts = {
  async currency(ctx) {
    const { currencies } = ctx.wizard.state;
    if (!currencies) return ctx.reply(ctx.i18n.t('enter_currency'));
    const buttons = currencies.map(currency =>
      Markup.button.callback(currency, currency)
    );
    const rows = [];
    const chunkSize = 3;
    for (let i = 0; i < buttons.length; i += chunkSize) {
      const chunk = buttons.slice(i, i + chunkSize);
      rows.push(chunk);
    }
    return ctx.reply(
      ctx.i18n.t('choose_currency'),
      Markup.inlineKeyboard(rows)
    );
  },
  async fiatAmount(ctx) {
    const { currency } = ctx.wizard.state;
    return ctx.reply(ctx.i18n.t('enter_currency_amount', { currency }));
  },
  async sats(ctx) {
    const button = Markup.button.callback(
      ctx.i18n.t('market_price'),
      'marketPrice'
    );
    return ctx.reply(
      ctx.i18n.t('enter_sats_amount'),
      Markup.inlineKeyboard([button])
    );
  },
};

const createOrderHandlers = {
  async fiatAmount(ctx) {
    if (ctx.message === undefined) return ctx.scene.leave();
    ctx.wizard.state.error = null;
    const inputs = ctx.message.text.split('-').map(Number);
    const notNumbers = inputs.filter(isNaN);
    await ctx.deleteMessage();
    if (notNumbers.length) {
      ctx.wizard.state.error = ctx.i18n.t('not_number');
      await ctx.wizard.state.updateUI();
      return;
    }
    const zeros = inputs.filter(n => n === 0);
    if (zeros.length) {
      ctx.wizard.state.error = ctx.i18n.t('not_zero');
      await ctx.wizard.state.updateUI();
      return;
    }
    ctx.wizard.state.fiatAmount = inputs;
    await ctx.wizard.state.updateUI();

    return true;
  },
  async sats(ctx) {
    if (ctx.callbackQuery) {
      ctx.wizard.state.sats = 0;
      await ctx.wizard.state.updateUI();
      return true;
    }
    const input = ctx.message.text;
    await ctx.deleteMessage();
    if (isNaN(input)) {
      ctx.wizard.state.error = ctx.i18n.t('not_number');
      await ctx.wizard.state.updateUI();
      return;
    }
    if (input < 0) {
      ctx.wizard.state.error = ctx.i18n.t('not_negative');
      await ctx.wizard.state.updateUI();
      return;
    }
    ctx.wizard.state.sats = parseInt(input);
    await ctx.wizard.state.updateUI();
    return true;
  },
};
