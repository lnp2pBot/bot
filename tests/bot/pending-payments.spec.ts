/**
 * Tests for attemptPendingPayments healing branches (jobs/pending_payments.ts).
 *
 * The "healing" branches detect that a payment was already settled (by LND's
 * idempotency or by the bot before a restart) and must run the full success
 * routine — trades_completed, buyer notification, rating — instead of just
 * silently marking the order SUCCESS.
 */

const { expect } = require('chai');
const sinon = require('sinon');
const proxyquire = require('proxyquire');

// ─── Shared fake data ────────────────────────────────────────────────────────

const ORDER_ID = 'order000000000000000000001';
const BUYER_ID = 'buyer000000000000000000001';
const SELLER_ID = 'seller00000000000000000001';
const PENDING_ID = 'pend0000000000000000000001';

const fakePayment = {
  confirmed_at: new Date().toISOString(),
  fee: 3,
  id: 'paymentid',
  secret: 'paymentsecret',
};

function makeFakeOrder(overrides = {}) {
  return {
    _id: ORDER_ID,
    buyer_id: BUYER_ID,
    seller_id: SELLER_ID,
    buyer_invoice: 'lnbc_buyer_invoice',
    amount: 1000,
    fiat_code: 'ARS',
    status: 'PENDING',
    routing_fee: 0,
    paid_hold_buyer_invoice_updated: false,
    save: sinon.stub().resolves(),
    ...overrides,
  };
}

function makeFakePending(overrides = {}) {
  return {
    _id: PENDING_ID,
    order_id: ORDER_ID,
    payment_request: 'lnbc_pending_request',
    amount: 1000,
    hash: 'fakehash',
    paid: false,
    paid_at: null,
    attempts: 0,
    is_invoice_expired: false,
    last_error: null,
    next_retry: new Date(0),
    save: sinon.stub().resolves(),
    ...overrides,
  };
}

function makeFakeUser(id: string) {
  return {
    _id: id,
    tg_id: `tg_${id}`,
    trades_completed: 5,
    save: sinon.stub().resolves(),
  };
}

// ─── Test suite ──────────────────────────────────────────────────────────────

describe('attemptPendingPayments healing branches', () => {
  let sandbox: any;
  let getPaymentStatusStub: any;
  let payRequestStub: any;
  let orderFindOneStub: any;
  let userFindOneStub: any;
  let pendingFindStub: any;
  let pendingFindOneStub: any;
  let toAdminStub: any;
  let toBuyerStub: any;
  let rateUserStub: any;
  let getUserI18nContextStub: any;
  let orderUpdatedStub: any;
  let job: any;
  let fakeBot: any;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    fakeBot = { telegram: { sendMessage: sandbox.stub().resolves() } };

    getPaymentStatusStub = sandbox.stub();
    payRequestStub = sandbox.stub();
    orderFindOneStub = sandbox.stub();
    userFindOneStub = sandbox.stub();
    pendingFindStub = sandbox.stub();
    pendingFindOneStub = sandbox.stub();
    toAdminStub = sandbox.stub().resolves();
    toBuyerStub = sandbox.stub().resolves();
    rateUserStub = sandbox.stub().resolves();
    orderUpdatedStub = sandbox.stub();
    getUserI18nContextStub = sandbox.stub().resolves({ t: (k: string) => k });

    job = proxyquire('../../jobs/pending_payments', {
      '../models': {
        PendingPayment: {
          find: pendingFindStub,
          findOne: pendingFindOneStub,
          findOneAndUpdate: sandbox.stub().resolves({ status: 'SUCCESS' }),
          countDocuments: sandbox.stub().resolves(0),
        },
        Order: {
          findOne: orderFindOneStub,
          // Atomic compare-and-set used by completeOrderAsSuccess. Returning a
          // truthy doc means "this caller won the race" so the success routine
          // runs (sets status SUCCESS in memory, notifies, increments trades).
          findOneAndUpdate: sandbox.stub().resolves({ status: 'SUCCESS' }),
        },
        User: { findOne: userFindOneStub },
        Community: {
          findById: sandbox.stub(),
          findByIdAndUpdate: sandbox.stub(),
        },
        // @global so the stubs also apply to util/completeOrder (required
        // indirectly by the job), not only to the job's own require.
        '@global': true,
        '@noCallThru': true,
      },
      '../ln': {
        payRequest: payRequestStub,
        getPaymentStatus: getPaymentStatusStub,
        '@global': true,
        '@noCallThru': true,
      },
      '../bot/messages': {
        toAdminChannelPendingPaymentSuccessMessage: toAdminStub,
        toBuyerPendingPaymentSuccessMessage: toBuyerStub,
        rateUserMessage: rateUserStub,
        expiredInvoiceOnPendingMessage: sandbox.stub().resolves(),
        toBuyerPendingPaymentFailedMessage: sandbox.stub().resolves(),
        toAdminChannelPendingPaymentFailedMessage: sandbox.stub().resolves(),
        '@global': true,
        '@noCallThru': true,
      },
      '../util': {
        getUserI18nContext: getUserI18nContextStub,
        '@noCallThru': true,
      },
      '../bot/modules/events/orders': {
        orderUpdated: orderUpdatedStub,
        '@noCallThru': true,
      },
      '../logger': {
        logger: {
          info: sandbox.stub(),
          error: sandbox.stub(),
          warn: sandbox.stub(),
          warning: sandbox.stub(),
          debug: sandbox.stub(),
        },
        '@noCallThru': true,
      },
    });
  });

  afterEach(() => {
    sandbox.restore();
  });

  // ── Branch 1: original buyer invoice already confirmed ──────────────────

  describe('original buyer invoice already confirmed', () => {
    it('runs full success routine (notifies buyer, increments trades_completed)', async () => {
      const order = makeFakeOrder();
      const pending = makeFakePending();
      const buyer = makeFakeUser(BUYER_ID);
      const seller = makeFakeUser(SELLER_ID);

      pendingFindStub.resolves([pending]);
      orderFindOneStub.resolves(order);
      userFindOneStub.withArgs({ _id: BUYER_ID }).resolves(buyer);
      userFindOneStub.withArgs({ _id: SELLER_ID }).resolves(seller);

      // Original invoice already confirmed; current pending is not
      getPaymentStatusStub.withArgs('lnbc_buyer_invoice').resolves({
        is_confirmed: true,
        is_pending: false,
        payment: fakePayment,
      });
      getPaymentStatusStub.resolves({ is_confirmed: false, is_pending: false });

      pendingFindStub.onSecondCall().resolves([]); // no previousPendingPayments

      await job.attemptPendingPayments(fakeBot);

      expect(order.status).to.equal('SUCCESS', 'order must be marked SUCCESS');
      expect(order.routing_fee).to.equal(fakePayment.fee);
      expect(pending.paid).to.equal(true);
      expect(buyer.trades_completed).to.equal(
        6,
        'buyer trades_completed must be incremented',
      );
      expect(seller.trades_completed).to.equal(
        6,
        'seller trades_completed must be incremented',
      );
      expect(toBuyerStub.calledOnce).to.equal(
        true,
        'buyer must be notified they received payment',
      );
      expect(rateUserStub.calledOnce).to.equal(
        true,
        'rating prompt must be sent to buyer',
      );
      expect(payRequestStub.called).to.equal(
        false,
        'must NOT attempt a new payment — the original invoice was already settled',
      );
    });
  });

  // ── Branch 2: previous payment already in-flight → skip without incrementing attempts ──

  describe('previous pending payment already in-flight', () => {
    it('skips retry and does not increment attempts', async () => {
      const order = makeFakeOrder();
      const pending = makeFakePending({ attempts: 1 });
      const prevPending = makeFakePending({
        _id: 'prev0000000000000000000001',
        payment_request: 'lnbc_prev_request',
      });

      pendingFindStub.onFirstCall().resolves([pending]);
      orderFindOneStub.resolves(order);

      // Original invoice: not found
      getPaymentStatusStub
        .withArgs('lnbc_buyer_invoice')
        .resolves({ is_confirmed: false, is_pending: false });
      // Previous payment: in-flight
      getPaymentStatusStub
        .withArgs('lnbc_prev_request')
        .resolves({ is_confirmed: false, is_pending: true });

      pendingFindStub.onSecondCall().resolves([prevPending]);

      await job.attemptPendingPayments(fakeBot);

      expect(pending.attempts).to.equal(
        1,
        'attempts must not be incremented when skipping in-flight',
      );
      expect(payRequestStub.called).to.equal(false);
    });
  });

  // ── Branch 3: previous payment already confirmed → full success routine ────────

  describe('previous pending payment already confirmed', () => {
    it('runs full success routine without attempting a new payment', async () => {
      const order = makeFakeOrder({ status: 'PENDING' });
      const pending = makeFakePending();
      const prevPending = makeFakePending({
        _id: 'prev0000000000000000000001',
        payment_request: 'lnbc_prev_request',
        save: sinon.stub().resolves(),
      });
      const buyer = makeFakeUser(BUYER_ID);
      const seller = makeFakeUser(SELLER_ID);

      pendingFindStub.onFirstCall().resolves([pending]);
      orderFindOneStub.resolves(order);
      userFindOneStub.withArgs({ _id: BUYER_ID }).resolves(buyer);
      userFindOneStub.withArgs({ _id: SELLER_ID }).resolves(seller);

      getPaymentStatusStub
        .withArgs('lnbc_buyer_invoice')
        .resolves({ is_confirmed: false, is_pending: false });
      getPaymentStatusStub.withArgs('lnbc_prev_request').resolves({
        is_confirmed: true,
        is_pending: false,
        payment: fakePayment,
      });

      pendingFindStub.onSecondCall().resolves([prevPending]);

      await job.attemptPendingPayments(fakeBot);

      expect(order.status).to.equal('SUCCESS');

      expect(toBuyerStub.calledOnce).to.equal(true, 'buyer must be notified');
      expect(rateUserStub.calledOnce).to.equal(true, 'rating must be sent');
      expect(payRequestStub.called).to.equal(false);
    });
  });

  // ── Branch 4: getPaymentStatus with unknown error → fail-closed ──────────

  describe('fail-closed on unknown LND error during healing check', () => {
    it('skips the pending payment without attempting to pay when getPaymentStatus fails unexpectedly', async () => {
      const order = makeFakeOrder();
      const pending = makeFakePending();

      pendingFindStub.onFirstCall().resolves([pending]);
      orderFindOneStub.resolves(order);

      // getPaymentStatus returns is_pending:true on unknown error (fail-closed behavior)
      getPaymentStatusStub
        .withArgs('lnbc_buyer_invoice')
        .resolves({ is_confirmed: false, is_pending: true });

      await job.attemptPendingPayments(fakeBot);

      expect(payRequestStub.called).to.equal(
        false,
        'must NOT attempt payment when original invoice status is unknown — fail closed',
      );
      expect(pending.attempts).to.equal(
        0,
        'attempts must not be incremented for a skipped run',
      );
    });
  });
});

export {};
