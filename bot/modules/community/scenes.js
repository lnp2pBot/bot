const { Scenes } = require('telegraf');
const logger = require('../../../logger');
const { Community, User } = require('../../../models');
const { isGroupAdmin } = require('../../../util');
const messages = require('../../messages');

function itemsFromMessage(str) {
  return str
    .split(' ')
    .map(e => e.trim())
    .filter(e => !!e);
}

const communityWizard = (exports.communityWizard = new Scenes.WizardScene(
  'COMMUNITY_WIZARD_SCENE_ID',
  async ctx => {
    try {
      if (ctx.message === undefined) {
        return ctx.scene.leave();
      }

      await messages.wizardCommunityEnterNameMessage(ctx);
      ctx.wizard.state.community = {};

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
      ctx.wizard.state.community.name = name;
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
      ctx.wizard.state.community.currencies = currencies;
      await messages.wizardCommunityEnterGroupMessage(ctx);

      return ctx.wizard.next();
    } catch (error) {
      logger.error(error);
      ctx.scene.leave();
    }
  },
  async ctx => {
    try {
      const { bot, user } = ctx.wizard.state;
      if (ctx.message.text.trim() === 'exit') {
        await messages.wizardExitMessage(ctx);
        return ctx.scene.leave();
      }
      const group = ctx.message.text.trim();
      if (!(await isGroupAdmin(group, user, bot.telegram))) {
        messages.wizardCommunityWrongPermission(ctx, user, group);
        return;
      }
      ctx.wizard.state.community.group = group;
      ctx.wizard.state.community.creator_id = user._id;
      await messages.wizardCommunityEnterOrderChannelsMessage(ctx);

      return ctx.wizard.next();
    } catch (error) {
      ctx.reply(error.toString());
      ctx.scene.leave();
    }
  },
  async ctx => {
    try {
      const { bot, user } = ctx.wizard.state;
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

      ctx.wizard.state.community.order_channels = orderChannels;
      await messages.wizardCommunityEnterPercentFeeMessage(ctx);

      return ctx.wizard.next();
    } catch (error) {
      ctx.reply(error.toString());
      logger.error(error);
    }
  },
  async ctx => {
    try {
      if (ctx.message.text.trim() === 'exit') {
        await messages.wizardExitMessage(ctx);
        return ctx.scene.leave();
      }
      const percentFee = ctx.message.text.trim();
      if (percentFee < 0 || percentFee > 100) {
        await messages.wizardCommunityWrongPercentFeeMessage(ctx);
        return;
      }
      ctx.wizard.state.community.fee = percentFee;
      await messages.wizardCommunityEnterSolversMessage(ctx);

      return ctx.wizard.next();
    } catch (error) {
      ctx.reply(error.toString());
      ctx.scene.leave();
    }
  },
  async ctx => {
    try {
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
      ctx.wizard.state.community.solvers = solvers;
      await messages.wizardCommunityEnterSolversChannelMessage(ctx);

      return ctx.wizard.next();
    } catch (error) {
      ctx.reply(error.toString());
      ctx.scene.leave();
    }
  },
  async ctx => {
    try {
      const { bot, user, community } = ctx.wizard.state;
      const chan = ctx.message.text.trim();
      if (chan === 'exit') {
        await messages.wizardExitMessage(ctx);
        return ctx.scene.leave();
      }
      if (!(await isGroupAdmin(chan, user, bot.telegram))) {
        messages.wizardCommunityWrongPermission(ctx, user, chan);
        return;
      }
      community.dispute_channel = chan;

      const newCommunity = new Community(community);
      await newCommunity.save();
      await messages.wizardCommunityCreatedMessage(ctx);

      return ctx.scene.leave();
    } catch (error) {
      ctx.reply(error.toString());
      ctx.scene.leave();
    }
  }
));
communityWizard.command('/exit', async ctx => {
  await messages.wizardExitMessage(ctx);
  return ctx.scene.leave();
});
