import { Order, ScheduledOrder } from '../../../models';
import { UserDocument } from '../../../models/user';

const REPUBLISH_DAYS_DEFAULT = 10;

export const getRepublishCount = (): number => {
  const raw = parseInt(process.env.REPUBLISH_ORDER_DAYS || '');
  return Number.isInteger(raw) && raw > 0 ? raw : REPUBLISH_DAYS_DEFAULT;
};

// English day names (full and abbreviated) mapped to getUTCDay() values (0=Sun..6=Sat)
const DAY_ALIASES: Record<string, number> = {
  sunday: 0,
  sun: 0,
  monday: 1,
  mon: 1,
  tuesday: 2,
  tue: 2,
  wednesday: 3,
  wed: 3,
  thursday: 4,
  thu: 4,
  friday: 5,
  fri: 5,
  saturday: 6,
  sat: 6,
};

// Parses a comma/space separated list of English day names into sorted UTC
// weekday values (0-6). Returns null if any token is unrecognized.
export const parseCustomDays = (input: string): number[] | null => {
  const parts = input
    .toLowerCase()
    .split(/[,\s]+/)
    .filter(Boolean);
  if (parts.length === 0) return null;
  const days = new Set<number>();
  for (const part of parts) {
    const dayNum = DAY_ALIASES[part];
    // Guard against inherited Object.prototype keys (e.g. "constructor",
    // "toString") which would resolve to a function instead of undefined.
    if (typeof dayNum !== 'number') return null;
    days.add(dayNum);
  }
  return [...days].sort((a, b) => a - b);
};

export const PRESET_DAYS: Record<string, number[]> = {
  daily: [0, 1, 2, 3, 4, 5, 6],
  weekdays: [1, 2, 3, 4, 5],
  weekend: [0, 6],
};

const envNumber = (raw: string | undefined, fallback: number): number => {
  const value = Number(raw);
  return Number.isFinite(value) ? value : fallback;
};

export interface ScheduleRequirementResult {
  ok: boolean;
  messageKey?: string;
  params?: Record<string, unknown>;
}

// Gates the creation of scheduled orders to prevent spam and UX degradation:
// only trusted, active makers with a good completion rate should be allowed to
// publish orders automatically. All thresholds are configurable via env.
export const checkScheduleRequirements = async (
  user: UserDocument,
): Promise<ScheduleRequirementResult> => {
  const maxPerUser = envNumber(process.env.SCHEDULE_MAX_PER_USER, 3);
  const minAgeDays = envNumber(process.env.SCHEDULE_MIN_ACCOUNT_AGE_DAYS, 7);
  const minCompleted = envNumber(process.env.SCHEDULE_MIN_COMPLETED_ORDERS, 5);
  const minVolume = envNumber(process.env.SCHEDULE_MIN_VOLUME, 0);
  const minRating = envNumber(process.env.SCHEDULE_MIN_RATING, 4);
  const minCompletionRate = envNumber(
    process.env.SCHEDULE_MIN_COMPLETION_RATE,
    0.9,
  );

  // Hard limit on how many active schedules a user can hold at once.
  const activeCount = await ScheduledOrder.countDocuments({
    creator_id: user._id,
    active: true,
  });
  if (activeCount >= maxPerUser) {
    return {
      ok: false,
      messageKey: 'schedule_req_max_reached',
      params: { max: maxPerUser },
    };
  }

  // Minimal account age (days using the bot).
  const ageDays =
    (Date.now() - new Date(user.created_at).getTime()) / (1000 * 60 * 60 * 24);
  if (ageDays < minAgeDays) {
    return {
      ok: false,
      messageKey: 'schedule_req_account_age',
      params: { days: minAgeDays },
    };
  }

  // Minimum number of completed trades.
  if (user.trades_completed < minCompleted) {
    return {
      ok: false,
      messageKey: 'schedule_req_completed_orders',
      params: { count: minCompleted },
    };
  }

  // Minimum traded volume (skipped when threshold is 0).
  if (minVolume > 0 && user.volume_traded < minVolume) {
    return {
      ok: false,
      messageKey: 'schedule_req_volume',
      params: { volume: minVolume },
    };
  }

  // Minimum reputation, only enforced once the user has received reviews.
  if (
    minRating > 0 &&
    user.total_reviews > 0 &&
    user.total_rating < minRating
  ) {
    return {
      ok: false,
      messageKey: 'schedule_req_rating',
      params: { rating: minRating },
    };
  }

  // Completion rate: successfully finished orders over the orders that were
  // actually taken (taken_at set). Orders that expired in PENDING without a
  // taker are excluded (they never wasted anyone's time), so this measures how
  // often the maker follows through once a counterparty commits — which is what
  // matters for auto-published orders.
  const takenOrders = await Order.countDocuments({
    creator_id: user._id,
    taken_at: { $ne: null },
  });
  if (takenOrders > 0) {
    const successOrders = await Order.countDocuments({
      creator_id: user._id,
      status: 'SUCCESS',
    });
    const rate = successOrders / takenOrders;
    if (rate < minCompletionRate) {
      return {
        ok: false,
        messageKey: 'schedule_req_completion_rate',
        params: {
          rate: Math.round(minCompletionRate * 100),
          current: Math.round(rate * 100),
        },
      };
    }
  }

  return { ok: true };
};

// Hard limit on how many of a maker's most recent taken orders may go
// uncompleted in a row before their schedules are removed as dormant.
export const getDormantLimit = (): number =>
  envNumber(process.env.SCHEDULE_MAX_CONSECUTIVE_UNCOMPLETED, 5);

// A maker is "dormant" when their last N taken orders all ended without
// success. Such a user keeps getting orders taken but never follows through, so
// their auto-published orders only waste takers' time. Returns false while
// there is not enough taken-order history to judge.
export const isDormantMaker = async (userId: string): Promise<boolean> => {
  const limit = getDormantLimit();
  if (limit <= 0) return false;

  const recent = await Order.find({
    creator_id: userId,
    taken_at: { $ne: null },
  })
    .sort({ taken_at: -1 })
    .limit(limit)
    .select('status');

  if (recent.length < limit) return false;
  return recent.every(order => order.status !== 'SUCCESS');
};
