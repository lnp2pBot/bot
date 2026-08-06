import { Types } from 'mongoose';
import { CommunityContext } from '../community/communityContext';
import { ScheduledOrder } from '../../../models';
import { validateSellOrder, validateBuyOrder } from '../../validations';
import { getCurrency, sanitizeMD } from '../../../util';
import { logger } from '../../../logger';
import { SCHEDULE_ORDER } from './scenes';
import { formatDays } from './messages';
import { checkScheduleRequirements } from './helpers';

export const scheduleorder = async (ctx: CommunityContext) => {
  try {
    // The scheduling flow is an interactive DM wizard
    if (ctx.message?.chat.type !== 'private') return;

    const text = (ctx.message as any)?.text || '';
    const [, type, ...rest] = text.trim().split(/\s+/);

    if (!type || !['buy', 'sell'].includes(type.toLowerCase())) {
      return ctx.reply(ctx.i18n.t('scheduleorder_usage'));
    }

    const orderType = type.toLowerCase();

    // Reuse the existing buy/sell validators by feeding them the order args
    if (!ctx.state) (ctx as any).state = {};
    if (!ctx.state.command) (ctx as any).state.command = {};
    ctx.state.command.args = rest;

    const params =
      orderType === 'sell'
        ? await validateSellOrder(ctx)
        : await validateBuyOrder(ctx);

    if (!params) return;

    if (!getCurrency(params.fiatCode)) {
      await ctx.reply(ctx.i18n.t('must_be_valid_currency'));
      return;
    }

    // Gate creation behind anti-spam requirements (limit, seniority, completion
    // rate, etc.) so only trusted makers can auto-publish orders.
    const requirement = await checkScheduleRequirements(ctx.user);
    if (!requirement.ok) {
      await ctx.reply(ctx.i18n.t(requirement.messageKey!, requirement.params));
      return;
    }

    await ctx.scene.enter(SCHEDULE_ORDER, {
      user: ctx.user,
      scheduleType: orderType,
      amount: params.amount,
      fiatAmount: params.fiatAmount,
      fiatCode: params.fiatCode,
      paymentMethod: params.paymentMethod,
      priceMargin: params.priceMargin,
    });
  } catch (error) {
    logger.error(error);
  }
};

export const cancelschedule = async (ctx: CommunityContext) => {
  try {
    // Schedule management must stay in the private DM to avoid leaking or
    // destroying schedule data from a group chat.
    if (ctx.message?.chat.type !== 'private') return;

    const user = ctx.user;
    const args = ctx.state?.command?.args || [];
    const scheduleId = args[0];

    if (!scheduleId || !Types.ObjectId.isValid(scheduleId)) {
      return ctx.reply(ctx.i18n.t('cancelschedule_usage'));
    }

    const schedule = await ScheduledOrder.findOne({
      _id: scheduleId,
      creator_id: user._id,
      active: true,
    });

    if (!schedule) {
      return ctx.reply(ctx.i18n.t('schedule_not_found'));
    }

    schedule.active = false;
    await schedule.save();

    await ctx.reply(ctx.i18n.t('schedule_cancelled', { scheduleId }));
  } catch (error) {
    logger.error(error);
  }
};

export const listschedules = async (ctx: CommunityContext) => {
  try {
    // Schedule management must stay in the private DM to avoid leaking or
    // destroying schedule data from a group chat.
    if (ctx.message?.chat.type !== 'private') return;

    const user = ctx.user;

    const schedules = await ScheduledOrder.find({
      creator_id: user._id,
      active: true,
    }).sort({ created_at: 1 });

    if (schedules.length === 0) {
      return ctx.reply(ctx.i18n.t('listschedules_empty'));
    }

    const items = schedules
      .map(schedule => {
        const hour = String(schedule.hour).padStart(2, '0');
        const typeKey = schedule.type === 'buy' ? 'buying' : 'selling';
        return ctx.i18n.t('schedule_list_item', {
          scheduleId: String(schedule._id),
          type: ctx.i18n.t(typeKey),
          fiatAmount: schedule.fiat_amount.join('-'),
          fiatCode: schedule.fiat_code,
          paymentMethod: sanitizeMD(schedule.payment_method),
          days: formatDays(schedule.days),
          hour: `${hour}:00 UTC`,
        });
      })
      .join('\n');

    await ctx.reply(`${ctx.i18n.t('listschedules_header')}\n\n${items}`, {
      parse_mode: 'Markdown',
    });
  } catch (error) {
    logger.error(error);
  }
};

export const cancelallschedules = async (ctx: CommunityContext) => {
  try {
    // Schedule management must stay in the private DM to avoid leaking or
    // destroying schedule data from a group chat.
    if (ctx.message?.chat.type !== 'private') return;

    const user = ctx.user;

    const result = await ScheduledOrder.updateMany(
      { creator_id: user._id, active: true },
      { active: false },
    );

    if (result.modifiedCount === 0) {
      return ctx.reply(ctx.i18n.t('cancelallschedules_none'));
    }

    await ctx.reply(
      ctx.i18n.t('all_schedules_cancelled', { count: result.modifiedCount }),
    );
  } catch (error) {
    logger.error(error);
  }
};
