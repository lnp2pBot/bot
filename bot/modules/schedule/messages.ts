import { CommunityContext } from '../community/communityContext';

const DAY_LABELS: Record<number, string> = {
  0: 'Sun',
  1: 'Mon',
  2: 'Tue',
  3: 'Wed',
  4: 'Thu',
  5: 'Fri',
  6: 'Sat',
};

export const formatDays = (days: number[]): string =>
  days.map(d => DAY_LABELS[d]).join(', ');

export const askScheduleDays = async (ctx: CommunityContext) => {
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

export const askCustomDays = async (ctx: CommunityContext) => {
  await ctx.reply(ctx.i18n.t('schedule_enter_custom_days'));
};

export const askScheduleHour = async (ctx: CommunityContext) => {
  await ctx.reply(ctx.i18n.t('schedule_enter_hour'));
};

export const askScheduleConfirm = async (
  ctx: CommunityContext,
  summaryData: {
    type: string;
    fiatAmount: number[];
    fiatCode: string;
    paymentMethod: string;
    days: number[];
    hour: number;
  },
) => {
  const hour = String(summaryData.hour).padStart(2, '0');
  const typeKey = summaryData.type === 'buy' ? 'buying' : 'selling';
  const summary = ctx.i18n.t('schedule_confirm_summary', {
    type: ctx.i18n.t(typeKey),
    fiatAmount: summaryData.fiatAmount.join('-'),
    fiatCode: summaryData.fiatCode,
    paymentMethod: summaryData.paymentMethod,
    days: formatDays(summaryData.days),
    hour: `${hour}:00 UTC`,
  });

  await ctx.reply(summary, {
    parse_mode: 'Markdown',
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
