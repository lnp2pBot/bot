// Reputation export: a user carries the reputation earned on the bot into a
// Mostro instance. Their Mostro client opens
// `https://t.me/<bot>?start=rep_<identity>`, the bot asks them to confirm the
// identity the first time, binds the account to it, and answers with a signed
// attestation (kind 38388) the client imports. Works in sunset mode too, which
// is when users need it.
// https://mostro.network/protocol/reputation_attestation.html
import mongoose from 'mongoose';
import { Telegraf } from 'telegraf';
import { nip19 } from 'nostr-tools';
import { User } from '../../../models';
import { UserDocument } from '../../../models/user';
import { logger } from '../../../logger';
import {
  ATTESTATION_LIFETIME_SECS,
  dayTruncate,
  firstTradeSince,
  isEligible,
} from '../../../util/reputation';
import {
  buildAttestation,
  decodeIdentity,
  encodeIdentity,
  formatRating,
  ratingHundredths,
} from './attestation';

// mongoose.ConnectionStates.connected, inlined because that enum is types-only
const MONGO_CONNECTED_STATE = 1;
const START = /^\/start(?:@\w+)? rep_([A-Za-z0-9_-]{43})$/;
const CONFIRM = /^repok_([A-Za-z0-9_-]{43})$/;

/** What the export needs from the outside world; swapped in tests. */
export interface ReputationDeps {
  issuerKey: Uint8Array;
  now: () => number;
  dbReady: () => boolean;
  findUser: (tgId: string) => Promise<UserDocument | null>;
  /**
   * Atomically bind the account to `identity`: succeeds only if it is
   * unbound or already bound to that identity. Returns the updated account,
   * or `null` when another identity holds it.
   */
  bind: (
    user: UserDocument,
    identity: string,
    day: Date,
  ) => Promise<UserDocument | null>;
  firstTradeSince: (user: UserDocument) => Promise<number | null>;
}

export const defaultDeps = (issuerKey: Uint8Array): ReputationDeps => ({
  issuerKey,
  now: () => Math.floor(Date.now() / 1000),
  dbReady: () => mongoose.connection.readyState === MONGO_CONNECTED_STATE,
  findUser: tgId => User.findOne({ tg_id: tgId }),
  bind: (user, identity, day) =>
    User.findOneAndUpdate(
      {
        _id: user._id,
        $or: [
          { reputation_exported_to: null },
          { reputation_exported_to: identity },
        ],
      },
      {
        $set: { reputation_exported_to: identity, reputation_exported_at: day },
      },
      { new: true },
    ),
  firstTradeSince,
});

const npub = (hex: string): string => nip19.npubEncode(hex);

/** Look the requester up and check they may export at all. */
const eligibleUser = async (
  ctx: any,
  deps: ReputationDeps,
): Promise<{ user: UserDocument; firstTrade: number } | null> => {
  if (!deps.dbReady()) {
    await ctx.reply(ctx.i18n.t('reputation_unavailable'));
    return null;
  }
  const user = await deps.findUser(String(ctx.from.id));
  if (user?.lang) ctx.i18n.locale(user.lang);
  const firstTrade = user ? await deps.firstTradeSince(user) : null;
  if (!user || !isEligible(user, firstTrade)) {
    await ctx.reply(ctx.i18n.t('reputation_not_eligible'));
    return null;
  }
  return { user, firstTrade: firstTrade as number };
};

/** Sign the attestation for a bound account and hand it to the user. */
const issue = async (
  ctx: any,
  deps: ReputationDeps,
  user: UserDocument,
  identity: string,
  firstTrade: number,
): Promise<void> => {
  const createdAt = deps.now();
  const attestation = buildAttestation(deps.issuerKey, {
    destination: identity,
    subject: String(user._id),
    reviews: user.total_reviews,
    average: user.total_rating,
    since: firstTrade,
    createdAt,
    lifetime: ATTESTATION_LIFETIME_SECS,
  });
  logger.info(`reputation: issued attestation ${attestation.id}`);
  await ctx.reply(
    ctx.i18n.t('reputation_exported', {
      npub: npub(identity),
      reviews: user.total_reviews,
      rating: formatRating(ratingHundredths(user.total_rating) as number),
    }),
  );
  // On its own, with no formatting, so it can be copied whole into the app.
  await ctx.reply(JSON.stringify(attestation));
};

/** `/start rep_<identity>`: ask for confirmation, or issue straight away. */
export const handleStart = async (
  ctx: any,
  encoded: string,
  deps: ReputationDeps,
): Promise<void> => {
  const identity = decodeIdentity(encoded);
  if (identity === null) {
    await ctx.reply(ctx.i18n.t('reputation_invalid_link'));
    return;
  }
  const found = await eligibleUser(ctx, deps);
  if (!found) return;
  const { user, firstTrade } = found;
  const bound = user.reputation_exported_to;
  if (bound && bound !== identity) {
    await ctx.reply(
      ctx.i18n.t('reputation_bound_other', { npub: npub(bound) }),
    );
    return;
  }
  if (bound === identity) {
    await issue(ctx, deps, user, identity, firstTrade);
    return;
  }
  await ctx.reply(ctx.i18n.t('reputation_confirm', { npub: npub(identity) }), {
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: ctx.i18n.t('reputation_confirm_button'),
            callback_data: `repok_${encodeIdentity(identity)}`,
          },
        ],
      ],
    },
  });
};

/** The confirm button: bind atomically, then issue. */
export const handleConfirm = async (
  ctx: any,
  encoded: string,
  deps: ReputationDeps,
): Promise<void> => {
  const identity = decodeIdentity(encoded);
  if (identity === null) return;
  const found = await eligibleUser(ctx, deps);
  if (!found) return;
  const day = new Date(dayTruncate(new Date(deps.now() * 1000)) * 1000);
  const bound = await deps.bind(found.user, identity, day);
  if (!bound) {
    const current = await deps.findUser(String(ctx.from.id));
    await ctx.reply(
      ctx.i18n.t('reputation_bound_other', {
        npub: npub(current?.reputation_exported_to || identity),
      }),
    );
    return;
  }
  await issue(ctx, deps, bound, identity, found.firstTrade);
};

/**
 * Binding happens only in the user's private chat with the bot: in a group,
 * anyone could press the confirm button and bind their own account to an
 * identity someone else chose.
 */
const isPrivateChat = (ctx: any): boolean => ctx.chat?.type === 'private';

/** Log a failed step and tell the user, without letting the reply throw too. */
const fail = async (ctx: any, error: unknown): Promise<void> => {
  logger.error(`reputation: ${error}`);
  await ctx.reply(ctx.i18n.t('reputation_unavailable')).catch(() => {});
};

/**
 * Rate-limiter key: the sender, like the limiter's default, except that the
 * confirm button gets a bucket of its own so a press right after
 * `/start rep_` is not dropped as a repeat of it.
 */
export const limiterKey = (ctx: any): string | undefined => {
  if (ctx.from === undefined) return undefined;
  const sender = String(ctx.from.id);
  const data = ctx.callbackQuery?.data;
  return typeof data === 'string' && CONFIRM.test(data)
    ? `reputation_confirm:${sender}`
    : sender;
};

/**
 * Register the export. Must run before any middleware that answers every
 * update, sunset mode's included.
 */
export const configure = (bot: Telegraf<any>, deps: ReputationDeps): void => {
  bot.use(async (ctx: any, next: () => Promise<void>) => {
    const text = ctx.message?.text;
    const match = typeof text === 'string' ? START.exec(text) : null;
    if (!match || !isPrivateChat(ctx)) return next();
    try {
      await handleStart(ctx, match[1], deps);
    } catch (error) {
      await fail(ctx, error);
    }
  });
  bot.use(async (ctx: any, next: () => Promise<void>) => {
    const data = ctx.callbackQuery?.data;
    const match = typeof data === 'string' ? CONFIRM.exec(data) : null;
    if (!match) return next();
    try {
      await ctx.answerCbQuery?.();
      if (!isPrivateChat(ctx)) return;
      await handleConfirm(ctx, match[1], deps);
    } catch (error) {
      if (isPrivateChat(ctx)) await fail(ctx, error);
      else logger.error(`reputation: ${error}`);
    }
  });
};
