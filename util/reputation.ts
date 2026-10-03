// Reputation export: lnp2pBot as an issuer of reputation attestations
// (kind 38388), so a user can carry the reputation earned here into a Mostro
// instance. See https://mostro.network/protocol/reputation_attestation.html
import { getPublicKey } from 'nostr-tools';
import { Order } from '../models';
import { UserDocument } from '../models/user';

/** Fewest completed trades an account needs to export its reputation. */
export const MIN_COMPLETED_TRADES = 10;
/** Fewest ratings received an account needs to export its reputation. */
export const MIN_RATINGS_RECEIVED = 5;
/** Lifetime of an attestation: 7 days. */
export const ATTESTATION_LIFETIME_SECS = 7 * 24 * 60 * 60;

const SECONDS_PER_DAY = 24 * 60 * 60;
const HEX_KEY = /^[0-9a-f]{64}$/;

/**
 * The issuer's dedicated signing key, from `REPUTATION_ISSUER_SK`.
 *
 * Returns `null` when the variable is unset or empty: the bot then does not
 * issue attestations. Throws when it is set but malformed, or when it is the
 * bot's `NOSTR_SK`: the issuer key is kept apart from the key that signs the
 * bot's public events, so either can be rotated without the other.
 */
export const loadIssuerKey = (
  env: Record<string, string | undefined> = process.env,
): Uint8Array | null => {
  const raw = (env.REPUTATION_ISSUER_SK || '').trim().toLowerCase();
  if (raw === '') return null;
  if (!HEX_KEY.test(raw)) {
    throw new Error(
      'REPUTATION_ISSUER_SK must be a 64-character hex secret key',
    );
  }
  if (raw === (env.NOSTR_SK || '').trim().toLowerCase()) {
    throw new Error(
      'REPUTATION_ISSUER_SK must not be the bot NOSTR_SK: use a dedicated key',
    );
  }
  const key = Uint8Array.from(Buffer.from(raw, 'hex'));
  try {
    getPublicKey(key);
  } catch (error) {
    throw new Error('REPUTATION_ISSUER_SK is not a valid secp256k1 key');
  }
  return key;
};

/** Start of the UTC day a moment falls in, in Unix seconds. */
export const dayTruncate = (date: Date): number => {
  const seconds = Math.floor(date.getTime() / 1000);
  return seconds - (seconds % SECONDS_PER_DAY);
};

/**
 * Whether an account may export its reputation: not banned, at least
 * {@link MIN_COMPLETED_TRADES} completed trades, at least
 * {@link MIN_RATINGS_RECEIVED} ratings received, and a first completed trade
 * on record (`firstTrade`, from {@link firstTradeSince}).
 */
export const isEligible = (
  user: Pick<UserDocument, 'banned' | 'trades_completed' | 'total_reviews'>,
  firstTrade: number | null,
): boolean =>
  !user.banned &&
  (user.trades_completed || 0) >= MIN_COMPLETED_TRADES &&
  (user.total_reviews || 0) >= MIN_RATINGS_RECEIVED &&
  firstTrade !== null;

/**
 * Day of the user's first completed trade, as the start of its UTC day in
 * Unix seconds, or `null` when no completed order is on record.
 *
 * A trade is dated from when it was taken, the moment it started; orders
 * from before that field existed fall back to their creation.
 */
export const firstTradeSince = async (
  user: Pick<UserDocument, '_id'>,
): Promise<number | null> => {
  const first = await Order.findOne({
    status: 'SUCCESS',
    $or: [{ buyer_id: user._id }, { seller_id: user._id }],
  })
    .sort({ created_at: 1 })
    .lean();
  if (!first) return null;
  const startedAt: Date = first.taken_at || first.created_at;
  return startedAt ? dayTruncate(new Date(startedAt)) : null;
};
