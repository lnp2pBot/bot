export {};

const { expect } = require('chai');
const sinon = require('sinon');
const proxyquire = require('proxyquire').noCallThru();
const {
  usePaymentAttempts,
  loggerStub,
  utilStub,
} = require('../helpers/stubs');

/**
 * Regression tests for issue #867: the routing fee paid on a community
 * earnings withdrawal must be persisted on the pending payment, so the
 * operator has a DB record of what the withdrawal cost to route. Community
 * withdrawals have no order to hold the fee, so if it is not stored here it is
 * lost. Both settle paths are covered: a fresh payment, and reconciliation of
 * a withdrawal that a previous run already paid but whose response was lost.
 */
describe('attemptCommunitiesPendingPayments (issue #867)', () => {
  usePaymentAttempts('3');

  // A status that is neither confirmed nor in-flight, so the job falls through
  // the reconciliation guards and actually attempts the payment.
  const notPaidStatus = {
    is_confirmed: false,
    is_failed: false,
    is_pending: false,
    payment: undefined,
  };

  // Builds the job with fully mocked dependencies so nothing touches Mongo/LND.
  function load({
    pending,
    community,
    payment,
    status = notPaidStatus,
  }: {
    pending: any;
    community: any;
    payment?: any;
    status?: any;
  }) {
    const payRequest = sinon.stub().resolves(payment);
    const getPaymentStatus = sinon.stub().resolves(status);

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
        '../logger': loggerStub(),
        '../ln': { payRequest, getPaymentStatus },
        '../util': utilStub(),
        '../bot/modules/events/orders': { orderUpdated: sinon.stub() },
      },
    );

    const bot = { telegram: { sendMessage: sinon.stub().resolves() } };
    return { attemptCommunitiesPendingPayments, bot, payRequest };
  }

  const makePending = (overrides: any = {}) => ({
    _id: 'pp1',
    community_id: 'c1',
    user_id: 'u1',
    amount: 500,
    payment_request: 'lnbc-withdrawal',
    attempts: 0,
    routing_fee: 0,
    paid: false,
    is_invoice_expired: false,
    save: sinon.stub().resolves(),
    ...overrides,
  });

  const makeCommunity = (overrides: any = {}) => ({
    _id: 'c1',
    id: 7,
    orders_to_redeem: 3,
    save: sinon.stub().resolves(),
    ...overrides,
  });

  it('persists the routing fee when a community withdrawal succeeds', async () => {
    const pending = makePending();
    const community = makeCommunity();
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
    expect(pending.routing_fee).to.equal(9);
    expect(community.orders_to_redeem).to.equal(0);
    // The assignment is worthless unless the document is actually written.
    expect(pending.save.called).to.equal(true);
  });

  it('persists the routing fee when an already-confirmed withdrawal is reconciled', async () => {
    // A previous run paid this withdrawal but lost the response (timeout /
    // in-flight), so this run finds it already confirmed. The fee is just as
    // real here, and this is the most common way these records get settled.
    const pending = makePending({ _id: 'pp3', attempts: 1 });
    const community = makeCommunity();
    const status = {
      is_confirmed: true,
      is_pending: false,
      payment: {
        confirmed_at: '2026-01-01T00:00:00Z',
        id: 'payment-hash',
        fee: 11,
        secret: 'preimage',
      },
    };

    const { attemptCommunitiesPendingPayments, bot, payRequest } = load({
      pending,
      community,
      status,
    });
    await attemptCommunitiesPendingPayments(bot as any);

    // The withdrawal must not be paid a second time.
    expect(payRequest.called).to.equal(false);
    expect(pending.paid).to.equal(true);
    expect(pending.routing_fee).to.equal(11);
    expect(pending.save.called).to.equal(true);
  });

  it('defaults the routing fee to 0 when LND reports no fee', async () => {
    const pending = makePending({ _id: 'pp4' });
    const community = makeCommunity();
    const payment = {
      confirmed_at: '2026-01-01T00:00:00Z',
      id: 'payment-hash',
      secret: 'preimage',
    };

    const { attemptCommunitiesPendingPayments, bot } = load({
      pending,
      community,
      payment,
    });
    await attemptCommunitiesPendingPayments(bot as any);

    // Never `undefined`: mongoose drops the path instead of falling back to
    // the schema default, which would leave the field absent on the document.
    expect(pending.routing_fee).to.equal(0);
  });

  it('leaves the fee at zero when the withdrawal does not confirm', async () => {
    const pending = makePending({ _id: 'pp2', community_id: 'c2' });
    const community = makeCommunity({ _id: 'c2', id: 8, orders_to_redeem: 2 });
    const payment = { error: 'ROUTING_FAILED', message: 'no route' };

    const { attemptCommunitiesPendingPayments, bot } = load({
      pending,
      community,
      payment,
    });
    await attemptCommunitiesPendingPayments(bot as any);

    // Assert the failure path really ran, otherwise the fee check below would
    // pass on a pending payment the job never even touched.
    expect(pending.last_error).to.equal('ROUTING_FAILED');
    expect(pending.attempts).to.equal(1);
    expect(pending.paid).to.equal(false);
    expect(pending.routing_fee).to.equal(0);
    // The earnings are only restored once the retries are exhausted.
    expect(community.orders_to_redeem).to.equal(2);
  });
});
