const { Scenes } = require('telegraf');
const logger = require('../../../logger');
const { Community, User, PendingPayment } = require('../../../models');
const { isPendingPayment } = require('../../../ln');
const { isGroupAdmin, itemsFromMessage } = require('../../../util');
const messages = require('../../messages');
const { isValidInvoice } = require('../../validations');
const {
  createCommunityWizardStatus,
  wizardCommunityWrongPermission,
} = require('./messages');

exports.communityWizard = new Scenes.WizardScene(
  'COMMUNITY_WIZARD_SCENE_ID',
  async ctx => {
    try {
      if (ctx.message === undefined) return ctx.scene.leave();

      const {
        name,
        currencies,
        group,
        channels,
        fee,
        solvers,
        disputeChannel,
        user,
        statusMessage,
      } = ctx.wizard.state;

      if (!statusMessage) {
        const { text } = createCommunityWizardStatus(
          ctx.i18n,
          ctx.wizard.state
        );
        const res = await ctx.reply(text);
        ctx.wizard.state.currentStatusText = text;
        ctx.wizard.state.statusMessage = res;
        ctx.wizard.state.updateUI = async () => {
          try {
            const { text } = createCommunityWizardStatus(
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

      if (undefined === name) return createCommunitySteps.name(ctx);
      if (undefined === currencies) return createCommunitySteps.currencies(ctx);
      if (undefined === group) return createCommunitySteps.group(ctx);
      if (undefined === channels) return createCommunitySteps.channels(ctx);
      if (undefined === fee) return createCommunitySteps.fee(ctx);
      if (undefined === solvers) return createCommunitySteps.solvers(ctx);
      if (undefined === disputeChannel)
        return createCommunitySteps.disputeChannel(ctx);

      const community = new Community({
        name,
        currencies,
        group,
        order_channels: channels,
        fee,
        solvers,
        dispute_channel: disputeChannel,
        creator_id: user._id,
      });
      await community.save();
      await ctx.reply(ctx.i18n.t('wizard_community_success'));

      return ctx.scene.leave();
    } catch (error) {
      logger.error(error);
      ctx.scene.leave();
    }
  },
  async ctx => {
    try {
      if (ctx.wizard.state.handler) {
        if (ctx.message === undefined) return ctx.scene.leave();
        const ret = await ctx.wizard.state.handler(ctx);
        if (!ret) return;
        delete ctx.wizard.state.handler;
      }
      ctx.wizard.selectStep(0);
      return ctx.wizard.steps[ctx.wizard.cursor](ctx);
    } catch (err) {
      logger.error(err);
      return ctx.scene.leave();
    }
  }
);

const createCommunitySteps = {
  async name(ctx) {
    const prompt = await createCommunityPrompts.name(ctx);

    ctx.wizard.state.handler = async ctx => {
      const { text } = ctx.message;
      if (!text) {
        await ctx.deleteMessage();
        return ctx.telegram.deleteMessage(prompt.chat.id, prompt.message_id);
      }
      ctx.wizard.state.error = null;
      const name = text.trim();
      if (!name) {
        ctx.telegram.deleteMessage(ctx.chat.id, ctx.message.message_id);
        ctx.wizard.state.error = ctx.i18n.t('wizard_community_enter_name');
        return await ctx.wizard.state.updateUI();
      }
      const length = 30;
      if (name.length > length) {
        ctx.telegram.deleteMessage(ctx.chat.id, ctx.message.message_id);
        ctx.wizard.state.error = ctx.i18n.t(
          ctx.i18n.t('wizard_community_too_long_name', { length })
        );
        return await ctx.wizard.state.updateUI();
      }
      ctx.wizard.state.name = name;
      await ctx.wizard.state.updateUI();
      await ctx.telegram.deleteMessage(
        ctx.message.chat.id,
        ctx.message.message_id
      );
      return ctx.telegram.deleteMessage(prompt.chat.id, prompt.message_id);
    };

    return ctx.wizard.next();
  },
  async currencies(ctx) {
    const prompt = await createCommunityPrompts.currencies(ctx);

    ctx.wizard.state.handler = async ctx => {
      const { text } = ctx.message;
      if (!text) {
        await ctx.deleteMessage();
        return ctx.telegram.deleteMessage(prompt.chat.id, prompt.message_id);
      }
      ctx.wizard.state.error = null;
      let currencies = itemsFromMessage(text);
      currencies = currencies.map(currency => currency.toUpperCase());
      const max = 10;
      if (currencies.length > max) {
        await ctx.telegram.deleteMessage(
          ctx.message.chat.id,
          ctx.message.message_id
        );
        ctx.wizard.state.error = ctx.i18n.t('max_allowed', { max });
        return await ctx.wizard.state.updateUI();
      }
      ctx.wizard.state.currencies = currencies;
      await ctx.wizard.state.updateUI();
      await ctx.telegram.deleteMessage(
        ctx.message.chat.id,
        ctx.message.message_id
      );
      return ctx.telegram.deleteMessage(prompt.chat.id, prompt.message_id);
    };

    return ctx.wizard.next();
  },
  async group(ctx) {
    const prompt = await createCommunityPrompts.group(ctx);

    ctx.wizard.state.handler = async ctx => {
      try {
        const { text } = ctx.message;
        if (!text) {
          await ctx.deleteMessage();
          return ctx.telegram.deleteMessage(prompt.chat.id, prompt.message_id);
        }
        ctx.wizard.state.error = null;
        const { bot, user } = ctx.wizard.state;
        const group = text.trim();
        if (!(await isGroupAdmin(group, user, bot.telegram))) {
          await ctx.telegram.deleteMessage(
            ctx.message.chat.id,
            ctx.message.message_id
          );
          ctx.wizard.state.error = ctx.i18n.t(
            'wizard_community_you_are_not_admin',
            {
              username: user.username,
              channel: group,
            }
          );
          return await ctx.wizard.state.updateUI();
        }

        ctx.wizard.state.group = group;
        await ctx.wizard.state.updateUI();
        await ctx.telegram.deleteMessage(
          ctx.message.chat.id,
          ctx.message.message_id
        );
        return ctx.telegram.deleteMessage(prompt.chat.id, prompt.message_id);
      } catch (error) {
        ctx.wizard.state.error = error.toString();
        return await ctx.wizard.state.updateUI();
      }
    };

    return ctx.wizard.next();
  },
  async channels(ctx) {
    ctx.wizard.state.handler = async ctx => {
      const { text } = ctx.message;
      if (!text) {
        await ctx.deleteMessage();
        return ctx.telegram.deleteMessage(prompt.chat.id, prompt.message_id);
      }
      const { bot, user } = ctx.wizard.state;
      const chan = itemsFromMessage(text);
      ctx.wizard.state.channels = text;
      if (chan.length > 2) {
        await ctx.telegram.deleteMessage(
          ctx.message.chat.id,
          ctx.message.message_id
        );
        ctx.wizard.state.error = ctx.i18n.t(
          'wizard_community_one_or_two_channels'
        );
        return await ctx.wizard.state.updateUI();
      }
      const orderChannels = [];
      if (chan.length === 1) {
        if (!(await isGroupAdmin(chan[0], user, bot.telegram))) {
          await ctx.telegram.deleteMessage(
            ctx.message.chat.id,
            ctx.message.message_id
          );
          ctx.wizard.state.error = ctx.i18n.t(
            'wizard_community_you_are_not_admin',
            {
              username: user.username,
              channel: chan[0],
            }
          );
          return await ctx.wizard.state.updateUI();
        }
        const channel = {
          name: chan[0],
          type: 'mixed',
        };
        orderChannels.push(channel);
      } else {
        if (!(await isGroupAdmin(chan[0], user, bot.telegram))) {
          await ctx.telegram.deleteMessage(
            ctx.message.chat.id,
            ctx.message.message_id
          );
          ctx.wizard.state.error = ctx.i18n.t(
            'wizard_community_you_are_not_admin',
            {
              username: user.username,
              channel: chan[0],
            }
          );
          return await ctx.wizard.state.updateUI();
        }
        if (!(await isGroupAdmin(chan[1], user, bot.telegram))) {
          await ctx.telegram.deleteMessage(
            ctx.message.chat.id,
            ctx.message.message_id
          );
          ctx.wizard.state.error = ctx.i18n.t(
            'wizard_community_you_are_not_admin',
            {
              username: user.username,
              channel: chan[1],
            }
          );
          return await ctx.wizard.state.updateUI();
        }
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
      ctx.wizard.state.channels = orderChannels;
      await ctx.wizard.state.updateUI();
      await ctx.telegram.deleteMessage(
        ctx.message.chat.id,
        ctx.message.message_id
      );
      return await ctx.telegram.deleteMessage(
        prompt.chat.id,
        prompt.message_id
      );
    };
    const prompt = await createCommunityPrompts.channels(ctx);
    return ctx.wizard.next();
  },
  async fee(ctx) {
    ctx.wizard.state.handler = async ctx => {
      const { text } = ctx.message;
      if (!text) {
        await ctx.deleteMessage();
        return ctx.telegram.deleteMessage(prompt.chat.id, prompt.message_id);
      }
      if (isNaN(text)) {
        await ctx.telegram.deleteMessage(
          ctx.message.chat.id,
          ctx.message.message_id
        );
        ctx.wizard.state.error = ctx.i18n.t('not_number');
        return await ctx.wizard.state.updateUI();
      }
      if (text < 0 || text > 100) {
        await ctx.telegram.deleteMessage(
          ctx.message.chat.id,
          ctx.message.message_id
        );
        ctx.wizard.state.error = ctx.i18n.t('wizard_community_wrong_percent');
        return await ctx.wizard.state.updateUI();
      }
      ctx.wizard.state.fee = text;
      await ctx.wizard.state.updateUI();
      await ctx.telegram.deleteMessage(
        ctx.message.chat.id,
        ctx.message.message_id
      );
      return await ctx.telegram.deleteMessage(
        prompt.chat.id,
        prompt.message_id
      );
    };
    const prompt = await createCommunityPrompts.fee(ctx);
    return ctx.wizard.next();
  },
  async solvers(ctx) {
    ctx.wizard.state.handler = async ctx => {
      const { text } = ctx.message;
      if (!text) {
        await ctx.deleteMessage();
        return ctx.telegram.deleteMessage(prompt.chat.id, prompt.message_id);
      }
      const solvers = [];
      const usernames = itemsFromMessage(text);
      if (usernames.length > 0 && usernames.length < 10) {
        for (let i = 0; i < usernames.length; i++) {
          const username =
            usernames[i][0] == '@' ? usernames[i].slice(1) : usernames[i];
          const user = await User.findOne({ username });
          if (user) {
            solvers.push({
              id: user._id,
              username: user.username,
            });
          }
        }
      } else {
        await ctx.telegram.deleteMessage(
          ctx.message.chat.id,
          ctx.message.message_id
        );
        ctx.wizard.state.error = ctx.i18n.t(
          'wizard_community_must_enter_names'
        );
        return await ctx.wizard.state.updateUI();
      }
      ctx.wizard.state.solvers = solvers;

      await ctx.wizard.state.updateUI();
      await ctx.telegram.deleteMessage(
        ctx.message.chat.id,
        ctx.message.message_id
      );
      return await ctx.telegram.deleteMessage(
        prompt.chat.id,
        prompt.message_id
      );
    };
    const prompt = await createCommunityPrompts.solvers(ctx);
    return ctx.wizard.next();
  },
  async disputeChannel(ctx) {
    ctx.wizard.state.handler = async ctx => {
      const { text } = ctx.message;
      if (!text) {
        await ctx.deleteMessage();
        return ctx.telegram.deleteMessage(prompt.chat.id, prompt.message_id);
      }
      const { bot, user } = ctx.wizard.state;
      if (text < 0 || text > 100) {
        return await ctx.reply(ctx.i18n.t('wizard_community_wrong_percent'));
      }
      if (!(await isGroupAdmin(text, user, bot.telegram))) {
        await ctx.telegram.deleteMessage(
          ctx.message.chat.id,
          ctx.message.message_id
        );
        ctx.wizard.state.error = ctx.i18n.t(
          'wizard_community_you_are_not_admin',
          {
            username: user.username,
            channel: text,
          }
        );
        return await ctx.wizard.state.updateUI();
      }
      ctx.wizard.state.disputeChannel = text;
      await ctx.wizard.state.updateUI();
      await ctx.telegram.deleteMessage(
        ctx.message.chat.id,
        ctx.message.message_id
      );
      return await ctx.telegram.deleteMessage(
        prompt.chat.id,
        prompt.message_id
      );
    };
    const prompt = await createCommunityPrompts.disputeChannel(ctx);
    return ctx.wizard.next();
  },
};

const createCommunityPrompts = {
  async name(ctx) {
    return ctx.reply(ctx.i18n.t('wizard_community_enter_name'));
  },
  async currencies(ctx) {
    return ctx.reply(ctx.i18n.t('wizard_community_enter_currency'));
  },
  async group(ctx) {
    return ctx.reply(ctx.i18n.t('wizard_community_enter_group'));
  },
  async channels(ctx) {
    return ctx.reply(ctx.i18n.t('wizard_community_enter_order_channels'));
  },
  async fee(ctx) {
    return ctx.reply(ctx.i18n.t('wizard_community_enter_fee_percent'));
  },
  async solvers(ctx) {
    return ctx.reply(ctx.i18n.t('wizard_community_enter_solvers'));
  },
  async disputeChannel(ctx) {
    return ctx.reply(ctx.i18n.t('wizard_community_enter_solvers_channel'));
  },
};

exports.updateNameCommunityWizard = new Scenes.WizardScene(
  'UPDATE_NAME_COMMUNITY_WIZARD_SCENE_ID',
  async ctx => {
    try {
      const { community } = ctx.wizard.state;
      let message = ctx.i18n.t('name') + ': ' + community.name + '\n\n';
      message += ctx.i18n.t('wizard_community_enter_name') + '\n\n';
      message += ctx.i18n.t('wizard_to_exit');
      await ctx.reply(message);

      return ctx.wizard.next();
    } catch (error) {
      logger.error(error);
      ctx.scene.leave();
    }
  },
  async ctx => {
    try {
      if (ctx.message === undefined) return ctx.scene.leave();

      const name = ctx.message.text.trim();
      const length = 30;
      if (name.length > length) {
        ctx.deleteMessage();
        return await ctx.reply(
          ctx.i18n.t('wizard_community_too_long_name', { length })
        );
      }
      const { community } = ctx.wizard.state;

      community.name = name;
      await community.save();
      await ctx.reply(ctx.i18n.t('operation_successful'));

      return ctx.scene.leave();
    } catch (error) {
      logger.error(error);
      ctx.scene.leave();
    }
  }
);

exports.updateGroupCommunityWizard = new Scenes.WizardScene(
  'UPDATE_GROUP_COMMUNITY_WIZARD_SCENE_ID',
  async ctx => {
    try {
      const { community } = ctx.wizard.state;
      let message = ctx.i18n.t('group') + ': ' + community.group + '\n\n';
      message += ctx.i18n.t('wizard_community_enter_group') + '\n\n';
      message += ctx.i18n.t('wizard_to_exit');
      await ctx.reply(message);

      return ctx.wizard.next();
    } catch (error) {
      logger.error(error);
      ctx.scene.leave();
    }
  },
  async ctx => {
    try {
      if (ctx.message === undefined) return ctx.scene.leave();

      const group = ctx.message.text.trim();
      const { community, bot, user } = ctx.wizard.state;
      if (!(await isGroupAdmin(group, user, bot.telegram))) {
        return await wizardCommunityWrongPermission(ctx, user, group);
      }

      community.group = group;
      await community.save();
      await ctx.reply(ctx.i18n.t('operation_successful'));

      return ctx.scene.leave();
    } catch (error) {
      logger.error(error);
      ctx.scene.leave();
    }
  }
);

exports.updateCurrenciesCommunityWizard = new Scenes.WizardScene(
  'UPDATE_CURRENCIES_COMMUNITY_WIZARD_SCENE_ID',
  async ctx => {
    try {
      const { community } = ctx.wizard.state;
      const currencies = community.currencies.join(', ');
      let message = ctx.i18n.t('currency') + ': ' + currencies + '\n\n';
      message += ctx.i18n.t('wizard_community_enter_currency') + '\n\n';
      message += ctx.i18n.t('wizard_to_exit');
      await ctx.reply(message);

      return ctx.wizard.next();
    } catch (error) {
      logger.error(error);
      ctx.scene.leave();
    }
  },
  async ctx => {
    try {
      if (ctx.message === undefined) {
        return ctx.scene.leave();
      }

      let currencies = itemsFromMessage(ctx.message.text);
      currencies = currencies.map(currency => currency.toUpperCase());
      if (currencies.length > 10)
        return await ctx.reply(ctx.i18n.t('wizard_community_enter_currency'));

      const { community } = ctx.wizard.state;

      community.currencies = currencies;
      await community.save();
      await ctx.reply(ctx.i18n.t('operation_successful'));

      return ctx.scene.leave();
    } catch (error) {
      logger.error(error);
      ctx.scene.leave();
    }
  }
);

exports.updateChannelsCommunityWizard = new Scenes.WizardScene(
  'UPDATE_CHANNELS_COMMUNITY_WIZARD_SCENE_ID',
  async ctx => {
    try {
      const { community } = ctx.wizard.state;
      const channels = community.order_channels
        .map(channel => channel.name)
        .join(', ');
      let message = ctx.i18n.t('channels') + ': ' + channels + '\n\n';
      message += ctx.i18n.t('wizard_community_one_or_two_channels') + '\n\n';
      message += ctx.i18n.t('wizard_to_exit');
      await ctx.reply(message);

      return ctx.wizard.next();
    } catch (error) {
      logger.error(error);
      ctx.scene.leave();
    }
  },
  async ctx => {
    try {
      if (ctx.message === undefined) return ctx.scene.leave();

      const chan = itemsFromMessage(ctx.message.text);
      if (chan.length > 2)
        await ctx.reply(ctx.i18n.t('wizard_community_one_or_two_channels'));

      const { community, bot, user } = ctx.wizard.state;

      const orderChannels = [];
      if (chan.length === 1) {
        if (!(await isGroupAdmin(chan[0], user, bot.telegram)))
          return await wizardCommunityWrongPermission(ctx, user, chan[0]);

        const channel = {
          name: chan[0],
          type: 'mixed',
        };
        orderChannels.push(channel);
      } else {
        if (!(await isGroupAdmin(chan[0], user, bot.telegram)))
          return await wizardCommunityWrongPermission(ctx, user, chan[0]);

        if (!(await isGroupAdmin(chan[1], user, bot.telegram)))
          return await wizardCommunityWrongPermission(ctx, user, chan[1]);

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
      await ctx.reply(ctx.i18n.t('operation_successful'));

      return ctx.scene.leave();
    } catch (error) {
      logger.error(error);
      ctx.scene.leave();
    }
  }
);

exports.updateSolversCommunityWizard = new Scenes.WizardScene(
  'UPDATE_SOLVERS_COMMUNITY_WIZARD_SCENE_ID',
  async ctx => {
    try {
      const { community } = ctx.wizard.state;
      const solvers = community.solvers
        .map(solver => '@' + solver.username)
        .join(', ');
      let message = ctx.i18n.t('solvers') + ': ' + solvers + '\n\n';
      message += ctx.i18n.t('wizard_community_enter_solvers') + '\n\n';
      message += ctx.i18n.t('wizard_to_exit');
      await ctx.reply(message);

      return ctx.wizard.next();
    } catch (error) {
      logger.error(error);
      ctx.scene.leave();
    }
  },
  async ctx => {
    try {
      if (ctx.message === undefined) {
        return ctx.scene.leave();
      }

      const solvers = [];
      const usernames = itemsFromMessage(ctx.message.text);
      if (usernames.length > 0 && usernames.length < 10) {
        for (let i = 0; i < usernames.length; i++) {
          const username =
            usernames[i][0] == '@' ? usernames[i].slice(1) : usernames[i];
          const user = await User.findOne({ username });
          if (user) {
            solvers.push({
              id: user._id,
              username: user.username,
            });
          }
        }
      } else {
        await ctx.reply(ctx.i18n.t('wizard_community_must_enter_names'));
      }

      const { community } = ctx.wizard.state;

      community.solvers = solvers;
      await community.save();
      await ctx.reply(ctx.i18n.t('operation_successful'));

      return ctx.scene.leave();
    } catch (error) {
      logger.error(error);
      ctx.scene.leave();
    }
  }
);

exports.updateFeeCommunityWizard = new Scenes.WizardScene(
  'UPDATE_FEE_COMMUNITY_WIZARD_SCENE_ID',
  async ctx => {
    try {
      const { community } = ctx.wizard.state;
      let message = ctx.i18n.t('fee') + ': ' + community.fee + '\n\n';
      message += ctx.i18n.t('wizard_community_enter_fee_percent') + '\n\n';
      message += ctx.i18n.t('wizard_to_exit');
      await ctx.reply(message);

      return ctx.wizard.next();
    } catch (error) {
      logger.error(error);
      ctx.scene.leave();
    }
  },
  async ctx => {
    try {
      if (ctx.message === undefined) {
        return ctx.scene.leave();
      }

      const fee = ctx.message.text.trim();

      if (isNaN(fee)) {
        return await messages.mustBeANumber(ctx);
      }

      if (fee < 0 || fee > 100) {
        return await ctx.reply(ctx.i18n.t('wizard_community_wrong_percent'));
      }
      const { community } = ctx.wizard.state;

      community.fee = fee;
      await community.save();
      await ctx.reply(ctx.i18n.t('operation_successful'));

      return ctx.scene.leave();
    } catch (error) {
      logger.error(error);
      ctx.scene.leave();
    }
  }
);

exports.updateDisputeChannelCommunityWizard = new Scenes.WizardScene(
  'UPDATE_DISPUTE_CHANNEL_COMMUNITY_WIZARD_SCENE_ID',
  async ctx => {
    try {
      const { community } = ctx.wizard.state;
      let message =
        ctx.i18n.t('dispute_channel') +
        ': ' +
        community.dispute_channel +
        '\n\n';
      message += ctx.i18n.t('wizard_community_enter_solvers_channel') + '\n\n';
      message += ctx.i18n.t('wizard_to_exit');
      await ctx.reply(message);

      return ctx.wizard.next();
    } catch (error) {
      logger.error(error);
      ctx.scene.leave();
    }
  },
  async ctx => {
    try {
      if (ctx.message === undefined) return ctx.scene.leave();

      const channel = ctx.message.text.trim();

      const { community, bot, user } = ctx.wizard.state;
      if (!(await isGroupAdmin(channel, user, bot.telegram)))
        return await wizardCommunityWrongPermission(ctx, user, channel);

      community.dispute_channel = channel;
      await community.save();
      await ctx.reply(ctx.i18n.t('operation_successful'));

      return ctx.scene.leave();
    } catch (error) {
      logger.error(error);
      ctx.scene.leave();
    }
  }
);

exports.addEarningsInvoiceWizard = new Scenes.WizardScene(
  'ADD_EARNINGS_INVOICE_WIZARD_SCENE_ID',
  async ctx => {
    try {
      const { community } = ctx.wizard.state;
      if (community.earnings === 0) return ctx.scene.leave();

      await ctx.reply(
        ctx.i18n.t('send_me_lninvoice', { amount: community.earnings })
      );

      return ctx.wizard.next();
    } catch (error) {
      logger.error(error);
    }
  },
  async ctx => {
    try {
      if (ctx.message === undefined) return ctx.scene.leave();
      const lnInvoice = ctx.message.text.trim();
      const { community } = ctx.wizard.state;

      const res = await isValidInvoice(ctx, lnInvoice);
      if (!res.success) return;

      if (!!res.invoice.tokens && res.invoice.tokens !== community.earnings)
        return await ctx.reply(ctx.i18n.t('invoice_with_incorrect_amount'));

      const isScheduled = await PendingPayment.findOne({
        community_id: community._id,
        attempts: { $lt: process.env.PAYMENT_ATTEMPTS },
        paid: false,
      });
      // We check if the payment is on flight
      const isPending = await isPendingPayment(lnInvoice);

      if (!!isScheduled || !!isPending)
        return await ctx.reply(ctx.i18n.t('invoice_already_being_paid'));

      const user = await User.findById(community.creator_id);
      logger.debug(`Creating pending payment for community ${community.id}`);
      const pp = new PendingPayment({
        amount: community.earnings,
        payment_request: lnInvoice,
        user_id: user.id,
        community_id: community._id,
        description: `Retiro por admin @${user.username}`,
        hash: res.invoice.hash,
      });
      await pp.save();
      await ctx.reply(ctx.i18n.t('invoice_updated_and_will_be_paid'));

      return ctx.scene.leave();
    } catch (error) {
      logger.error(error);
      ctx.scene.leave();
    }
  }
);
