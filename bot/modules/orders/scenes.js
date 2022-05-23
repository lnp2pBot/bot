const { Scenes, Markup } = require('telegraf');
const { getCurrency } = require('../../../util');
const ordersActions = require('../../ordersActions');
const messages = require('../../messages');

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
        updateUI,
        statusMessage,
        type,
        currency,
        fiatAmount,
        sats,
        priceMargin,
        method,
      } = ctx.wizard.state;
      const statusString = JSON.stringify(
        {
          community: community && community.name,
          type,
          currency,
          fiatAmount,
          sats,
          priceMargin,
          method,
        },
        null,
        2
      );
      if (!statusMessage) {
        const res = await ctx.reply(statusString);
        ctx.wizard.state.statusMessage = res;
      }
      if (updateUI) {
        await ctx.telegram.editMessageText(
          statusMessage.chat.id,
          statusMessage.message_id,
          null,
          statusString
        );
        ctx.wizard.state.updateUI = false;
      }
      if (undefined === currency) return createOrderSteps.currency(ctx);
      if (undefined === fiatAmount) return createOrderSteps.fiatAmount(ctx);
      if (undefined === sats) return createOrderSteps.sats(ctx);
      if (undefined === priceMargin) {
        if (fiatAmount === 0 || sats === 0)
          return createOrderSteps.priceMargin(ctx);
      }
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
        await messages.publishBuyOrderMessage(ctx, user, order, ctx.i18n, true);
      }
      await ctx.reply('Wizard completed...');
      return ctx.scene.leave();
    } catch (err) {
      await ctx.reply('ERROR|' + err.message);
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
      await ctx.reply('ERROR|' + err.message);
      return ctx.scene.leave();
    }
  }
));
createOrder.command('exit', ctx => {
  ctx.scene.leave();
  ctx.reply('Exited wizard.');
});
const createOrderSteps = {
  async currency(ctx) {
    const prompt = await createOrderPrompts.currency(ctx);
    const deletePrompt = () =>
      ctx.telegram.deleteMessage(prompt.chat.id, prompt.message_id);
    ctx.wizard.state.handler = async ctx => {
      if (!ctx.wizard.state.currencies) {
        ctx.telegram.deleteMessage(ctx.chat.id, ctx.message.message_id);
        const currency = getCurrency(ctx.message.text);
        if (!currency) return;
        ctx.wizard.state.currency = currency.code;
        ctx.wizard.state.updateUI = true;
      } else {
        if (!ctx.callbackQuery) return;
        const currency = ctx.callbackQuery.data;
        ctx.wizard.state.currency = currency;
        ctx.wizard.state.updateUI = true;
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
    ctx.wizard.state.handler = async ctx => {
      const { text } = ctx.message;
      if (!text) return;
      ctx.wizard.state.method = text;
      ctx.wizard.state.updateUI = true;
      await ctx.telegram.deleteMessage(
        ctx.message.chat.id,
        ctx.message.message_id
      );
      return await ctx.telegram.deleteMessage(
        prompt.chat.id,
        prompt.message_id
      );
    };
    const prompt = await ctx.reply('Especifique el método de pago');
    return ctx.wizard.next();
  },
  async priceMargin(ctx) {
    const prompt = await ctx.reply(
      'Especifique el priceMargin. 0 para no especificar.'
    );
    ctx.wizard.state.handler = async ctx => {
      const input = ctx.message.text;
      if (isNaN(input)) {
        await ctx.reply('NaN');
        return;
      }
      ctx.wizard.state.priceMargin = parseInt(input);
      ctx.wizard.state.updateUI = true;
      await ctx.telegram.deleteMessage(
        ctx.message.chat.id,
        ctx.message.message_id
      );
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
      await createOrderHandlers.sats(ctx);
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
    if (!currencies) return ctx.reply('Elija una moneda (3 letras)');
    const buttons = currencies.map(currency =>
      Markup.button.callback(currency, currency)
    );
    const rows = [];
    const chunkSize = 3;
    for (let i = 0; i < buttons.length; i += chunkSize) {
      const chunk = buttons.slice(i, i + chunkSize);
      rows.push(chunk);
    }
    return ctx.reply('Elija una moneda', Markup.inlineKeyboard(rows));
  },
  async fiatAmount(ctx) {
    const { currency } = ctx.wizard.state;
    return ctx.reply(`Especifique el monto de ${currency}.`);
  },
  async sats(ctx) {
    const button = Markup.button.callback('Market price', 'marketPrice');
    return ctx.reply(
      'Especifique el monto de satoshis',
      Markup.inlineKeyboard([button])
    );
  },
};
const createOrderHandlers = {
  async fiatAmount(ctx) {
    const inputs = ctx.message.text.split('-').map(Number);
    const notNumbers = inputs.filter(isNaN);
    if (notNumbers.length) {
      await ctx.reply('NaN');
      return;
    }
    const zeros = inputs.filter(n => n === 0);
    if (zeros.length) {
      await ctx.reply('No se permite 0');
      return;
    }
    ctx.wizard.state.fiatAmount = inputs;
    ctx.wizard.state.updateUI = true;
    await ctx.telegram.deleteMessage(
      ctx.message.chat.id,
      ctx.message.message_id
    );
    return true;
  },
  async sats(ctx) {
    if (ctx.callbackQuery) {
      ctx.wizard.state.sats = 0;
      ctx.wizard.state.updateUI = true;
      return true;
    }
    const input = ctx.message.text;
    await ctx.telegram.deleteMessage(
      ctx.message.chat.id,
      ctx.message.message_id
    );
    if (isNaN(input)) {
      await ctx.reply('NaN');
      return;
    }
    ctx.wizard.state.sats = parseInt(input);
    ctx.wizard.state.updateUI = true;
    return true;
  },
};
