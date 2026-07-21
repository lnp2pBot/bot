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
  // Treat missing or blank/whitespace-only values as absent. Number('') is 0
  // (a finite number), which would otherwise silently disable env-gated checks.
  if (raw === undefined || raw.trim() === '') return fallback;
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

  // Recency: reject up front if the maker is dormant (no completed order in the
  // configured window) instead of creating a schedule that the publish job
  // would silently remove on its first run.
  if (await isDormantMaker(String(user._id))) {
    return {
      ok: false,
      messageKey: 'schedule_req_dormant',
      params: { days: getDormantDays() },
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

// Number of days a maker may go without completing any order before their
// schedules are removed as dormant.
export const getDormantDays = (): number =>
  envNumber(process.env.SCHEDULE_MAX_DAYS_WITHOUT_COMPLETION, 7);

// A maker is "dormant" when they have not successfully completed any order
// within the last N days. Such a user keeps auto-publishing orders they no
// longer follow through on, so their schedules only waste takers' time. We use
// taken_at as the completion proxy since taken orders resolve within ~27h.
// Returns false when the check is disabled (days <= 0).
export const isDormantMaker = async (userId: string): Promise<boolean> => {
  const days = getDormantDays();
  if (days <= 0) return false;

  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const recentSuccess = await Order.countDocuments({
    creator_id: userId,
    status: 'SUCCESS',
    taken_at: { $gte: since },
  });

  return recentSuccess === 0;
};
