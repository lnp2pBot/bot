export {};

const { expect } = require('chai');
const sinon = require('sinon');
const proxyquire = require('proxyquire').noCallThru();

/**
 * Regression tests for issue #864: on a successful retry, the order's
 * buyer_invoice must be synced to the invoice that was actually paid (the one
 * stored on the pending payment), not left pointing at the original invoice.
 */
describe('attemptPendingPayments (issue #864)', () => {
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
    order,
    pending,
    payment,
  }: {
    order: any;
    pending: any;
    payment: any;
  }) {
    const payRequest = sinon.stub().resolves(payment);
    const isPendingPayment = sinon.stub().resolves(false);
    const orderUpdated = sinon.stub();

    const buyerUser = {
      _id: order.buyer_id,
      tg_id: '1',
      trades_completed: 0,
      save: sinon.stub().resolves(),
    };
    const sellerUser = {
      _id: order.seller_id,
      tg_id: '2',
      trades_completed: 0,
      save: sinon.stub().resolves(),
    };
    const User = { findOne: sinon.stub() };
    User.findOne.withArgs({ _id: order.buyer_id }).resolves(buyerUser);
    User.findOne.withArgs({ _id: order.seller_id }).resolves(sellerUser);

    const models = {
      PendingPayment: { find: sinon.stub().resolves([pending]) },
      Order: { findOne: sinon.stub().resolves(order) },
      User,
      Community: {},
    };

    const messages = {
      __esModule: true,
      toAdminChannelPendingPaymentSuccessMessage: sinon.stub().resolves(),
      toBuyerPendingPaymentSuccessMessage: sinon.stub().resolves(),
      rateUserMessage: sinon.stub().resolves(),
      expiredInvoiceOnPendingMessage: sinon.stub().resolves(),
      toBuyerPendingPaymentFailedMessage: sinon.stub().resolves(),
      toAdminChannelPendingPaymentFailedMessage: sinon.stub().resolves(),
    };

    const { attemptPendingPayments } = proxyquire(
      '../../jobs/pending_payments',
      {
        '../models': models,
        '../bot/messages': messages,
        '../logger': {
          logger: {
            info: sinon.stub(),
            error: sinon.stub(),
            warning: sinon.stub(),
          },
        },
        '../ln': { payRequest, isPendingPayment },
        '../util': {
          getUserI18nContext: sinon.stub().resolves({ t: (k: string) => k }),
        },
        '../bot/modules/events/orders': { orderUpdated },
      },
    );

    return { attemptPendingPayments, payRequest, orderUpdated, buyerUser };
  }

  it('syncs buyer_invoice to the paid invoice when a retry succeeds', async () => {
    const order = {
      _id: 'order1',
      buyer_id: 'buyer1',
      seller_id: 'seller1',
      amount: 1000,
      status: 'PAID_HOLD_INVOICE',
      hash: 'hold-hash',
      buyer_invoice: 'lnbc-original-failed',
      routing_fee: 0,
      save: sinon.stub().resolves(),
    };
    const pending = {
      _id: 'pp1',
      order_id: 'order1',
      amount: 1000,
      payment_request: 'lnbc-new-retry',
      hash: 'hold-hash',
      attempts: 0,
      paid: false,
      is_invoice_expired: false,
      save: sinon.stub().resolves(),
    };
    const payment = {
      confirmed_at: '2026-01-01T00:00:00Z',
      id: 'real-payment-hash',
      fee: 5,
      secret: 'preimage',
    };

    const { attemptPendingPayments } = load({ order, pending, payment });
    await attemptPendingPayments({} as any);

    expect(order.status).to.equal('SUCCESS');
    expect(order.buyer_invoice).to.equal('lnbc-new-retry');
    expect(order.routing_fee).to.equal(5);
    expect(pending.paid).to.equal(true);
    expect(order.save.called).to.equal(true);
  });

  it('leaves buyer_invoice untouched when the payment does not confirm', async () => {
    const order = {
      _id: 'order2',
      buyer_id: 'buyer2',
      seller_id: 'seller2',
      amount: 1000,
      status: 'PAID_HOLD_INVOICE',
      hash: 'hold-hash',
      buyer_invoice: 'lnbc-original',
      routing_fee: 0,
      save: sinon.stub().resolves(),
    };
    const pending = {
      _id: 'pp2',
      order_id: 'order2',
      amount: 1000,
      payment_request: 'lnbc-new-retry',
      hash: 'hold-hash',
      attempts: 0,
      paid: false,
      is_invoice_expired: false,
      save: sinon.stub().resolves(),
    };
    const payment = { error: 'ROUTING_FAILED', message: 'no route' };

    const { attemptPendingPayments } = load({ order, pending, payment });
    await attemptPendingPayments({} as any);

    expect(order.status).to.equal('PAID_HOLD_INVOICE');
    expect(order.buyer_invoice).to.equal('lnbc-original');
    expect(pending.paid).to.equal(false);
  });
});
