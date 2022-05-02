const { Scenes } = require('telegraf')
const { isValidInvoice } = require('./validations');
const { Order, Community, User } = require('../models');
const { waitPayment, addInvoice, showHoldInvoice } = require("./commands");
const { getCurrency, isGroupAdmin } = require('../util');
const messages = require('./messages');

const addInvoiceWizard = new Scenes.WizardScene(
  'ADD_INVOICE_WIZARD_SCENE_ID',
  async (ctx) => {
    try {
      const { order } = ctx.wizard.state;
      const expirationTime = parseInt(process.env.HOLD_INVOICE_EXPIRATION_WINDOW) / 60;
      const currency = getCurrency(order.fiat_code);
      const symbol = (!!currency && !!currency.symbol_native) ? currency.symbol_native : order.fiat_code;
      await messages.wizardAddInvoiceInitMessage(ctx, order, symbol, expirationTime);
      
      order.status = 'WAITING_BUYER_INVOICE';
      await order.save();
      return ctx.wizard.next();
    } catch (error) {
      console.log(error);
    }
  },
  async (ctx) => {
    try {
      if (ctx.message === undefined) {
        return ctx.scene.leave();
      }
      const lnInvoice = ctx.message.text.trim();
      let { bot, buyer, seller, order } = ctx.wizard.state;
      // We get an updated order from the DB
      order = await Order.findOne({ _id: order._id });
      if (!order) {
        await ctx.reply(ctx.i18n.t('generic_error'));
        return ctx.scene.leave();
      };

      if (lnInvoice == 'exit') {
        if (!!order && order.status == 'WAITING_BUYER_INVOICE') {
          await messages.wizardAddInvoiceExitMessage(ctx, order);
        } else {
          await messages.wizardExitMessage(ctx);
        }
        return ctx.scene.leave();
      }
      const res = await isValidInvoice(ctx, lnInvoice);
      if (!res.success) {
        return;
      };

      if (order.status == 'EXPIRED') {
        await messages.orderExpiredMessage(ctx);
        return ctx.scene.leave();
      }

      if (order.status != 'WAITING_BUYER_INVOICE') {
        await messages.cantAddInvoiceMessage(ctx);
        return ctx.scene.leave();
      }

      if (res.invoice.tokens && res.invoice.tokens != order.amount) {
        await messages.incorrectAmountInvoiceMessage(ctx);
        return;
      }
      await waitPayment(ctx, bot, buyer, seller, order, lnInvoice);

      return ctx.scene.leave();
    } catch (error) {
      console.log(error);
      ctx.scene.leave();
    }
  },
);

const communityWizard = new Scenes.WizardScene(
  'COMMUNITY_WIZARD_SCENE_ID',
  async (ctx) => {
    try {
      if (ctx.message === undefined) {
        return ctx.scene.leave();
      }

      await messages.wizardCommunityEnterNameMessage(ctx);
      ctx.wizard.state.community = {};

      return ctx.wizard.next();
    } catch (error) {
      console.log(error);
      ctx.scene.leave();
    }
  },
  async (ctx) => {
    try {
      if (ctx.message === undefined) {
        return ctx.scene.leave();
      }
  
      const name = ctx.message.text.trim();
      if (name == 'exit') {
        await messages.wizardExitMessage(ctx);
        return ctx.scene.leave();
      }
      const nameLength = 30;
      if (name.length > nameLength) {
        ctx.deleteMessage();
        await messages.wizardCommunityTooLongNameMessage(ctx, nameLength);
        return;
      }
      ctx.wizard.state.community.name = name;
      await messages.wizardCommunityEnterCurrencyMessage(ctx);

      return ctx.wizard.next();
    } catch (error) {
      console.log(error);
      ctx.scene.leave();
    }
  },
  async (ctx) => {
    try {
      if (ctx.message === undefined) {
        return ctx.scene.leave();
      }

      if (ctx.message.text.trim() == 'exit') {
        await messages.wizardExitMessage(ctx);
        return ctx.scene.leave();
      }

      let currencies = ctx.message.text.trim().split(" ");
      currencies = currencies.filter(currency => !!currency);
      currencies = currencies.map(currency => currency.toUpperCase());
      if (currencies.length > 10) {
        await messages.wizardCommunityEnterCurrencyMessage(ctx);
        return;
      }
      ctx.wizard.state.community.currencies = currencies;
      await messages.wizardCommunityEnterGroupMessage(ctx);

      return ctx.wizard.next();
    } catch (error) {
      console.log(error);
      ctx.scene.leave();
    }
  },
  async (ctx) => {
    try {
      const { bot, user } = ctx.wizard.state;
      if (ctx.message.text.trim() == 'exit') {
        await messages.wizardExitMessage(ctx);
        return ctx.scene.leave();
      }
      const group = ctx.message.text.trim();
      await isGroupAdmin(group, user, bot.telegram);
      ctx.wizard.state.community.group = group;
      ctx.wizard.state.community.creator_id = user._id;
      await messages.wizardCommunityEnterOrderChannelsMessage(ctx);

      return ctx.wizard.next();
    } catch (error) {
      ctx.reply(error.toString());
      ctx.scene.leave();
    }
  },
  async (ctx) => {
    try {
      const { bot, user } = ctx.wizard.state;
      if (ctx.message === undefined) {
        return ctx.scene.leave();
      }
      if (ctx.message.text.trim() == 'exit') {
        await messages.wizardExitMessage(ctx);
        return ctx.scene.leave();
      }
      const chan = ctx.message.text.trim().split(" ");
      if (chan.length > 2) {
        await messages.wizardCommunityOneOrTwoChannelsMessage(ctx);
        return;
      }
      const orderChannels = [];
      if (chan.length == 1) {
        await isGroupAdmin(chan[0], user, bot.telegram);
        const channel = {
          name: chan[0],
          type: 'mixed',
        };
        orderChannels.push(channel);
      } else {
        await isGroupAdmin(chan[0], user, bot.telegram);
        await isGroupAdmin(chan[1], user, bot.telegram);
        const channel1 = {
          name: chan[0],
          type: 'buy',
        };
        const channel2 = {
          name: chan[1],
          type: 'sell',
        };
        orderChannels.push(channel1);
        orderChannels.push(channel2);
      }

      ctx.wizard.state.community.order_channels = orderChannels;
      await messages.wizardCommunityEnterSolversMessage(ctx);

      return ctx.wizard.next();
    } catch (error) {
      ctx.reply(error.toString());
      console.log(error);
    }
  },
  async (ctx) => {
    try {
      if (ctx.message.text.trim() == 'exit') {
        await messages.wizardExitMessage(ctx);
        return ctx.scene.leave();
      }
      const solvers = [];
      const usernames = ctx.message.text.trim().split(" ");
      if (usernames.length > 0 && usernames.length < 10) {
        for (let i = 0; i < usernames.length; i++) {
          const user = await User.findOne({ username: usernames[i] });
          if (!!user) {
            solvers.push({
              id: user._id,
              username: user.username,
            });
          }
        }
      } else {
        await messages.wizardCommunityMustEnterNamesSeparatedMessage(ctx);
      }
      ctx.wizard.state.community.solvers = solvers;
      await messages.wizardCommunityEnterSolversChannelMessage(ctx);

      return ctx.wizard.next();
    } catch (error) {
      ctx.reply(error.toString());
      ctx.scene.leave();
    }
  },
  async (ctx) => {
    try {
      const { bot, user, community } = ctx.wizard.state;
      const chan = ctx.message.text.trim();
      if (chan == 'exit') {
        await messages.wizardExitMessage(ctx);
        return ctx.scene.leave();
      }
      await isGroupAdmin(chan, user, bot.telegram);
      community.dispute_channel = chan;

      const newCommunity = new Community(community);
      await newCommunity.save();
      await messages.wizardCommunityCreatedMessage(ctx);

      return ctx.scene.leave();
    } catch (error) {
      ctx.reply(error.toString());
      ctx.scene.leave();
    }
  },
);

const addFiatAmountWizard = new Scenes.WizardScene(
  'ADD_FIAT_AMOUNT_WIZARD_SCENE_ID',
  async (ctx) => {
    try {
      const { order } = ctx.wizard.state;
      const currency = getCurrency(order.fiat_code);
      const action = order.type === 'buy' ? 'recibir' : 'enviar';
      const currencyName = (!!currency && !!currency.name_plural) ? currency.name_plural : order.fiat_code;
      await messages.wizardAddFiatAmountMessage(ctx, currencyName, action, order);

      return ctx.wizard.next()
    } catch (error) {
      console.log(error);
    }
  },
  async (ctx) => {
    try {
      const { bot, order } = ctx.wizard.state;

      if (ctx.message === undefined) {
        return ctx.scene.leave();
      }

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
      await messages.wizardAddFiatAmountCorrectMessage(ctx, currency, fiatAmount);

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
);

const updateNameCommunityWizard = new Scenes.WizardScene(
  'UPDATE_NAME_COMMUNITY_WIZARD_SCENE_ID',
  async (ctx) => {
    try {
      await messages.wizardCommunityEnterNameMessage(ctx);

      return ctx.wizard.next();
    } catch (error) {
      console.log(error);
      ctx.scene.leave();
    }
  },
  async (ctx) => {
    try {
      if (ctx.message === undefined) {
        return ctx.scene.leave();
      }

      const name = ctx.message.text.trim();
      if (name == 'exit') {
        await messages.wizardExitMessage(ctx);
        return ctx.scene.leave();
      }
      const nameLength = 30;
      if (name.length > nameLength) {
        ctx.deleteMessage();
        await messages.wizardCommunityTooLongNameMessage(ctx, nameLength);
        return;
      }
      const { id, user } = ctx.wizard.state;
      const community = await Community.findOne({ _id: id, creator_id: user._id });
      if (!community) {
        console.log('not found');
        return ctx.scene.leave();
      }
      community.name = name;
      await community.save();
      await messages.operationSuccessfulMessage(ctx);

      return ctx.scene.leave();
    } catch (error) {
      console.log(error);
      ctx.scene.leave();
    }
  },
);

const updateGroupCommunityWizard = new Scenes.WizardScene(
  'UPDATE_GROUP_COMMUNITY_WIZARD_SCENE_ID',
  async (ctx) => {
    try {
      await messages.wizardCommunityEnterGroupMessage(ctx);

      return ctx.wizard.next();
    } catch (error) {
      console.log(error);
      ctx.scene.leave();
    }
  },
  async (ctx) => {
    try {
      if (ctx.message === undefined) {
        return ctx.scene.leave();
      }

      const group = ctx.message.text.trim();
      if (group == 'exit') {
        await messages.wizardExitMessage(ctx);
        return ctx.scene.leave();
      }
      const { id, bot, user } = ctx.wizard.state;
      await isGroupAdmin(group, user, bot.telegram);
      const community = await Community.findOne({ _id: id, creator_id: user._id });
      if (!community) {
        console.log('not found');
        return ctx.scene.leave();
      }
      community.group = group;
      await community.save();
      await messages.operationSuccessfulMessage(ctx);

      return ctx.scene.leave();
    } catch (error) {
      console.log(error);
      ctx.scene.leave();
    }
  },
);

const updateCurrenciesCommunityWizard = new Scenes.WizardScene(
  'UPDATE_CURRENCIES_COMMUNITY_WIZARD_SCENE_ID',
  async (ctx) => {
    try {
      await messages.wizardCommunityEnterCurrencyMessage(ctx);

      return ctx.wizard.next();
    } catch (error) {
      console.log(error);
      ctx.scene.leave();
    }
  },
  async (ctx) => {
    try {
      if (ctx.message === undefined) {
        return ctx.scene.leave();
      }

      if (ctx.message.text.trim() == 'exit') {
        await messages.wizardExitMessage(ctx);
        return ctx.scene.leave();
      }
      
      let currencies = ctx.message.text.trim().split(" ");
      currencies = currencies.filter(currency => !!currency);
      currencies = currencies.map(currency => currency.toUpperCase());
      if (currencies.length > 10) {
        await messages.wizardCommunityEnterCurrencyMessage(ctx);
        return;
      }

      const { id, user } = ctx.wizard.state;
      const community = await Community.findOne({ _id: id, creator_id: user._id });
      if (!community) {
        console.log('not found');
        return ctx.scene.leave();
      }
      community.currencies = currencies;
      await community.save();
      await messages.operationSuccessfulMessage(ctx);

      return ctx.scene.leave();
    } catch (error) {
      console.log(error);
      ctx.scene.leave();
    }
  },
);

const updateChannelsCommunityWizard = new Scenes.WizardScene(
  'UPDATE_CHANNELS_COMMUNITY_WIZARD_SCENE_ID',
  async (ctx) => {
    try {
      await messages.wizardCommunityOneOrTwoChannelsMessage(ctx);

      return ctx.wizard.next();
    } catch (error) {
      console.log(error);
      ctx.scene.leave();
    }
  },
  async (ctx) => {
    try {
      if (ctx.message === undefined) {
        return ctx.scene.leave();
      }

      if (ctx.message.text.trim() == 'exit') {
        await messages.wizardExitMessage(ctx);
        return ctx.scene.leave();

      }
      const chan = ctx.message.text.trim().split(" ");
      if (chan.length > 2) {
        await messages.wizardCommunityOneOrTwoChannelsMessage(ctx);
        return;
      }

      const { id, bot, user } = ctx.wizard.state;
      const community = await Community.findOne({ _id: id, creator_id: user._id });
      if (!community) {
        console.log('not found');
        return ctx.scene.leave();
      }
      const orderChannels = [];
      if (chan.length == 1) {
        await isGroupAdmin(chan[0], user, bot.telegram);
        const channel = {
          name: chan[0],
          type: 'mixed',
        };
        orderChannels.push(channel);
      } else {
        await isGroupAdmin(chan[0], user, bot.telegram);
        await isGroupAdmin(chan[1], user, bot.telegram);
        const channel1 = {
          name: chan[0],
          type: 'buy',
        };
        const channel2 = {
          name: chan[1],
          type: 'sell',
        };
        orderChannels.push(channel1);
        orderChannels.push(channel2);
      }
      community.order_channels = orderChannels;
      await community.save();
      await messages.operationSuccessfulMessage(ctx);

      return ctx.scene.leave();
    } catch (error) {
      console.log(error);
      ctx.scene.leave();
    }
  },
);

const updateSolversCommunityWizard = new Scenes.WizardScene(
  'UPDATE_SOLVERS_COMMUNITY_WIZARD_SCENE_ID',
  async (ctx) => {
    try {
      await messages.wizardCommunityEnterSolversMessage(ctx);

      return ctx.wizard.next();
    } catch (error) {
      console.log(error);
      ctx.scene.leave();
    }
  },
  async (ctx) => {
    try {
      if (ctx.message === undefined) {
        return ctx.scene.leave();
      }

      if (ctx.message.text.trim() == 'exit') {
        await messages.wizardExitMessage(ctx);
        return ctx.scene.leave();

      }
      const solvers = [];
      const usernames = ctx.message.text.trim().split(" ");
      if (usernames.length > 0 && usernames.length < 10) {
        for (let i = 0; i < usernames.length; i++) {
          const user = await User.findOne({ username: usernames[i] });
          if (!!user) {
            solvers.push({
              id: user._id,
              username: user.username,
            });
          }
        }
      } else {
        await messages.wizardCommunityMustEnterNamesSeparatedMessage(ctx);
      }

      const { id, user } = ctx.wizard.state;
      const community = await Community.findOne({ _id: id, creator_id: user._id });
      if (!community) {
        console.log('not found');
        return ctx.scene.leave();
      }
      community.solvers = solvers;
      await community.save();
      await messages.operationSuccessfulMessage(ctx);

      return ctx.scene.leave();
    } catch (error) {
      console.log(error);
      ctx.scene.leave();
    }
  },
);

module.exports = {
  addInvoiceWizard,
  communityWizard,
  addFiatAmountWizard,
  updateNameCommunityWizard,
  updateCurrenciesCommunityWizard,
  updateGroupCommunityWizard,
  updateChannelsCommunityWizard,
  updateSolversCommunityWizard,
};
