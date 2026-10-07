export {};

const { expect } = require('chai');
const sinon = require('sinon');
const proxyquire = require('proxyquire');
const { getPublicKey } = require('nostr-tools');
const { Types } = require('mongoose');

// firstTradeSince runs one query: Order.aggregate(pipeline).
const aggregate = sinon.stub();

const reputation = proxyquire('../../util/reputation', {
  '../models': { Order: { aggregate }, '@noCallThru': true },
});

// Runs the pipeline's $project, $match, $sort and $limit stages over
// in-memory orders, enough to check what the query selects.
const runPipeline = (pipeline: any[], orders: any[]) => {
  const project = pipeline.find(stage => stage.$project).$project;
  const [taken, created] = project.startedAt.$ifNull;
  const field = (ref: string) => ref.slice(1);
  return orders
    .map(order => ({
      startedAt: order[field(taken)] ?? order[field(created)] ?? null,
    }))
    .filter(row => row.startedAt !== null)
    .sort((a, b) => a.startedAt.getTime() - b.startedAt.getTime())
    .slice(0, 1);
};

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
    aggregate.reset();
  });

  const withOrders = (orders: any[]) =>
    aggregate.callsFake(async (pipeline: any[]) =>
      runPipeline(pipeline, orders),
    );

  it('queries the SUCCESS orders the user bought or sold in', async () => {
    aggregate.resolves([]);
    const _id = new Types.ObjectId();
    await reputation.firstTradeSince({ _id });
    const pipeline = aggregate.firstCall.args[0];
    // Order party ids are strings and aggregate() does not cast them.
    expect(pipeline[0]).to.deep.equal({
      $match: {
        status: 'SUCCESS',
        $or: [{ buyer_id: String(_id) }, { seller_id: String(_id) }],
      },
    });
    expect(pipeline).to.deep.include({ $sort: { startedAt: 1 } });
    expect(pipeline).to.deep.include({ $limit: 1 });
  });

  it('is null without a completed order', async () => {
    aggregate.resolves([]);
    expect(await reputation.firstTradeSince({ _id: 'u1' })).to.equal(null);
  });

  it('is the UTC day the trade was taken', async () => {
    withOrders([
      {
        taken_at: new Date('2023-10-02T17:45:12Z'),
        created_at: new Date('2023-10-01T09:00:00Z'),
      },
    ]);
    expect(await reputation.firstTradeSince({ _id: 'u1' })).to.equal(
      1696204800,
    );
  });

  it('falls back to the creation day for an order without taken_at', async () => {
    withOrders([
      { taken_at: null, created_at: new Date('2023-10-02T00:00:00Z') },
    ]);
    expect(await reputation.firstTradeSince({ _id: 'u1' })).to.equal(
      1696204800,
    );
  });

  it('picks the earliest trade taken, not the earliest order created', async () => {
    withOrders([
      // Listed first, taken last.
      {
        taken_at: new Date('2023-10-10T12:00:00Z'),
        created_at: new Date('2023-10-01T12:00:00Z'),
      },
      // Listed later, taken first.
      {
        taken_at: new Date('2023-10-03T12:00:00Z'),
        created_at: new Date('2023-10-02T12:00:00Z'),
      },
    ]);
    // 2023-10-03T00:00:00Z
    expect(await reputation.firstTradeSince({ _id: 'u1' })).to.equal(
      1696291200,
    );
  });
});
