import { Telegraf } from 'telegraf';
import { logger } from '../../../logger';
import { userMiddleware, superAdminMiddleware } from '../../middleware/user';
import * as actions from './actions';
import * as commands from './commands';
import {
  earningsMessage,
  updateCommunityMessage,
  sureMessage,
} from './messages';
import { CommunityContext } from './communityContext';
import * as Scenes from './scenes';

export const configure = (bot: Telegraf<CommunityContext>) => {
  bot.command('mycomm', userMiddleware, commands.communityAdmin);
  bot.command('mycomms', userMiddleware, commands.myComms);
  if (process.env.COMMUNITY_CREATION_ENABLED === 'true') {
    bot.command('community', userMiddleware, async ctx => {
      const { user } = ctx;

      const minOrders = parseInt(
        process.env.COMMUNITY_CREATION_MIN_ORDERS || '',
      );
      const minVolume = parseInt(
        process.env.COMMUNITY_CREATION_MIN_VOLUME || '',
      );
      const minDays = parseInt(
        process.env.COMMUNITY_CREATION_MIN_DAYS_USING_BOT || '',
      );
      const minReputation = parseFloat(
        process.env.COMMUNITY_CREATION_MIN_REPUTATION || '',
      );

      const daysUsing = Math.floor(
        (Date.now() - new Date(user.created_at).getTime()) / 86400000,
      );

      const meetsRequirements =
        (isNaN(minOrders) || user.trades_completed >= minOrders) &&
        (isNaN(minVolume) || user.volume_traded >= minVolume) &&
        (isNaN(minDays) || daysUsing >= minDays) &&
        (isNaN(minReputation) || user.total_rating >= minReputation);

      if (!meetsRequirements) {
        logger.error(
          `User ${user.tg_id} tried to create a community but does not meet the requirements - orders: ${user.trades_completed}, volume: ${user.volume_traded}, days: ${daysUsing}, reputation: ${user.total_rating}`,
        );
        return ctx.reply(ctx.i18n.t('community_creation_requirements_not_met'));
      }

      await ctx.scene.enter('COMMUNITY_WIZARD_SCENE_ID', {
        bot,
        user: ctx.user,
      });
    });
  }
  bot.command('setcomm', userMiddleware, commands.setComm);

  bot.action(
    /^updateCommunity_([0-9a-f]{24})$/,
    userMiddleware,
    updateCommunityMessage,
  );
  bot.action(/^editNameBtn_([0-9a-f]{24})$/, userMiddleware, async ctx => {
    await commands.updateCommunity(ctx, ctx.match[1], 'name');
  });
  bot.action(/^editFeeBtn_([0-9a-f]{24})$/, userMiddleware, async ctx => {
    await commands.updateCommunity(ctx, ctx.match[1], 'fee');
  });
  bot.action(
    /^editCurrenciesBtn_([0-9a-f]{24})$/,
    userMiddleware,
    async ctx => {
      await commands.updateCommunity(ctx, ctx.match[1], 'currencies');
    },
  );
  bot.action(/^editGroupBtn_([0-9a-f]{24})$/, userMiddleware, async ctx => {
    await commands.updateCommunity(ctx, ctx.match[1], 'group', bot);
  });
  bot.action(/^editChannelsBtn_([0-9a-f]{24})$/, userMiddleware, async ctx => {
    await commands.updateCommunity(ctx, ctx.match[1], 'channels', bot);
  });
  bot.action(/^editSolversBtn_([0-9a-f]{24})$/, userMiddleware, async ctx => {
    await commands.updateCommunity(ctx, ctx.match[1], 'solvers', bot);
  });
  bot.action(
    /^editDisputeChannelBtn_([0-9a-f]{24})$/,
    userMiddleware,
    async ctx => {
      await commands.updateCommunity(ctx, ctx.match[1], 'disputeChannel', bot);
    },
  );
  bot.action(/^editLanguageBtn_([0-9a-f]{24})$/, userMiddleware, async ctx => {
    await commands.updateCommunity(ctx, ctx.match[1], 'language');
  });
  bot.action(
    /^editPaymentMethodsBtn_([0-9a-f]{24})$/,
    userMiddleware,
    async ctx => {
      await commands.updateCommunity(ctx, ctx.match[1], 'payment_methods');
    },
  );

  bot.command(
    'disablecommunity',
    superAdminMiddleware,
    commands.disableCommunity,
  );
  bot.command(
    'enablecommunity',
    superAdminMiddleware,
    commands.enableCommunity,
  );

  bot.command('findcomms', userMiddleware, commands.findCommunity);
  bot.action(
    /^communityInfo_([0-9a-f]{24})$/,
    userMiddleware,
    actions.onCommunityInfo,
  );
  bot.action(
    /^setCommunity_([0-9a-f]{24})$/,
    userMiddleware,
    actions.onSetCommunity,
  );
  bot.action('doNothingBtn', userMiddleware, async ctx => {
    await ctx.deleteMessage();
  });
  bot.action(/^earningsBtn_([0-9a-f]{24})$/, userMiddleware, earningsMessage);
  bot.action(
    /^deleteCommunityAskBtn_([0-9a-f]{24})$/,
    userMiddleware,
    sureMessage,
  );
  bot.action(
    /^withdrawEarnings_([0-9a-f]{24})$/,
    userMiddleware,
    actions.withdrawEarnings,
  );
  bot.action(
    /^deleteCommunityBtn_([0-9a-f]{24})$/,
    userMiddleware,
    commands.deleteCommunity,
  );
  bot.action(
    /^changeVisibilityBtn_([0-9a-f]{24})$/,
    userMiddleware,
    commands.changeVisibility,
  );
};

export { Scenes };
