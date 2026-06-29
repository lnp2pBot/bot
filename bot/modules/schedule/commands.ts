import { Telegraf } from 'telegraf';
import { MainContext } from '../../start';
import { ScheduledOrder } from '../../../models';
import { validateSellOrder, validateBuyOrder } from '../../validations';
import { getCurrency } from '../../../util';
import { logger } from '../../../logger';
import * as messages from './messages';

const REPUBLISH_DAYS_DEFAULT = 10;

const getRepublishCount = () => {
  const raw = parseInt(process.env.REPUBLISH_ORDER_DAYS || '');
  return Number.isInteger(raw) && raw > 0 ? raw : REPUBLISH_DAYS_DEFAULT;
};

// Day names (Spanish, English, abbreviated) mapped to getUTCDay() values (0=Sun)
const DAY_ALIASES: Record<string, number> = {
  domingo: 0,
  sunday: 0,
  sun: 0,
  dom: 0,
  lunes: 1,
  monday: 1,
  mon: 1,
  lun: 1,
  martes: 2,
  tuesday: 2,
  tue: 2,
  mar: 2,
  miercoles: 3,
  miércoles: 3,
  wednesday: 3,
  wed: 3,
  mie: 3,
  mié: 3,
  jueves: 4,
  thursday: 4,
  thu: 4,
  jue: 4,
  viernes: 5,
  friday: 5,
  fri: 5,
  vie: 5,
  sabado: 6,
  sábado: 6,
  saturday: 6,
  sat: 6,
  sab: 6,
  sáb: 6,
};

export const parseCustomDays = (input: string): number[] | null => {
  const parts = input
    .toLowerCase()
    .split(/[,\s]+/)
    .filter(Boolean);
  if (parts.length === 0) return null;
  const days = new Set<number>();
  for (const part of parts) {
    const normalized = part.normalize('NFD').replace(/[̀-ͯ]/g, '');
    const dayNum =
      DAY_ALIASES[part] ??
      DAY_ALIASES[normalized] ??
      DAY_ALIASES[
        part.replace(
          /[áéíóú]/g,
          c => ({ á: 'a', é: 'e', í: 'i', ó: 'o', ú: 'u' })[c] || c,
        )
      ];
    if (dayNum === undefined) return null;
    days.add(dayNum);
  }
  return [...days].sort();
};

// Presets
const PRESET_DAYS: Record<string, number[]> = {
  daily: [0, 1, 2, 3, 4, 5, 6],
  weekdays: [1, 2, 3, 4, 5],
  weekend: [0, 6],
};

export const scheduleorder = async (ctx: MainContext) => {
  try {
    const user = ctx.user;
    const text = (ctx.message as any)?.text || '';
    const [, type, ...rest] = text.trim().split(/\s+/);

    if (!type || !['buy', 'sell'].includes(type.toLowerCase())) {
      return ctx.reply(ctx.i18n.t('scheduleorder_usage'));
    }

    const orderType = type.toLowerCase();

    // Reuse existing validators by temporarily rewriting ctx.state.command.args
    const originalArgs = ctx.state?.command?.args;
    if (!ctx.state) (ctx as any).state = {};
    if (!ctx.state.command) (ctx as any).state.command = {};
    ctx.state.command.args = rest;

    const params =
      orderType === 'sell'
        ? await validateSellOrder(ctx)
        : await validateBuyOrder(ctx);

    ctx.state.command.args = originalArgs;

    if (!params) return;

    if (!getCurrency(params.fiatCode)) {
      await ctx.reply(ctx.i18n.t('must_be_valid_currency'));
      return;
    }

    // Store pending schedule params in session-like state via a temporary
    // message-level store keyed by user tg_id (in-memory, ephemeral)
    pendingSchedules.set(user.tg_id, {
      type: orderType,
      ...params,
    });

    await messages.askScheduleDays(ctx);
  } catch (error) {
    logger.error(error);
  }
};

export const cancelschedule = async (ctx: MainContext) => {
  try {
    const user = ctx.user;
    const args = ctx.state?.command?.args || [];
    const scheduleId = args[0];

    if (!scheduleId) {
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

// In-memory store for multi-step schedule creation flow
// (keyed by Telegram user id; entries live until confirmed or cancelled)
export interface PendingSchedule {
  type: string;
  amount: number;
  fiatAmount: number[];
  fiatCode: string;
  paymentMethod: string;
  priceMargin?: number;
  days?: number[];
  hour?: number;
}

export const pendingSchedules = new Map<string, PendingSchedule>();

export const handleScheduleCallback = async (
  ctx: MainContext,
  bot: Telegraf<any>,
) => {
  const data = (ctx.callbackQuery as any)?.data as string | undefined;
  if (!data?.startsWith('sched_')) return false;

  const user = ctx.user;
  const pending = pendingSchedules.get(user.tg_id);
  if (!pending) {
    await ctx.answerCbQuery();
    return true;
  }

  // --- Day selection step ---
  if (data === 'sched_daily') {
    pending.days = PRESET_DAYS.daily;
    pendingSchedules.set(user.tg_id, pending);
    await ctx.answerCbQuery();
    await messages.askScheduleHour(ctx);
    return true;
  }
  if (data === 'sched_weekdays') {
    pending.days = PRESET_DAYS.weekdays;
    pendingSchedules.set(user.tg_id, pending);
    await ctx.answerCbQuery();
    await messages.askScheduleHour(ctx);
    return true;
  }
  if (data === 'sched_weekend') {
    pending.days = PRESET_DAYS.weekend;
    pendingSchedules.set(user.tg_id, pending);
    await ctx.answerCbQuery();
    await messages.askScheduleHour(ctx);
    return true;
  }
  if (data === 'sched_custom') {
    pendingSchedules.set(user.tg_id, { ...pending, days: undefined });
    await ctx.answerCbQuery();
    await messages.askCustomDays(ctx);
    return true;
  }

  // --- Confirm / cancel ---
  if (data === 'sched_confirm') {
    await ctx.answerCbQuery();
    await confirmSchedule(ctx, bot);
    return true;
  }
  if (data === 'sched_cancel') {
    pendingSchedules.delete(user.tg_id);
    await ctx.answerCbQuery();
    await ctx.reply(ctx.i18n.t('schedule_creation_cancelled'));
    return true;
  }

  await ctx.answerCbQuery();
  return true;
};

export const handleScheduleText = async (
  ctx: MainContext,
  bot: Telegraf<any>,
): Promise<boolean> => {
  const user = ctx.user;
  const pending = pendingSchedules.get(user.tg_id);
  if (!pending) return false;

  const text = (ctx.message as any)?.text?.trim();
  if (!text) return false;

  // Waiting for custom days input
  if (pending.days === undefined) {
    const days = parseCustomDays(text);
    if (!days) {
      await ctx.reply(ctx.i18n.t('invalid_days'));
      return true;
    }
    pending.days = days;
    pendingSchedules.set(user.tg_id, pending);
    await messages.askScheduleHour(ctx);
    return true;
  }

  // Waiting for hour input
  if (pending.hour === undefined) {
    const hour = parseInt(text);
    if (isNaN(hour) || hour < 0 || hour > 23) {
      await ctx.reply(ctx.i18n.t('invalid_hour'));
      return true;
    }
    pending.hour = hour;
    pendingSchedules.set(user.tg_id, pending);
    await messages.askScheduleConfirm(ctx, pending);
    return true;
  }

  return false;
};

const confirmSchedule = async (ctx: MainContext, bot: Telegraf<any>) => {
  const user = ctx.user;
  const pending = pendingSchedules.get(user.tg_id);
  if (!pending || pending.days === undefined || pending.hour === undefined) {
    return ctx.reply(ctx.i18n.t('schedule_not_found'));
  }

  const schedule = await ScheduledOrder.create({
    creator_id: user._id,
    type: pending.type,
    amount: pending.amount,
    fiat_amount: pending.fiatAmount,
    fiat_code: pending.fiatCode,
    payment_method: pending.paymentMethod,
    price_margin: pending.priceMargin || 0,
    days: pending.days,
    hour: pending.hour,
    republish_count: getRepublishCount(),
    active: true,
  });

  pendingSchedules.delete(user.tg_id);

  await ctx.reply(ctx.i18n.t('schedule_created', { scheduleId: schedule._id }));
};
