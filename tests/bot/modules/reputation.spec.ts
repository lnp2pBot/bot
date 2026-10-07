import fs from 'fs';
import path from 'path';

const { expect } = require('chai');
const sinon = require('sinon');
const { getPublicKey, verifyEvent } = require('nostr-tools');

const {
  buildAttestation,
  decodeIdentity,
  encodeIdentity,
  formatRating,
  ratingHundredths,
} = require('../../../bot/modules/reputation/attestation');
const { limit } = require('@grammyjs/ratelimiter');
const {
  configure,
  handleConfirm,
  handleStart,
  limiterKey,
} = require('../../../bot/modules/reputation');

// The protocol's test vectors (MostroP2P/protocol src/vectors/reputation_v1.json).
const vectors = JSON.parse(
  fs.readFileSync(
    path.join(process.cwd(), 'tests/fixtures/reputation_v1.json'),
    'utf8',
  ),
);
const secret = (label: string) =>
  Uint8Array.from(Buffer.from(vectors.secret_keys[label], 'hex'));
const ISSUER = secret('issuer-a');
const IDENTITY = getPublicKey(secret('identity'));
const OTHER = getPublicKey(secret('other-identity'));
const valid = vectors.attestation.valid;

describe('reputation attestation', () => {
  it('rounds every vector average half away from zero on the double', () => {
    for (const { average, rating } of vectors.rating_rounding) {
      expect(formatRating(ratingHundredths(average)), String(average)).to.equal(
        rating,
      );
    }
    expect(ratingHundredths(NaN)).to.equal(null);
  });

  it('builds the vector attestation byte for byte, so its id matches', () => {
    const expect_ = valid.expect;
    const event = buildAttestation(ISSUER, {
      destination: expect_.destination,
      subject: expect_.subject,
      reviews: expect_.reviews,
      average: 4.87,
      since: expect_.since,
      createdAt: expect_.created_at,
      lifetime: expect_.expiration - expect_.created_at,
    });
    expect(event.id).to.equal(valid.id);
    expect(event.tags).to.deep.equal(valid.event.tags);
    expect(event.kind).to.equal(38388);
    expect(event.pubkey).to.equal(expect_.issuer_key);
    expect(verifyEvent(event)).to.equal(true);
  });

  it('refuses arguments a Mostro instance would refuse', () => {
    const base = {
      destination: IDENTITY,
      subject: 'abc',
      reviews: 5,
      average: 4,
      since: 1696204800,
      createdAt: 1790899200,
      lifetime: 604800,
    };
    const bad = [
      { destination: IDENTITY.toUpperCase() },
      { subject: 'a b' },
      { reviews: 4 },
      { average: NaN },
      { since: 1696204801 },
      { since: 1790899200 + 86400 },
      { lifetime: 0 },
    ];
    for (const change of bad) {
      expect(() => buildAttestation(ISSUER, { ...base, ...change })).to.throw();
    }
  });

  it('carries the identity in 43 base64url characters', () => {
    const encoded = encodeIdentity(IDENTITY);
    expect(encoded).to.have.length(43);
    expect(`rep_${encoded}`.length).to.be.at.most(64);
    expect(decodeIdentity(encoded)).to.equal(IDENTITY);
    expect(decodeIdentity(encoded.slice(1))).to.equal(null);
    expect(decodeIdentity(`${encoded.slice(0, 42)}+`)).to.equal(null);
    // The 43rd character carries 2 padding bits: only one spelling decodes.
    const last = encoded[42];
    const sibling = last === 'A' ? 'B' : 'A';
    const decodedSibling = decodeIdentity(encoded.slice(0, 42) + sibling);
    if (decodedSibling !== null) expect(decodedSibling).to.not.equal(IDENTITY);
  });
});

/** An account store with the atomic compare-and-set the real one uses. */
const makeDeps = (user: any, overrides: any = {}) => ({
  issuerKey: ISSUER,
  now: () => 1790899200,
  dbReady: () => true,
  findUser: sinon.stub().callsFake(async () => user),
  bind: sinon.stub().callsFake(async (_u: any, identity: string, day: Date) => {
    // One tick so two confirmations interleave like concurrent requests.
    await new Promise(resolve => setImmediate(resolve));
    if (user.reputation_exported_to && user.reputation_exported_to !== identity)
      return null;
    user.reputation_exported_to = identity;
    user.reputation_exported_at = day;
    return user;
  }),
  firstTradeSince: sinon.stub().resolves(1696204800),
  ...overrides,
});

const makeUser = (fields: any = {}) => ({
  _id: '64f1c9f4e3a2b1c0d9e8f7a6',
  lang: 'en',
  banned: false,
  trades_completed: 12,
  total_reviews: 214,
  total_rating: 4.87,
  reputation_exported_to: null,
  ...fields,
});

const makeCtx = () => ({
  from: { id: 42 },
  chat: { id: 42, type: 'private' },
  i18n: {
    locale: sinon.stub(),
    t: (key: string, vars?: any) =>
      vars ? `${key} ${JSON.stringify(vars)}` : key,
  },
  reply: sinon.stub().resolves(),
  answerCbQuery: sinon.stub().resolves(),
});

const replies = (ctx: any): string[] =>
  ctx.reply.getCalls().map((c: any) => c.args[0]);
const attestationIn = (ctx: any) => JSON.parse(replies(ctx)[1]);

describe('reputation export flow', () => {
  it('asks to confirm the identity before binding an unbound account', async () => {
    const user = makeUser();
    const deps = makeDeps(user);
    const ctx = makeCtx();
    await handleStart(ctx, encodeIdentity(IDENTITY), deps);
    expect(replies(ctx)[0]).to.match(/^reputation_confirm /);
    const keyboard = ctx.reply.firstCall.args[1].reply_markup.inline_keyboard;
    expect(keyboard[0][0].callback_data).to.equal(
      `repok_${encodeIdentity(IDENTITY)}`,
    );
    expect(keyboard[0][0].callback_data.length).to.be.at.most(64);
    expect(deps.bind.called).to.equal(false);
    expect(user.reputation_exported_to).to.equal(null);
  });

  it('binds on confirmation and answers with a valid attestation', async () => {
    const user = makeUser();
    const ctx = makeCtx();
    await handleConfirm(ctx, encodeIdentity(IDENTITY), makeDeps(user));
    expect(user.reputation_exported_to).to.equal(IDENTITY);
    expect(user.reputation_exported_at.toISOString()).to.equal(
      '2026-10-02T00:00:00.000Z',
    );
    expect(replies(ctx)[0]).to.match(/^reputation_exported /);
    const event = attestationIn(ctx);
    expect(verifyEvent(event)).to.equal(true);
    expect(event.tags).to.deep.include(['p', IDENTITY]);
    expect(event.tags).to.deep.include(['subject', user._id]);
    expect(event.tags).to.deep.include(['reviews', '214']);
    expect(event.tags).to.deep.include(['rating', '4.87']);
    expect(event.tags).to.deep.include(['since', '1696204800']);
    expect(event.tags).to.deep.include([
      'expiration',
      String(1790899200 + 604800),
    ]);
  });

  it('re-issues without asking for an account already bound to the identity', async () => {
    const user = makeUser({ reputation_exported_to: IDENTITY });
    const ctx = makeCtx();
    await handleStart(ctx, encodeIdentity(IDENTITY), makeDeps(user));
    expect(replies(ctx)[0]).to.match(/^reputation_exported /);
    expect(verifyEvent(attestationIn(ctx))).to.equal(true);
  });

  it('refuses an identity other than the bound one', async () => {
    const user = makeUser({ reputation_exported_to: OTHER });
    const ctx = makeCtx();
    await handleStart(ctx, encodeIdentity(IDENTITY), makeDeps(user));
    expect(replies(ctx)).to.have.length(1);
    expect(replies(ctx)[0]).to.match(/^reputation_bound_other /);
  });

  it('lets exactly one of two concurrent confirmations bind', async () => {
    const user = makeUser();
    const deps = makeDeps(user);
    const [a, b] = [makeCtx(), makeCtx()];
    await Promise.all([
      handleConfirm(a, encodeIdentity(IDENTITY), deps),
      handleConfirm(b, encodeIdentity(OTHER), deps),
    ]);
    const issued = [a, b].filter(ctx =>
      /^reputation_exported /.test(replies(ctx)[0]),
    );
    const refused = [a, b].filter(ctx =>
      /^reputation_bound_other /.test(replies(ctx)[0]),
    );
    expect(issued).to.have.length(1);
    expect(refused).to.have.length(1);
    const winner = attestationIn(issued[0]).tags.find(
      (t: string[]) => t[0] === 'p',
    )[1];
    expect(winner).to.equal(user.reputation_exported_to);
  });

  it('refuses an ineligible account without binding it', async () => {
    for (const fields of [
      { banned: true },
      { trades_completed: 9 },
      { total_reviews: 4 },
    ]) {
      const user = makeUser(fields);
      const deps = makeDeps(user);
      const ctx = makeCtx();
      await handleConfirm(ctx, encodeIdentity(IDENTITY), deps);
      expect(replies(ctx)).to.deep.equal(['reputation_not_eligible']);
      expect(deps.bind.called).to.equal(false);
    }
    const ctx = makeCtx();
    await handleStart(
      ctx,
      encodeIdentity(IDENTITY),
      makeDeps(makeUser(), { firstTradeSince: sinon.stub().resolves(null) }),
    );
    expect(replies(ctx)).to.deep.equal(['reputation_not_eligible']);
  });

  it('says it is unavailable without a database, and refuses a bad link', async () => {
    const ctx = makeCtx();
    await handleStart(
      ctx,
      encodeIdentity(IDENTITY),
      makeDeps(makeUser(), { dbReady: () => false }),
    );
    expect(replies(ctx)).to.deep.equal(['reputation_unavailable']);
    const bad = makeCtx();
    await handleStart(bad, 'x'.repeat(43), makeDeps(makeUser()));
    expect(replies(bad)).to.deep.equal(['reputation_invalid_link']);
  });

  it('answers in the language stored for the user', async () => {
    const ctx = makeCtx();
    await handleStart(
      ctx,
      encodeIdentity(IDENTITY),
      makeDeps(makeUser({ lang: 'es' })),
    );
    expect(ctx.i18n.locale.calledWith('es')).to.equal(true);
  });
});

describe('reputation export routing', () => {
  const route = async (update: any) => {
    const handlers: any[] = [];
    configure({ use: (h: any) => handlers.push(h) }, makeDeps(makeUser()));
    const ctx = { ...makeCtx(), ...update };
    const next = sinon.stub().resolves();
    for (const handler of handlers) await handler(ctx, next);
    return { ctx, next };
  };

  it('takes /start rep_ and its confirm button, and passes everything else on', async () => {
    const start = await route({
      message: { text: `/start rep_${encodeIdentity(IDENTITY)}` },
    });
    expect(replies(start.ctx)[0]).to.match(/^reputation_confirm /);
    expect(start.next.callCount).to.equal(1); // only the button handler passed it on

    const button = await route({
      callbackQuery: { data: `repok_${encodeIdentity(IDENTITY)}` },
    });
    expect(button.ctx.answerCbQuery.called).to.equal(true);
    expect(replies(button.ctx)[0]).to.match(/^reputation_exported /);

    for (const update of [
      { message: { text: '/start' } },
      { message: { text: '/start 123' } },
      { callbackQuery: { data: 'showqrcode_1' } },
    ]) {
      const other = await route(update);
      expect(other.next.callCount, JSON.stringify(update)).to.equal(2);
      expect(other.ctx.reply.called).to.equal(false);
    }
  });

  it('ignores a binding link or confirm button outside a private chat', async () => {
    const group = { chat: { id: -100, type: 'supergroup' } };
    const start = await route({
      ...group,
      message: { text: `/start@lnp2pbot rep_${encodeIdentity(IDENTITY)}` },
    });
    expect(start.ctx.reply.called).to.equal(false);
    expect(start.next.callCount).to.equal(2); // left to the rest of the bot

    const deps = makeDeps(makeUser());
    const handlers: any[] = [];
    configure({ use: (h: any) => handlers.push(h) }, deps);
    const ctx = {
      ...makeCtx(),
      ...group,
      callbackQuery: { data: `repok_${encodeIdentity(IDENTITY)}` },
    };
    const next = sinon.stub().resolves();
    for (const handler of handlers) await handler(ctx, next);
    expect(ctx.answerCbQuery.called).to.equal(true);
    expect(deps.bind.called).to.equal(false);
    expect(ctx.reply.called).to.equal(false);
  });
});

describe('reputation export rate limiting', () => {
  it('lets the confirm button through right after /start rep_', async () => {
    const limiter = limit({ keyGenerator: limiterKey });
    const next = sinon.stub().resolves();
    const from = { id: 42 };
    const confirm = `repok_${encodeIdentity(IDENTITY)}`;
    await limiter(
      { from, message: { text: `/start rep_${encodeIdentity(IDENTITY)}` } },
      next,
    );
    await limiter({ from, callbackQuery: { data: confirm } }, next);
    expect(next.callCount).to.equal(2);

    // Each stage still has its own one-per-second budget.
    await limiter({ from, callbackQuery: { data: confirm } }, next);
    await limiter({ from, message: { text: '/start' } }, next);
    expect(next.callCount).to.equal(2);
  });

  it('keys everything else by the sender, like the default', () => {
    expect(limiterKey({ from: { id: 42 } })).to.equal('42');
    expect(
      limiterKey({ from: { id: 42 }, callbackQuery: { data: 'showqrcode_1' } }),
    ).to.equal('42');
    expect(limiterKey({})).to.equal(undefined);
  });
});
