// Reputation export: a user carries the reputation earned on the bot into a
// Mostro instance. Their Mostro client opens
// `https://t.me/<bot>?start=rep_<identity>`, the bot asks them to confirm the
// identity the first time, binds the account to it, and answers with a signed
// attestation (kind 38388) the client imports. Works in sunset mode too, which
// is when users need it.
// https://mostro.network/protocol/reputation_attestation.html
import mongoose from 'mongoose';
import { Telegraf } from 'telegraf';
import { getPublicKey, nip19 } from 'nostr-tools';
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
  parseRebind,
  ratingHundredths,
  Rebind,
  REBIND_DOCUMENT,
} from './attestation';

// mongoose.ConnectionStates.connected, inlined because that enum is types-only
const MONGO_CONNECTED_STATE = 1;
const START = /^\/start(?:@\w+)? rep_([A-Za-z0-9_-]{43})$/;
const CONFIRM = /^repok_([A-Za-z0-9_-]{43})$/;
const REBIND_CONFIRM = 'reprb_ok';
const ADMIN_REBIND = /^\/reputation_rebind(?:@\w+)?(?:\s+(.*))?$/s;
const HEX_KEY = /^[0-9a-f]{64}$/;

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
  /**
   * Atomically move the binding from `from` to `to`: succeeds only while the
   * account is still bound to `from`. Returns the updated account, or `null`.
   */
  rebind: (
    user: UserDocument,
    from: string,
    to: string,
    day: Date,
  ) => Promise<UserDocument | null>;
  /** Look an account up by its internal id or Telegram id, for admins. */
  findAccount: (id: string) => Promise<UserDocument | null>;
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
  rebind: (user, from, to, day) =>
    User.findOneAndUpdate(
      { _id: user._id, reputation_exported_to: from },
      { $set: { reputation_exported_to: to, reputation_exported_at: day } },
      { new: true },
    ),
  findAccount: async id =>
    (await User.findOne({ tg_id: id })) ||
    (mongoose.isValidObjectId(id) ? await User.findById(id) : null),
});

const today = (deps: ReputationDeps): Date =>
  new Date(dayTruncate(new Date(deps.now() * 1000)) * 1000);

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
  // A rebind authorisation pasted next must name the identity asked for here.
  if (ctx.session) {
    ctx.session.reputationDestination =
      bound && bound !== identity ? identity : undefined;
  }
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
  const bound = await deps.bind(found.user, identity, today(deps));
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
 * Whether a parsed rebind authorisation applies here: it names this issuer,
 * is signed by the identity the account is bound to, and moves the binding to
 * the identity the user asked for (`destination`), so an authorisation for
 * one identity can never move the binding to another.
 */
export const rebindMatches = (
  rebind: Rebind,
  issuer: string,
  boundIdentity: string | null | undefined,
  destination: string | null | undefined,
): boolean =>
  rebind.issuer === issuer &&
  !!boundIdentity &&
  rebind.boundIdentity === boundIdentity &&
  !!destination &&
  rebind.newIdentity === destination;

/**
 * Check a pasted rebind authorisation against the account and the identity
 * last asked for with `/start rep_`: signed by the identity it is bound to,
 * for this issuer, naming that identity, still valid. Returns it, or `null`
 * after telling the user why not.
 */
const checkRebind = async (
  ctx: any,
  deps: ReputationDeps,
  user: UserDocument,
  text: string,
) => {
  let event: any = null;
  try {
    event = JSON.parse(text);
  } catch (error) {
    event = null;
  }
  const rebind = event ? parseRebind(event, deps.now()) : null;
  const valid =
    rebind !== null &&
    rebindMatches(
      rebind,
      getPublicKey(deps.issuerKey),
      user.reputation_exported_to,
      ctx.session?.reputationDestination,
    );
  if (!valid) {
    await ctx.reply(ctx.i18n.t('reputation_rebind_invalid'));
    return null;
  }
  return rebind;
};

/**
 * A pasted rebind authorisation: the identity the account is bound to
 * consents to moving it. Ask the user to confirm the new identity first.
 */
export const handleRebindPaste = async (
  ctx: any,
  text: string,
  deps: ReputationDeps,
): Promise<void> => {
  const found = await eligibleUser(ctx, deps);
  if (!found) return;
  const rebind = await checkRebind(ctx, deps, found.user, text);
  if (!rebind) return;
  if (ctx.session) ctx.session.reputationRebind = text;
  await ctx.reply(
    ctx.i18n.t('reputation_rebind_confirm', {
      from: npub(rebind.boundIdentity),
      to: npub(rebind.newIdentity),
    }),
    {
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: ctx.i18n.t('reputation_confirm_button'),
              callback_data: REBIND_CONFIRM,
            },
          ],
        ],
      },
    },
  );
};

/** The rebind confirm button: move the binding atomically, then issue. */
export const handleRebindConfirm = async (
  ctx: any,
  deps: ReputationDeps,
): Promise<void> => {
  const text: string | undefined = ctx.session?.reputationRebind;
  if (ctx.session) delete ctx.session.reputationRebind;
  if (!text) {
    await ctx.reply(ctx.i18n.t('reputation_rebind_invalid'));
    return;
  }
  const found = await eligibleUser(ctx, deps);
  if (!found) return;
  const rebind = await checkRebind(ctx, deps, found.user, text);
  if (!rebind) return;
  const moved = await deps.rebind(
    found.user,
    rebind.boundIdentity,
    rebind.newIdentity,
    today(deps),
  );
  if (!moved) {
    // The binding changed since the check: a replay, or a concurrent move.
    await ctx.reply(ctx.i18n.t('reputation_rebind_invalid'));
    return;
  }
  if (ctx.session) delete ctx.session.reputationDestination;
  logger.notice(
    `reputation: account ${moved._id} rebound from ${rebind.boundIdentity} to ${rebind.newIdentity} by its owner`,
  );
  await issue(ctx, deps, moved, rebind.newIdentity, found.firstTrade);
};

/**
 * `/reputation_rebind <account> <npub or hex> <reason>`: an admin moves the
 * binding of a user who lost the bound identity and cannot sign. The account
 * is a Telegram id or an internal id. Logged with both identities and the
 * reason.
 */
export const handleAdminRebind = async (
  ctx: any,
  args: string,
  deps: ReputationDeps,
): Promise<void> => {
  if (!deps.dbReady()) {
    await ctx.reply(ctx.i18n.t('reputation_unavailable'));
    return;
  }
  const admin = await deps.findUser(String(ctx.from.id));
  if (!admin?.admin) return;
  // This runs ahead of the admin middleware that would set the language.
  if (admin.lang) ctx.i18n.locale(admin.lang);
  const [account, key, ...words] = args.trim().split(/\s+/);
  const reason = words.join(' ').trim();
  let identity: string | null = null;
  if (key && HEX_KEY.test(key)) identity = key;
  else if (key?.startsWith('npub')) {
    try {
      const decoded = nip19.decode(key);
      if (decoded.type === 'npub') identity = decoded.data as string;
    } catch (error) {
      identity = null;
    }
  }
  if (!account || identity === null || reason === '') {
    await ctx.reply(ctx.i18n.t('reputation_admin_rebind_usage'));
    return;
  }
  const target = await deps.findAccount(account);
  if (!target) {
    await ctx.reply(ctx.i18n.t('reputation_admin_rebind_not_found'));
    return;
  }
  const from = target.reputation_exported_to || null;
  const moved = from
    ? await deps.rebind(target, from, identity, today(deps))
    : await deps.bind(target, identity, today(deps));
  if (!moved) {
    await ctx.reply(ctx.i18n.t('reputation_admin_rebind_not_found'));
    return;
  }
  logger.notice(
    `reputation: admin ${ctx.from.id} rebound account ${target._id} from ${from} to ${identity}: ${reason}`,
  );
  await ctx.reply(
    ctx.i18n.t('reputation_admin_rebind_done', {
      from: from ? npub(from) : '-',
      to: npub(identity),
    }),
  );
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
    if (!match && data !== REBIND_CONFIRM) return next();
    try {
      await ctx.answerCbQuery?.();
      if (!isPrivateChat(ctx)) return;
      if (match) await handleConfirm(ctx, match[1], deps);
      else await handleRebindConfirm(ctx, deps);
    } catch (error) {
      logger.error(`reputation: ${error}`);
    }
  });
  bot.use(async (ctx: any, next: () => Promise<void>) => {
    const text = ctx.message?.text;
    if (typeof text !== 'string') return next();
    const admin = ADMIN_REBIND.exec(text);
    const pasted =
      text.trimStart().startsWith('{') && text.includes(REBIND_DOCUMENT);
    if (!admin && !(pasted && isPrivateChat(ctx))) return next();
    try {
      if (admin) await handleAdminRebind(ctx, admin[1] || '', deps);
      else await handleRebindPaste(ctx, text.trim(), deps);
    } catch (error) {
      if (isPrivateChat(ctx)) await fail(ctx, error);
      else logger.error(`reputation: ${error}`);
    }
  });
};
