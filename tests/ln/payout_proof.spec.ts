export {};

const { expect } = require('chai');
const sinon = require('sinon');
const proxyquire = require('proxyquire').noCallThru();

/**
 * Regression test for issue #869: a successful buyer payout must persist the
 * payment hash and preimage (proof of payment) on the order.
 */
describe('payToBuyer payout proof (issue #869)', () => {
  const originalMaxRoutingFee = process.env.MAX_ROUTING_FEE;

  beforeEach(() => {
    process.env.MAX_ROUTING_FEE = '0.001';
  });

  afterEach(() => {
    process.env.MAX_ROUTING_FEE = originalMaxRoutingFee;
    sinon.restore();
  });

  it('stores payout_hash and payout_preimage on success', async () => {
    const payment = {
      confirmed_at: '2026-01-01T00:00:00Z',
      id: 'payment-hash',
      secret: 'preimage',
      fee: 3,
    };

    const buyerUser = { _id: 'buyer1', tg_id: '1' };
    const sellerUser = { _id: 'seller1', tg_id: '2' };
    const User = { findOne: sinon.stub() };
    User.findOne.withArgs({ _id: 'buyer1' }).resolves(buyerUser);
    User.findOne.withArgs({ _id: 'seller1' }).resolves(sellerUser);

    const { payToBuyer } = proxyquire('../../ln/pay_request', {
      lightning: {
        payViaPaymentRequest: sinon.stub().resolves(payment),
        getPayment: sinon.stub().resolves({ is_pending: false }),
        deleteForwardingReputations: sinon.stub().resolves(),
      },
      './connect': { default: {} },
      '../models': { User, PendingPayment: function () {} },
      '../util': {
        handleReputationItems: sinon.stub().resolves(),
        getUserI18nContext: sinon.stub().resolves({ t: (k: string) => k }),
      },
      '../bot/messages': {
        __esModule: true,
        buyerReceivedSatsMessage: sinon.stub().resolves(),
        rateUserMessage: sinon.stub().resolves(),
        invoicePaymentFailedMessage: sinon.stub().resolves(),
        expiredInvoiceOnPendingMessage: sinon.stub().resolves(),
      },
      '../logger': {
        logger: {
          info: sinon.stub(),
          error: sinon.stub(),
          warning: sinon.stub(),
        },
        logTimeout: sinon.stub(),
        logOperationDuration: sinon.stub(),
      },
      '../bot/modules/events/orders': {
        __esModule: true,
        orderUpdated: sinon.stub(),
      },
      invoices: {
        parsePaymentRequest: sinon
          .stub()
          .returns({ id: 'payment-hash', is_expired: false }),
      },
    });

    const order = {
      _id: 'order1',
      amount: 1000,
      description: '',
      buyer_invoice: 'lnbc-buyer',
      buyer_id: 'buyer1',
      seller_id: 'seller1',
      status: 'PAID_HOLD_INVOICE',
      routing_fee: 0,
      payout_hash: null,
      payout_preimage: null,
      save: sinon.stub().resolves(),
    };

    await payToBuyer({} as any, order as any);

    expect(order.status).to.equal('SUCCESS');
    expect(order.payout_hash).to.equal('payment-hash');
    expect(order.payout_preimage).to.equal('preimage');
    expect(order.routing_fee).to.equal(3);
    expect(order.save.called).to.equal(true);
  });
});
