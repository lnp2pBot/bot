export {};

const { expect } = require('chai');
const sinon = require('sinon');
const proxyquire = require('proxyquire');
const { getPublicKey } = require('nostr-tools');

// firstTradeSince runs one query: Order.findOne(...).sort(...).lean().
const lean = sinon.stub();
const sort = sinon.stub().returns({ lean });
const findOne = sinon.stub().returns({ sort });

const reputation = proxyquire('../../util/reputation', {
  '../models': { Order: { findOne }, '@noCallThru': true },
});

const ISSUER_SK =
  '4fa1a2d2b5f0c6e1c0d2a7d3a9e6b5c4d3e2f1a0b9c8d7e6f5a4b3c2d1e0f9a8';
const NOSTR_SK =
  '1b2c3d4e5f60718293a4b5c6d7e8f90112233445566778899aabbccddeeff00';

describe('reputation issuer key', () => {
  it('is disabled when REPUTATION_ISSUER_SK is unset or empty', () => {
    expect(reputation.loadIssuerKey({})).to.equal(null);
    expect(reputation.loadIssuerKey({ REPUTATION_ISSUER_SK: '  ' })).to.equal(
      null,
    );
  });

  it('loads a 64-character hex key', () => {
    const key = reputation.loadIssuerKey({
      REPUTATION_ISSUER_SK: ISSUER_SK,
      NOSTR_SK,
    });
    expect(Buffer.from(key).toString('hex')).to.equal(ISSUER_SK);
    expect(getPublicKey(key)).to.have.length(64);
  });

  it('refuses a malformed key', () => {
    expect(() =>
      reputation.loadIssuerKey({ REPUTATION_ISSUER_SK: 'abc' }),
    ).to.throw(/64-character hex/);
    expect(() =>
      reputation.loadIssuerKey({ REPUTATION_ISSUER_SK: 'z'.repeat(64) }),
    ).to.throw(/64-character hex/);
  });

  it('refuses a key outside the curve order', () => {
    expect(() =>
      reputation.loadIssuerKey({ REPUTATION_ISSUER_SK: 'f'.repeat(64) }),
    ).to.throw(/valid secp256k1 key/);
  });

  it('refuses the bot NOSTR_SK, whatever its case', () => {
    expect(() =>
      reputation.loadIssuerKey({
        REPUTATION_ISSUER_SK: ISSUER_SK,
        NOSTR_SK: ISSUER_SK.toUpperCase(),
      }),
    ).to.throw(/dedicated key/);
  });
});

describe('reputation export eligibility', () => {
  const eligible = { banned: false, trades_completed: 10, total_reviews: 5 };
  const firstTrade = 1696204800;

  it('accepts an account at both floors with a first trade on record', () => {
    expect(reputation.isEligible(eligible, firstTrade)).to.equal(true);
  });

  it('refuses a banned account', () => {
    expect(
      reputation.isEligible({ ...eligible, banned: true }, firstTrade),
    ).to.equal(false);
  });

  it('refuses fewer than 10 completed trades or 5 ratings', () => {
    expect(
      reputation.isEligible({ ...eligible, trades_completed: 9 }, firstTrade),
    ).to.equal(false);
    expect(
      reputation.isEligible({ ...eligible, total_reviews: 4 }, firstTrade),
    ).to.equal(false);
  });

  it('refuses an account whose history gives no first trade date', () => {
    expect(reputation.isEligible(eligible, null)).to.equal(false);
  });
});

describe('first completed trade', () => {
  beforeEach(() => {
    findOne.resetHistory();
    lean.reset();
  });

  it('queries the earliest SUCCESS order the user bought or sold in', async () => {
    lean.resolves(null);
    await reputation.firstTradeSince({ _id: 'u1' });
    expect(findOne.firstCall.args[0]).to.deep.equal({
      status: 'SUCCESS',
      $or: [{ buyer_id: 'u1' }, { seller_id: 'u1' }],
    });
    expect(sort.lastCall.args[0]).to.deep.equal({ created_at: 1 });
  });

  it('is null without a completed order', async () => {
    lean.resolves(null);
    expect(await reputation.firstTradeSince({ _id: 'u1' })).to.equal(null);
  });

  it('is the UTC day the trade was taken', async () => {
    lean.resolves({
      taken_at: new Date('2023-10-02T17:45:12Z'),
      created_at: new Date('2023-10-01T09:00:00Z'),
    });
    expect(await reputation.firstTradeSince({ _id: 'u1' })).to.equal(
      1696204800,
    );
  });

  it('falls back to the creation day for an order without taken_at', async () => {
    lean.resolves({
      taken_at: null,
      created_at: new Date('2023-10-02T00:00:00Z'),
    });
    expect(await reputation.firstTradeSince({ _id: 'u1' })).to.equal(
      1696204800,
    );
  });
});
