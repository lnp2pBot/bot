import { MainContext } from '../../start';
import { PendingSchedule } from './commands';

const DAY_LABELS: Record<number, string> = {
  0: 'Sun',
  1: 'Mon',
  2: 'Tue',
  3: 'Wed',
  4: 'Thu',
  5: 'Fri',
  6: 'Sat',
};

const formatDays = (days: number[]): string =>
  days.map(d => DAY_LABELS[d]).join(', ');

export const askScheduleDays = async (ctx: MainContext) => {
  await ctx.reply(ctx.i18n.t('schedule_choose_days'), {
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: '📅 ' + ctx.i18n.t('sched_daily'),
            callback_data: 'sched_daily',
          },
          {
            text: '💼 ' + ctx.i18n.t('sched_weekdays'),
            callback_data: 'sched_weekdays',
          },
        ],
        [
          {
            text: '🌴 ' + ctx.i18n.t('sched_weekend'),
            callback_data: 'sched_weekend',
          },
          {
            text: '⚙️ ' + ctx.i18n.t('sched_custom'),
            callback_data: 'sched_custom',
          },
        ],
      ],
    },
  });
};

export const askCustomDays = async (ctx: MainContext) => {
  await ctx.reply(ctx.i18n.t('schedule_enter_custom_days'));
};

export const askScheduleHour = async (ctx: MainContext) => {
  await ctx.reply(ctx.i18n.t('schedule_enter_hour'));
};

export const askScheduleConfirm = async (
  ctx: MainContext,
  pending: PendingSchedule,
) => {
  const days = formatDays(pending.days!);
  const hour = String(pending.hour!).padStart(2, '0');
  const summary = ctx.i18n.t('schedule_confirm_summary', {
    type: pending.type.toUpperCase(),
    fiatAmount: pending.fiatAmount.join('-'),
    fiatCode: pending.fiatCode,
    paymentMethod: pending.paymentMethod,
    days,
    hour: `${hour}:00 UTC`,
  });

  await ctx.reply(summary, {
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: '✅ ' + ctx.i18n.t('continue'),
            callback_data: 'sched_confirm',
          },
          { text: '❌ ' + ctx.i18n.t('cancel'), callback_data: 'sched_cancel' },
        ],
      ],
    },
  });
};
