import { Scenes } from 'telegraf';
import { Community } from '../../../../models';
import { getLanguageFlag } from '../../../../util';
import * as NostrLib from '../../nostr/lib';
import {
  CommunityContext,
  CommunityWizardState,
} from '../../community/communityContext';
import { Message } from 'telegraf/typings/core/types/typegram';
import { logger } from '../../../../logger';

const isNonNegativeInt = (n: number) => Number.isInteger(n) && n >= 0;

const readNonNegativeInt = (value: string | undefined, fallback: number) => {
  if (value === undefined || value.trim() === '') return fallback;
  const parsed = Number(value);
  return isNonNegativeInt(parsed) ? parsed : fallback;
};

const DEFAULT_COUNTERPARTY_REQUIREMENTS = {
  min_days_using_bot: 0,
  min_completed_orders: 0,
};

// Fallback caps when the corresponding MAX_COUNTERPARTY_* env vars are unset,
// mirroring the values documented in .env-sample.
const DEFAULT_MAX_COUNTERPARTY_AGE = 30;
const DEFAULT_MAX_COUNTERPARTY_ORDERS = 10;

function make() {
  const resetMessage = async (ctx: CommunityContext, next: () => void) => {
    const state = ctx.scene.state as CommunityWizardState;
    // Re-render without the previous feedback/error line so the next
    // updateMessage always differs from the displayed text; otherwise
    // repeating a command with the same value would be silently skipped
    // by the messageChanged guard, leaving the user with no acknowledgement.
    if (state.feedback || state.error) {
      delete state.feedback;
      delete state.error;
      await updateMessage(ctx);
    }
    next();
  };
  async function mainData(ctx: CommunityContext) {
    const state = ctx.scene.state as CommunityWizardState;
    const { user } = state;
    const data = {
      user,
      language: getLanguageFlag(state.language),
      npub: '',
      community: '',
      lightning_address: '',
      min_days_using_bot:
        user.counterparty_requirements?.min_days_using_bot ?? 0,
      min_completed_orders:
        user.counterparty_requirements?.min_completed_orders ?? 0,
    };
    if (user.default_community_id) {
      const community = await Community.findOne({
        _id: user.default_community_id,
        enabled: { $ne: false },
      });
      if (community) data.community = community.group;
    }
    if (user.nostr_public_key) {
      data.npub = NostrLib.encodeNpub(user.nostr_public_key);
    }

    if (user.lightning_address) {
      data.lightning_address = user.lightning_address;
    }

    return data;
  }
  async function updateMessage(ctx: CommunityContext) {
    try {
      const state = ctx.scene.state as CommunityWizardState;
      ctx.i18n.locale(state.language); // i18n locale resets if user executes unknown action
      const { message, error } = state;

      if (message === undefined) throw new Error('message is undefined');

      const errorText = (error => {
        if (!error) return;
        return '<strong>⚠️ ERROR</strong>\n' + ctx.i18n.t(error.i18n, error);
      })(error);
      const feedbackText = (feedback => {
        if (!feedback) return;
        if (typeof feedback === 'string') return feedback;
        return ctx.i18n.t(feedback.i18n, feedback);
      })(state.feedback);
      const extras = [errorText, feedbackText].filter(e => e);

      const main = ctx.i18n.t('user_settings', await mainData(ctx));
      const str = [main, ...extras].filter(e => e).join('\n');

      const messageChanged = str !== message.text;
      if (!messageChanged) return;

      const msg = await ctx.telegram.editMessageText(
        message.chat.id,
        message.message_id,
        undefined,
        str,
        {
          parse_mode: 'HTML',
          link_preview_options: { is_disabled: true },
        } as any,
      );
      state.message = msg as Message.TextMessage;
      state.message.text = str;
    } catch (err) {}
  }
  async function initHandler(ctx: CommunityContext) {
    try {
      const state = ctx.scene.state as CommunityWizardState;
      const { user } = state;
      state.language = user.lang || ctx.from?.language_code;
      const str = ctx.i18n.t('user_settings', await mainData(ctx));
      const msg = await ctx.reply(str, { parse_mode: 'HTML' });
      state.message = msg;
      state.message.text = str;
    } catch (err) {}
  }
  const scene = new Scenes.WizardScene(
    'USER_SETTINGS',
    async (ctx: CommunityContext) => {
      const state = ctx.scene.state as CommunityWizardState;
      ctx.user = state.user;
      if (!state.message) return initHandler(ctx);
      await ctx.deleteMessage();
      state.error = {
        i18n: 'generic_error',
      };
      await updateMessage(ctx);
    },
  );

  scene.command('/setnpub', resetMessage, async (ctx: CommunityContext) => {
    try {
      await ctx.deleteMessage();
      const state = ctx.scene.state as CommunityWizardState;
      if (ctx.message === undefined)
        throw new Error('ctx.message is undefined');
      const [, npub] = ctx.message.text.trim().split(' ');
      const hex = NostrLib.decodeNpub(npub);
      if (!hex) throw new Error('NpubNotValid');
      const user = state.user;
      user.nostr_public_key = hex;
      await user.save();
      state.feedback = {
        i18n: 'user_npub_updated',
        npub,
      };
      await updateMessage(ctx);
    } catch (err) {
      (ctx.scene.state as CommunityWizardState).error = {
        i18n: 'npub_not_valid',
      };
      await updateMessage(ctx);
    }
  });

  // counterpartyage and counterpartyorders only differ in the field they set,
  // the env cap, its fallback, and the feedback key/param, so we build both
  // from a single factory.
  const makeRequirementCommand = ({
    command,
    envVar,
    fallbackMax,
    field,
    feedbackKey,
    paramKey,
  }: {
    command: string;
    envVar: string;
    fallbackMax: number;
    field: 'min_days_using_bot' | 'min_completed_orders';
    feedbackKey: string;
    paramKey: string;
  }) => {
    scene.command(command, resetMessage, async (ctx: CommunityContext) => {
      try {
        await ctx.deleteMessage();
        const state = ctx.scene.state as CommunityWizardState;
        if (ctx.message === undefined || !('text' in ctx.message))
          throw new Error('ctx.message is undefined');
        // Split on runs of whitespace: with split(' ') a double space would
        // bind value to '' and Number('') === 0 silently disables the rule.
        const [, value] = ctx.message.text.trim().split(/\s+/);
        const parsed = Number(value);
        if (!isNonNegativeInt(parsed)) throw new Error('NotValidNumber');
        const max = readNonNegativeInt(process.env[envVar], fallbackMax);
        if (parsed > max) {
          state.error = {
            i18n: 'invalid_range',
            command: '/' + command,
            max,
          };
          return await updateMessage(ctx);
        }
        const user = state.user;
        if (!user.counterparty_requirements) {
          user.counterparty_requirements = {
            ...DEFAULT_COUNTERPARTY_REQUIREMENTS,
          };
        }
        user.counterparty_requirements[field] = parsed;
        await user.save();
        state.feedback = { i18n: feedbackKey, [paramKey]: parsed };
        await updateMessage(ctx);
      } catch (err) {
        logger.error(err);
        (ctx.scene.state as CommunityWizardState).error = {
          i18n:
            err instanceof Error && err.message === 'NotValidNumber'
              ? 'invalid_number'
              : 'generic_error',
        };
        await updateMessage(ctx);
      }
    });
  };

  makeRequirementCommand({
    command: 'counterpartyage',
    envVar: 'MAX_COUNTERPARTY_AGE_REQUIREMENT',
    fallbackMax: DEFAULT_MAX_COUNTERPARTY_AGE,
    field: 'min_days_using_bot',
    feedbackKey: 'counterpartyage_updated',
    paramKey: 'days',
  });

  makeRequirementCommand({
    command: 'counterpartyorders',
    envVar: 'MAX_COUNTERPARTY_ORDERS_REQUIREMENT',
    fallbackMax: DEFAULT_MAX_COUNTERPARTY_ORDERS,
    field: 'min_completed_orders',
    feedbackKey: 'counterpartyorders_updated',
    paramKey: 'orders',
  });

  scene.command(
    'resetrequirements',
    resetMessage,
    async (ctx: CommunityContext) => {
      try {
        await ctx.deleteMessage();
        const state = ctx.scene.state as CommunityWizardState;
        const user = state.user;
        // Unset the field instead of storing zeros so "no requirements"
        // keeps a single canonical representation (undefined), matching the
        // fast path in meetsCounterpartyRequirements.
        user.counterparty_requirements = undefined;
        await user.save();
        state.feedback = { i18n: 'requirements_reset' };
        await updateMessage(ctx);
      } catch (err) {
        logger.error(err);
        (ctx.scene.state as CommunityWizardState).error = {
          i18n: 'generic_error',
        };
        await updateMessage(ctx);
      }
    },
  );

  return scene;
}

export default make();
