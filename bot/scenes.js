const { Scenes } = require('telegraf')
const { isValidInvoice } = require('./validations');
const { Order, Community, User } = require('../models');
const { waitPayment, addInvoice, showHoldInvoice } = require("./commands");
const { getCurrency } = require('../util');
const messages = require('./messages');

const addInvoiceWizard = new Scenes.WizardScene(
  'ADD_INVOICE_WIZARD_SCENE_ID',
  async (ctx) => {
    try {
      const { bot, buyer, order } = ctx.wizard.state;
      const expirationTime = parseInt(process.env.HOLD_INVOICE_EXPIRATION_WINDOW) / 60;
      const currency = getCurrency(order.fiat_code);
      const symbol = (!!currency && !!currency.symbol_native) ? currency.symbol_native : order.fiat_code;
      await messages.wizardAddInvoiceInitMessage(bot, buyer, order, symbol, expirationTime);
      
      order.status = 'WAITING_BUYER_INVOICE';
      await order.save();
      return ctx.wizard.next();
    } catch (error) {
      console.log(error);
      await messages.errorMessage(ctx);
    }
  },
  async (ctx) => {
    try {
      if (ctx.message === undefined) {
        return ctx.scene.leave();
      }
      const lnInvoice = ctx.message.text;
      let { bot, buyer, seller, order } = ctx.wizard.state;
      if (lnInvoice == 'exit') {
        await messages.wizardAddInvoiceExitMessage(ctx, order);
        return ctx.scene.leave();
      }
      const res = await isValidInvoice(lnInvoice);
      if (!res.success) {
        await ctx.reply(res.error);
        return;
      };
      // We get an updated order from the DB
      order = await Order.findOne({ _id: order._id });
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
  
      const name = ctx.message.text;
      if (name == 'exit') {
        await messages.wizardExitMessage(ctx);
        return ctx.scene.leave();
      }
      const nameLength = 20;
      if (name.length > nameLength) {
        ctx.deleteMessage();
        await messages.wizardCommunityTooLongNameMessage(ctx, nameLength);
        return;
      }
      ctx.wizard.state.community.name = name;
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
      if (ctx.message.text == 'exit') {
        await messages.wizardExitMessage(ctx);
        return ctx.scene.leave();
      }
      const group = ctx.message.text;
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
      const { bot, user, community } = ctx.wizard.state;
      if (ctx.message === undefined) {
        return ctx.scene.leave();
      }
      if (ctx.message.text == 'exit') {
        await messages.wizardExitMessage(ctx);
        return ctx.scene.leave();
      }
      const chan = ctx.message.text.split(" ");
      if (chan.length > 2) {
        await messages.wizardCommunityOneOrTwoChannelsMessage(ctx);
        return;
      }
      community.order_channels = [];
      if (chan.length == 1) {
        await isGroupAdmin(chan[0], user, bot.telegram);
        const channel = {
          name: chan[0],
          type: 'mixed',
        };
        community.order_channels.push(channel);
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
        community.order_channels.push(channel1);
        community.order_channels.push(channel2);
      }

      ctx.wizard.state.community = community;
      await messages.wizardCommunityEnterSolversMessage(ctx);

      return ctx.wizard.next();
    } catch (error) {
      ctx.reply(error.toString());
      console.log(error);
    }
  },
  async (ctx) => {
    try {
      if (ctx.message.text == 'exit') {
        await messages.wizardExitMessage(ctx);
        return ctx.scene.leave();
      }
      const { community } = ctx.wizard.state;
      community.solvers = [];
      const usernames = ctx.message.text.split(" ");
      if (usernames.length > 0 && usernames.length < 10) {
        for (let i = 0; i < usernames.length; i++) {
          const user = await User.findOne({ username: usernames[i] });
          if (!!user) {
            community.solvers.push({
              id: user._id,
              username: user.username,
            });
          }
        }
      } else {
        await messages.wizardCommunityMustEnterNamesSeparatedMessage(ctx);
      }
      ctx.wizard.state.community.solvers = community.solvers;
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
      const chan = ctx.message.text;
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

const isGroupAdmin = async (groupId, user, telegram) => {
  try {
    const member = await telegram.getChatMember(groupId, parseInt(user.tg_id));
    if (member && (member.status === 'creator' || member.status === 'administrator')) {
      return true;
    }

    return false;
  } catch (error) {
    console.log(error);
    if (!!error.response && error.response.error_code == 400) {
      throw new Error(messages.wizardCommunityWrongPermission());
    }
  }
};

const addFiatAmountWizard = new Scenes.WizardScene(
  'ADD_FIAT_AMOUNT_WIZARD_SCENE_ID',
  async (ctx) => {
    try {
      const { bot, order, caller } = ctx.wizard.state;
      const currency = getCurrency(order.fiat_code);
      const action = order.type === 'buy' ? 'recibir' : 'enviar';
      const currencyName = (!!currency && !!currency.name_plural) ? currency.name_plural : order.fiat_code;
      await messages.wizardAddFiatAmountMessage(ctx, currencyName, action, order);

      return ctx.wizard.next()
    } catch (error) {
      console.log(error);
      await messages.errorMessage(ctx);
    }
  },
  async (ctx) => {
    try {
      const { bot, order } = ctx.wizard.state;

      if (ctx.message === undefined) {
        return ctx.scene.leave();
      }

      const fiatAmount = parseInt(ctx.message.text);
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
)

module.exports = {
  addInvoiceWizard,
  communityWizard,
  addFiatAmountWizard,
};
