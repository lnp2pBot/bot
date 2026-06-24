import { logger } from '../../../logger';

export interface ParsedThresholds {
  minOrders: number | null;
  minVolume: number | null;
  minDays: number | null;
  minReputation: number | null;
  invalidEnvVars: string[];
}

export interface UserMetrics {
  tg_id: string;
  trades_completed: number;
  volume_traded: number;
  total_rating: number;
  created_at: Date | string;
}

export const parseOptionalNumber = (
  raw: string | undefined,
): { value: number | null; isValid: boolean } => {
  if (raw == null || raw.trim() === '') return { value: null, isValid: true };
  const n = Number(raw);
  if (Number.isFinite(n) && n >= 0) return { value: n, isValid: true };
  return { value: null, isValid: false };
};

export const getCommunityThresholds = (): ParsedThresholds => {
  const thresholdResults = {
    COMMUNITY_CREATION_MIN_ORDERS: parseOptionalNumber(
      process.env.COMMUNITY_CREATION_MIN_ORDERS,
    ),
    COMMUNITY_CREATION_MIN_VOLUME_SATS: parseOptionalNumber(
      process.env.COMMUNITY_CREATION_MIN_VOLUME_SATS,
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
  }

  return {
    minOrders: thresholdResults.COMMUNITY_CREATION_MIN_ORDERS.value,
    minVolume: thresholdResults.COMMUNITY_CREATION_MIN_VOLUME_SATS.value,
    minDays: thresholdResults.COMMUNITY_CREATION_MIN_DAYS_USING_BOT.value,
    minReputation: thresholdResults.COMMUNITY_CREATION_MIN_REPUTATION.value,
    invalidEnvVars,
  };
};

export const meetsCommunityCreationRequirements = (
  user: UserMetrics,
  thresholds: Omit<ParsedThresholds, 'invalidEnvVars'>,
): { meets: boolean; daysUsing: number | null; hasInvalidDate: boolean } => {
  const createdAtTime = new Date(user.created_at).getTime();
  if (!Number.isFinite(createdAtTime)) {
    return { meets: false, daysUsing: null, hasInvalidDate: true };
  }

  const daysUsing = Math.floor((Date.now() - createdAtTime) / 86400000);
  const { minOrders, minVolume, minDays, minReputation } = thresholds;

  const meets =
    (minOrders === null || user.trades_completed >= minOrders) &&
    (minVolume === null || user.volume_traded >= minVolume) &&
    (minDays === null || daysUsing >= minDays) &&
    (minReputation === null || user.total_rating >= minReputation);

  return { meets, daysUsing, hasInvalidDate: false };
};
