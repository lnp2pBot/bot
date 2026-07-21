export {};

const { expect } = require('chai');
const sinon = require('sinon');
const proxyquire = require('proxyquire').noCallThru();

/**
 * Regression tests for issue #867: the routing fee paid on a community
 * earnings withdrawal must be persisted on the pending payment, so the
 * operator has a DB record of what the withdrawal cost to route.
 */
describe('attemptCommunitiesPendingPayments (issue #867)', () => {
  const originalAttempts = process.env.PAYMENT_ATTEMPTS;

  beforeEach(() => {
    process.env.PAYMENT_ATTEMPTS = '3';
  });

  afterEach(() => {
    process.env.PAYMENT_ATTEMPTS = originalAttempts;
    sinon.restore();
  });

  // Builds the job with fully mocked dependencies so nothing touches Mongo/LND.
  function load({
    pending,
    community,
    payment,
  }: {
    pending: any;
    community: any;
    payment: any;
  }) {
    const payRequest = sinon.stub().resolves(payment);
    const getPaymentStatus = sinon.stub().resolves({
      is_confirmed: false,
      is_failed: false,
      is_pending: false,
      payment: undefined,
    });

    const models = {
      PendingPayment: { find: sinon.stub().resolves([pending]) },
      Order: {},
      User: { findById: sinon.stub().resolves({ tg_id: '123' }) },
      Community: {
        findById: sinon.stub().resolves(community),
        findByIdAndUpdate: sinon.stub().resolves(),
      },
    };

    const { attemptCommunitiesPendingPayments } = proxyquire(
      '../../jobs/pending_payments',
      {
        '../models': models,
        '../bot/messages': { __esModule: true },
        '../logger': {
          logger: {
            info: sinon.stub(),
            error: sinon.stub(),
            warning: sinon.stub(),
          },
        },
        '../ln': { payRequest, getPaymentStatus },
        '../util': {
          getUserI18nContext: sinon.stub().resolves({ t: (k: string) => k }),
        },
        '../bot/modules/events/orders': { orderUpdated: sinon.stub() },
      },
    );

    const bot = { telegram: { sendMessage: sinon.stub().resolves() } };
    return { attemptCommunitiesPendingPayments, bot };
  }

  it('persists the routing fee when a community withdrawal succeeds', async () => {
    const pending = {
      _id: 'pp1',
      community_id: 'c1',
      user_id: 'u1',
      amount: 500,
      payment_request: 'lnbc-withdrawal',
      attempts: 0,
      fee: 0,
      paid: false,
      is_invoice_expired: false,
      save: sinon.stub().resolves(),
    };
    const community = {
      _id: 'c1',
      id: 7,
      orders_to_redeem: 3,
      save: sinon.stub().resolves(),
    };
    const payment = {
      confirmed_at: '2026-01-01T00:00:00Z',
      id: 'payment-hash',
      fee: 9,
      secret: 'preimage',
    };

    const { attemptCommunitiesPendingPayments, bot } = load({
      pending,
      community,
      payment,
    });
    await attemptCommunitiesPendingPayments(bot as any);

    expect(pending.paid).to.equal(true);
    expect(pending.fee).to.equal(9);
    expect(community.orders_to_redeem).to.equal(0);
  });

  it('leaves the fee at zero when the withdrawal does not confirm', async () => {
    const pending = {
      _id: 'pp2',
      community_id: 'c2',
      user_id: 'u2',
      amount: 500,
      payment_request: 'lnbc-withdrawal',
      attempts: 0,
      fee: 0,
      paid: false,
      is_invoice_expired: false,
      save: sinon.stub().resolves(),
    };
    const community = {
      _id: 'c2',
      id: 8,
      orders_to_redeem: 2,
      save: sinon.stub().resolves(),
    };
    const payment = { error: 'ROUTING_FAILED', message: 'no route' };

    const { attemptCommunitiesPendingPayments, bot } = load({
      pending,
      community,
      payment,
    });
    await attemptCommunitiesPendingPayments(bot as any);

    expect(pending.paid).to.equal(false);
    expect(pending.fee).to.equal(0);
  });
});
