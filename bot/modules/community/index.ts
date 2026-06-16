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

      const parseOptionalNumber = (raw: string | undefined): { value: number | null, isValid: boolean } => {
        if (raw == null || raw.trim() === '') return { value: null, isValid: true };
        const n = Number(raw);
        if (Number.isFinite(n) && n >= 0) return { value: n, isValid: true };
        return { value: null, isValid: false };
      };

      const thresholdResults = {
        COMMUNITY_CREATION_MIN_ORDERS: parseOptionalNumber(
          process.env.COMMUNITY_CREATION_MIN_ORDERS,
        ),
        COMMUNITY_CREATION_MIN_VOLUME: parseOptionalNumber(
          process.env.COMMUNITY_CREATION_MIN_VOLUME,
        ),
        COMMUNITY_CREATION_MIN_DAYS_USING_BOT: parseOptionalNumber(
          process.env.COMMUNITY_CREATION_MIN_DAYS_USING_BOT,
        ),
        COMMUNITY_CREATION_MIN_REPUTATION: parseOptionalNumber(
          process.env.COMMUNITY_CREATION_MIN_REPUTATION,
        ),
      };

      const invalidEnvVars = Object.entries(thresholdResults)
        .filter(([_, res]) => !res.isValid)
        .map(([key]) => key);

      if (invalidEnvVars.length > 0) {
        logger.error(
          `Invalid COMMUNITY_CREATION_* threshold configuration: ${invalidEnvVars.join(', ')}`,
        );
        return ctx.reply(ctx.i18n.t('generic_error'));
      }

      const {
        COMMUNITY_CREATION_MIN_ORDERS: { value: minOrders },
        COMMUNITY_CREATION_MIN_VOLUME: { value: minVolume },
        COMMUNITY_CREATION_MIN_DAYS_USING_BOT: { value: minDays },
        COMMUNITY_CREATION_MIN_REPUTATION: { value: minReputation },
      } = thresholdResults;

      const daysUsing = Math.floor(
        (Date.now() - new Date(user.created_at).getTime()) / 86400000,
      );

      const meetsRequirements =
        (minOrders === null || user.trades_completed >= minOrders) &&
        (minVolume === null || user.volume_traded >= minVolume) &&
        (minDays === null || daysUsing >= minDays) &&
        (minReputation === null || user.total_rating >= minReputation);

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
