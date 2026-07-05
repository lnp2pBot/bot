import { Scenes } from 'telegraf';
import { logger } from '../../../logger';
import { ScheduledOrder } from '../../../models';
import { CommunityContext } from '../community/communityContext';
import { UserDocument } from '../../../models/user';
import * as messages from './messages';
import {
  getRepublishCount,
  minutesUntilNextRun,
  parseCustomDays,
  PRESET_DAYS,
} from './helpers';

export const SCHEDULE_ORDER = 'SCHEDULE_ORDER_WIZARD';

// Shape of the data carried in the wizard state for this scene.
interface ScheduleWizardState {
  user: UserDocument;
  scheduleType: string;
  amount: number;
  fiatAmount: number[];
  fiatCode: string;
  paymentMethod: string;
  priceMargin?: number | string;
  awaitingCustomDays?: boolean;
  days?: number[];
  hour?: number;
}

const getState = (ctx: CommunityContext) =>
  ctx.wizard.state as unknown as ScheduleWizardState;

export const scheduleOrderWizard = new Scenes.WizardScene<CommunityContext>(
  SCHEDULE_ORDER,
  // Step 0: runs on enter — ask for the days
  async (ctx: CommunityContext) => {
    try {
      await messages.askScheduleDays(ctx);
      return ctx.wizard.next();
    } catch (err) {
      logger.error(err);
      return ctx.scene.leave();
    }
  },
  // Step 1: handle day selection (preset buttons, custom button, or custom text)
  async (ctx: CommunityContext) => {
    try {
      const state = getState(ctx);

      // User pressed one of the day buttons
      const data = (ctx.callbackQuery as any)?.data as string | undefined;
      if (data) {
        await ctx.answerCbQuery();
        if (data === 'sched_custom') {
          state.awaitingCustomDays = true;
          await messages.askCustomDays(ctx);
          return; // stay on this step, waiting for the text
        }
        const presetKey = data.replace('sched_', '');
        if (Object.prototype.hasOwnProperty.call(PRESET_DAYS, presetKey)) {
          state.days = PRESET_DAYS[presetKey];
          await messages.askScheduleHour(ctx);
          return ctx.wizard.next();
        }
        return; // ignore other callbacks
      }

      // User typed the custom days
      if (state.awaitingCustomDays) {
        const text = (ctx.message as any)?.text?.trim();
        const days = text ? parseCustomDays(text) : null;
        if (!days) {
          await ctx.reply(ctx.i18n.t('invalid_days'));
          return; // stay, reprompt
        }
        state.days = days;
        await messages.askScheduleHour(ctx);
        return ctx.wizard.next();
      }
    } catch (err) {
      logger.error(err);
      return ctx.scene.leave();
    }
  },
  // Step 2: handle hour input (text)
  async (ctx: CommunityContext) => {
    try {
      const state = getState(ctx);
      const text = (ctx.message as any)?.text?.trim();
      const hour = parseInt(text, 10);
      if (isNaN(hour) || hour < 0 || hour > 23 || String(hour) !== text) {
        await ctx.reply(ctx.i18n.t('invalid_hour'));
        return; // stay, reprompt
      }
      state.hour = hour;
      await messages.askScheduleConfirm(ctx, {
        type: state.scheduleType,
        fiatAmount: state.fiatAmount,
        fiatCode: state.fiatCode,
        paymentMethod: state.paymentMethod,
        days: state.days!,
        hour: state.hour,
      });
      return ctx.wizard.next();
    } catch (err) {
      logger.error(err);
      return ctx.scene.leave();
    }
  },
  // Step 3: handle confirm / cancel buttons
  async (ctx: CommunityContext) => {
    try {
      const data = (ctx.callbackQuery as any)?.data as string | undefined;
      if (!data) return; // ignore stray text, wait for a button

      await ctx.answerCbQuery();

      if (data === 'sched_cancel') {
        await ctx.reply(ctx.i18n.t('schedule_creation_cancelled'));
        return ctx.scene.leave();
      }

      if (data !== 'sched_confirm') return;

      const state = getState(ctx);
      if (state.days === undefined || state.hour === undefined) {
        await ctx.reply(ctx.i18n.t('schedule_not_found'));
        return ctx.scene.leave();
      }

      const schedule = await ScheduledOrder.create({
        creator_id: state.user._id,
        type: state.scheduleType,
        amount: state.amount,
        fiat_amount: state.fiatAmount,
        fiat_code: state.fiatCode,
        payment_method: state.paymentMethod,
        price_margin: Number(state.priceMargin) || 0,
        days: state.days,
        hour: state.hour,
        republish_count: getRepublishCount(),
        active: true,
      });

      const minutesToPublish = minutesUntilNextRun(state.days, state.hour);
      logger.info(
        `ScheduledOrder ${schedule._id} created, next publication in ${minutesToPublish} minutes`,
      );

      await ctx.reply(
        ctx.i18n.t('schedule_created', { scheduleId: schedule._id }),
      );
      return ctx.scene.leave();
    } catch (err) {
      logger.error(err);
      return ctx.scene.leave();
    }
  },
);
