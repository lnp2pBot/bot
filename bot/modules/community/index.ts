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
import {
  getCommunityThresholds,
  meetsCommunityCreationRequirements,
} from './requirements';

export const configure = (bot: Telegraf<CommunityContext>) => {
  bot.command('mycomm', userMiddleware, commands.communityAdmin);
  bot.command('mycomms', userMiddleware, commands.myComms);
  if (process.env.COMMUNITY_CREATION_ENABLED === 'true') {
    // Parsing of these values only happens once, they are not reparsed every time a user wants to create a new community
    const { invalidEnvVars, minOrders, minVolume, minDays, minReputation } =
      getCommunityThresholds();

    bot.command('community', userMiddleware, async ctx => {
      const { user } = ctx;

      if (invalidEnvVars.length > 0) {
        logger.error(
          `Community creation is failing due to a misconfiguration in initialization time: ${invalidEnvVars.join(', ')}`,
        );
        return ctx.reply(ctx.i18n.t('generic_error'));
      }

      const { meets, daysUsing, hasInvalidDate } =
        meetsCommunityCreationRequirements(
          {
            tg_id: user.tg_id,
            trades_completed: user.trades_completed,
            volume_traded: user.volume_traded,
            total_rating: user.total_rating,
            created_at: user.created_at,
          },
          {
            minOrders,
            minVolume,
            minDays,
            minReputation,
          },
        );

      if (hasInvalidDate) {
        logger.error(
          `User ${user.tg_id} has invalid created_at timestamp: ${user.created_at}`,
        );
        return ctx.reply(ctx.i18n.t('generic_error'));
      }

      if (!meets) {
        logger.warning(
          `User ${user.tg_id} tried to create a community but does not meet the requirements - orders: ${user.trades_completed}, volume: ${user.volume_traded}, days: ${daysUsing}, reputation: ${user.total_rating}`,
        );

        // Build the message dynamically based on active thresholds
        const lines = [
          ctx.i18n.t('community_creation_requirements_not_met_header'),
        ];
        if (minOrders !== null) {
          lines.push(
            ctx.i18n.t('community_creation_requirements_not_met_orders', {
              userOrders: user.trades_completed,
              requiredOrders: minOrders,
            }),
          );
        }
        if (minVolume !== null) {
          lines.push(
            ctx.i18n.t('community_creation_requirements_not_met_volume', {
              userVolume: user.volume_traded,
              requiredVolume: minVolume,
            }),
          );
        }
        if (minDays !== null) {
          lines.push(
            ctx.i18n.t('community_creation_requirements_not_met_days', {
              userDays: daysUsing,
              requiredDays: minDays,
            }),
          );
        }
        if (minReputation !== null) {
          lines.push(
            ctx.i18n.t('community_creation_requirements_not_met_rep', {
              userRep: user.total_rating.toFixed(2),
              requiredRep: minReputation,
            }),
          );
        }

        return ctx.reply(lines.join('\n'));
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
