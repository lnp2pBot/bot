const { Scenes } = require('telegraf');
const logger = require('../../../logger');
const { Community, User } = require('../../../models');
const { isGroupAdmin, itemsFromMessage } = require('../../../util');
const messages = require('../../messages');
const { createCommunityWizardStatus } = require('./messages');

const communityWizard = (exports.communityWizard = new Scenes.WizardScene(
  'COMMUNITY_WIZARD_SCENE_ID',
  async ctx => {
    try {
      if (ctx.message === undefined) {
        return ctx.scene.leave();
      }

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

      await messages.wizardCommunityCreatedMessage(ctx);
      return ctx.scene.leave();
    } catch (error) {
      logger.error(error);
      ctx.scene.leave();
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

communityWizard.command('/exit', async ctx => {
  await messages.wizardExitMessage(ctx);
  return ctx.scene.leave();
});

const createCommunitySteps = {
  async name(ctx) {
    const prompt = await createCommunityPrompts.name(ctx);

    ctx.wizard.state.handler = async ctx => {
      ctx.wizard.state.error = null;
      const name = ctx.message.text.trim();
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
      ctx.wizard.state.error = null;
      let currencies = itemsFromMessage(ctx.message.text);
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
        ctx.wizard.state.error = null;
        const { bot, user } = ctx.wizard.state;
        const group = ctx.message.text.trim();
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
      if (!text) return;
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
      if (!text) return;
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
      if (!text) return;
      const solvers = [];
      const usernames = itemsFromMessage(text);
      if (usernames.length > 0 && usernames.length < 10) {
        for (let i = 0; i < usernames.length; i++) {
          const user = await User.findOne({ username: usernames[i] });
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
      if (!text) return;
      const { bot, user } = ctx.wizard.state;
      if (text < 0 || text > 100) {
        return await messages.wizardCommunityWrongPercentFeeMessage(ctx);
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

const updateNameCommunityWizard = (exports.updateNameCommunityWizard =
  new Scenes.WizardScene(
    'UPDATE_NAME_COMMUNITY_WIZARD_SCENE_ID',
    async ctx => {
      try {
        await messages.wizardCommunityEnterNameMessage(ctx);

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

        const name = ctx.message.text.trim();
        if (name === 'exit') {
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
        const community = await Community.findOne({
          _id: id,
          creator_id: user._id,
        });
        if (!community) {
          throw new Error(
            'Community not found in UPDATE_NAME_COMMUNITY_WIZARD_SCENE_ID'
          );
        }
        community.name = name;
        await community.save();
        await messages.operationSuccessfulMessage(ctx);

        return ctx.scene.leave();
      } catch (error) {
        logger.error(error);
        ctx.scene.leave();
      }
    }
  ));

updateNameCommunityWizard.command('/exit', async ctx => {
  await messages.wizardExitMessage(ctx);
  return ctx.scene.leave();
});

const updateGroupCommunityWizard = (exports.updateGroupCommunityWizard =
  new Scenes.WizardScene(
    'UPDATE_GROUP_COMMUNITY_WIZARD_SCENE_ID',
    async ctx => {
      try {
        await messages.wizardCommunityEnterGroupMessage(ctx);

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

        const group = ctx.message.text.trim();
        if (group === 'exit') {
          await messages.wizardExitMessage(ctx);
          return ctx.scene.leave();
        }
        const { id, bot, user } = ctx.wizard.state;
        if (!(await isGroupAdmin(group, user, bot.telegram))) {
          messages.wizardCommunityWrongPermission(ctx, user, group);
          return;
        }
        const community = await Community.findOne({
          _id: id,
          creator_id: user._id,
        });
        if (!community) {
          throw new Error(
            'Community not found in UPDATE_GROUP_COMMUNITY_WIZARD_SCENE_ID'
          );
        }
        community.group = group;
        await community.save();
        await messages.operationSuccessfulMessage(ctx);

        return ctx.scene.leave();
      } catch (error) {
        logger.error(error);
        ctx.scene.leave();
      }
    }
  ));

updateGroupCommunityWizard.command('/exit', async ctx => {
  await messages.wizardExitMessage(ctx);
  return ctx.scene.leave();
});

const updateCurrenciesCommunityWizard =
  (exports.updateCurrenciesCommunityWizard = new Scenes.WizardScene(
    'UPDATE_CURRENCIES_COMMUNITY_WIZARD_SCENE_ID',
    async ctx => {
      try {
        await messages.wizardCommunityEnterCurrencyMessage(ctx);

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

        if (ctx.message.text.trim() === 'exit') {
          await messages.wizardExitMessage(ctx);
          return ctx.scene.leave();
        }

        let currencies = itemsFromMessage(ctx.message.text);
        currencies = currencies.map(currency => currency.toUpperCase());
        if (currencies.length > 10) {
          await messages.wizardCommunityEnterCurrencyMessage(ctx);
          return;
        }

        const { id, user } = ctx.wizard.state;
        const community = await Community.findOne({
          _id: id,
          creator_id: user._id,
        });
        if (!community) {
          throw new Error(
            'Community not found in UPDATE_CURRENCIES_COMMUNITY_WIZARD_SCENE_ID'
          );
        }
        community.currencies = currencies;
        await community.save();
        await messages.operationSuccessfulMessage(ctx);

        return ctx.scene.leave();
      } catch (error) {
        logger.error(error);
        ctx.scene.leave();
      }
    }
  ));

updateCurrenciesCommunityWizard.command('/exit', async ctx => {
  await messages.wizardExitMessage(ctx);
  return ctx.scene.leave();
});

const updateChannelsCommunityWizard = (exports.updateChannelsCommunityWizard =
  new Scenes.WizardScene(
    'UPDATE_CHANNELS_COMMUNITY_WIZARD_SCENE_ID',
    async ctx => {
      try {
        await messages.wizardCommunityOneOrTwoChannelsMessage(ctx);

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

        if (ctx.message.text.trim() === 'exit') {
          await messages.wizardExitMessage(ctx);
          return ctx.scene.leave();
        }
        const chan = itemsFromMessage(ctx.message.text);
        if (chan.length > 2) {
          await messages.wizardCommunityOneOrTwoChannelsMessage(ctx);
          return;
        }

        const { id, bot, user } = ctx.wizard.state;
        const community = await Community.findOne({
          _id: id,
          creator_id: user._id,
        });
        if (!community) {
          throw new Error(
            'Community not found in UPDATE_CHANNELS_COMMUNITY_WIZARD_SCENE_ID'
          );
        }
        const orderChannels = [];
        if (chan.length === 1) {
          if (!(await isGroupAdmin(chan[0], user, bot.telegram))) {
            messages.wizardCommunityWrongPermission(ctx, user, chan[0]);
            return;
          }
          const channel = {
            name: chan[0],
            type: 'mixed',
          };
          orderChannels.push(channel);
        } else {
          if (!(await isGroupAdmin(chan[0], user, bot.telegram))) {
            messages.wizardCommunityWrongPermission(ctx, user, chan[0]);
            return;
          }
          if (!(await isGroupAdmin(chan[1], user, bot.telegram))) {
            messages.wizardCommunityWrongPermission(ctx, user, chan[1]);
            return;
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
        community.order_channels = orderChannels;
        await community.save();
        await messages.operationSuccessfulMessage(ctx);

        return ctx.scene.leave();
      } catch (error) {
        logger.error(error);
        ctx.scene.leave();
      }
    }
  ));

updateChannelsCommunityWizard.command('/exit', async ctx => {
  await messages.wizardExitMessage(ctx);
  return ctx.scene.leave();
});

const updateSolversCommunityWizard = (exports.updateSolversCommunityWizard =
  new Scenes.WizardScene(
    'UPDATE_SOLVERS_COMMUNITY_WIZARD_SCENE_ID',
    async ctx => {
      try {
        await messages.wizardCommunityEnterSolversMessage(ctx);

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

        if (ctx.message.text.trim() === 'exit') {
          await messages.wizardExitMessage(ctx);
          return ctx.scene.leave();
        }
        const solvers = [];
        const usernames = itemsFromMessage(ctx.message.text);
        if (usernames.length > 0 && usernames.length < 10) {
          for (let i = 0; i < usernames.length; i++) {
            const user = await User.findOne({ username: usernames[i] });
            if (user) {
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
        const community = await Community.findOne({
          _id: id,
          creator_id: user._id,
        });
        if (!community) {
          throw new Error(
            'Community not found in UPDATE_SOLVERS_COMMUNITY_WIZARD_SCENE_ID'
          );
        }
        community.solvers = solvers;
        await community.save();
        await messages.operationSuccessfulMessage(ctx);

        return ctx.scene.leave();
      } catch (error) {
        logger.error(error);
        ctx.scene.leave();
      }
    }
  ));

updateSolversCommunityWizard.command('/exit', async ctx => {
  await messages.wizardExitMessage(ctx);
  return ctx.scene.leave();
});

const updateFeeCommunityWizard = (exports.updateFeeCommunityWizard =
  new Scenes.WizardScene(
    'UPDATE_FEE_COMMUNITY_WIZARD_SCENE_ID',
    async ctx => {
      try {
        await messages.wizardCommunityEnterPercentFeeMessage(ctx);

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
        if (fee === 'exit') {
          await messages.wizardExitMessage(ctx);
          return ctx.scene.leave();
        }

        if (isNaN(fee)) {
          await messages.mustBeANumber(ctx);
          return;
        }

        if (fee < 0 || fee > 100) {
          await messages.wizardCommunityWrongPercentFeeMessage(ctx);
          return;
        }
        const { id, user } = ctx.wizard.state;
        const community = await Community.findOne({
          _id: id,
          creator_id: user._id,
        });
        if (!community) {
          throw new Error(
            'Community not found in UPDATE_FEE_COMMUNITY_WIZARD_SCENE_ID'
          );
        }
        community.fee = fee;
        await community.save();
        await messages.operationSuccessfulMessage(ctx);

        return ctx.scene.leave();
      } catch (error) {
        logger.error(error);
        ctx.scene.leave();
      }
    }
  ));

updateFeeCommunityWizard.command('/exit', async ctx => {
  await messages.wizardExitMessage(ctx);
  return ctx.scene.leave();
});

const updateDisputeChannelCommunityWizard =
  (exports.updateDisputeChannelCommunityWizard = new Scenes.WizardScene(
    'UPDATE_DISPUTE_CHANNEL_COMMUNITY_WIZARD_SCENE_ID',
    async ctx => {
      try {
        await createCommunityPrompts.disputeChannel(ctx);

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

        const channel = ctx.message.text.trim();
        if (channel === 'exit') {
          await messages.wizardExitMessage(ctx);
          return ctx.scene.leave();
        }
        const { id, bot, user } = ctx.wizard.state;
        if (!(await isGroupAdmin(channel, user, bot.telegram))) {
          return await messages.wizardCommunityWrongPermission(
            ctx,
            user,
            channel
          );
        }
        const community = await Community.findOne({
          _id: id,
          creator_id: user._id,
        });
        if (!community) {
          throw new Error(
            'Community not found in UPDATE_GROUP_COMMUNITY_WIZARD_SCENE_ID'
          );
        }
        community.dispute_channel = channel;
        await community.save();
        await messages.operationSuccessfulMessage(ctx);

        return ctx.scene.leave();
      } catch (error) {
        logger.error(error);
        ctx.scene.leave();
      }
    }
  ));

updateDisputeChannelCommunityWizard.command('/exit', async ctx => {
  await messages.wizardExitMessage(ctx);
  return ctx.scene.leave();
});
