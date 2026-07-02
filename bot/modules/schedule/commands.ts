import { Types } from 'mongoose';
import { CommunityContext } from '../community/communityContext';
import { ScheduledOrder } from '../../../models';
import { validateSellOrder, validateBuyOrder } from '../../validations';
import { getCurrency } from '../../../util';
import { logger } from '../../../logger';
import { SCHEDULE_ORDER } from './scenes';

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
