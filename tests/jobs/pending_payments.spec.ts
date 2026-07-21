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
 * Regression tests for issue #864: on a successful retry, the order must record
 * the invoice that was actually paid (the one stored on the pending payment) in
 * a dedicated field (buyer_invoice_paid), while the original buyer_invoice is
 * preserved so no data is lost for debugging/reconciliation.
 */
describe('attemptPendingPayments (issue #864)', () => {
  usePaymentAttempts('3');

  // A payment status that is neither confirmed nor pending, so the job falls
  // through the double-pay guards and actually attempts the retry payment.
  const notPaidStatus = {
    is_confirmed: false,
    is_pending: false,
    is_error: false,
  };

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
    const getPaymentStatus = sinon.stub().resolves(notPaidStatus);
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

    // find is called twice: the main pending-payments query and, later, the
    // previousPendingPayments lookup. Return the pending on the first call and
    // an empty list afterwards.
    const find = sinon.stub();
    find.onFirstCall().resolves([pending]);
    find.resolves([]);

    const models = {
      PendingPayment: {
        find,
        countDocuments: sinon.stub().resolves(0),
      },
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
      toAdminChannelOrderErrorMessage: sinon.stub().resolves(),
    };

    // Stub the shared success routine so we can assert the job's behaviour in
    // isolation. It emulates the real side effects we care about here.
    const completeOrderAsSuccess = sinon
      .stub()
      .callsFake(
        async (
          _bot: any,
          ord: any,
          pay: any,
          _b: any,
          _s: any,
          _i: any,
          pend: any,
          paidInvoice?: string,
        ) => {
          ord.status = 'SUCCESS';
          ord.routing_fee = pay.fee;
          if (paidInvoice) ord.buyer_invoice_paid = paidInvoice;
          if (pend) {
            pend.paid = true;
            pend.paid_at = new Date();
          }
          return true;
        },
      );
    const healConfirmedOrder = sinon.stub().resolves(true);

    const { attemptPendingPayments } = proxyquire(
      '../../jobs/pending_payments',
      {
        '../models': models,
        '../bot/messages': messages,
        '../logger': loggerStub(),
        '../ln': { payRequest, getPaymentStatus },
        '../util': utilStub(),
        '../bot/modules/events/orders': { orderUpdated },
        '../util/completeOrder': { completeOrderAsSuccess, healConfirmedOrder },
      },
    );

    return {
      attemptPendingPayments,
      payRequest,
      orderUpdated,
      buyerUser,
      completeOrderAsSuccess,
    };
  }

  it('records the paid invoice in buyer_invoice_paid and keeps the original buyer_invoice when a retry succeeds', async () => {
    const order: any = {
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

    const { attemptPendingPayments, completeOrderAsSuccess } = load({
      order,
      pending,
      payment,
    });
    await attemptPendingPayments({} as any);

    expect(completeOrderAsSuccess.called).to.equal(true);
    // The job forwards the actually-paid invoice (pending.payment_request) as
    // the paidInvoice argument (8th) of completeOrderAsSuccess.
    expect(completeOrderAsSuccess.firstCall.args[7]).to.equal('lnbc-new-retry');
    expect(order.status).to.equal('SUCCESS');
    // The paid invoice is recorded in the dedicated field...
    expect(order.buyer_invoice_paid).to.equal('lnbc-new-retry');
    // ...and the original invoice is preserved (not overwritten).
    expect(order.buyer_invoice).to.equal('lnbc-original-failed');
    expect(order.routing_fee).to.equal(5);
    expect(pending.paid).to.equal(true);
    expect(order.save.called).to.equal(true);
  });

  it('leaves buyer_invoice and buyer_invoice_paid untouched when the payment does not confirm', async () => {
    const order: any = {
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

    const { attemptPendingPayments, completeOrderAsSuccess } = load({
      order,
      pending,
      payment,
    });
    await attemptPendingPayments({} as any);

    expect(completeOrderAsSuccess.called).to.equal(false);
    expect(order.status).to.equal('PAID_HOLD_INVOICE');
    expect(order.buyer_invoice).to.equal('lnbc-original');
    expect(order.buyer_invoice_paid).to.equal(undefined);
    expect(pending.paid).to.equal(false);
  });
});
