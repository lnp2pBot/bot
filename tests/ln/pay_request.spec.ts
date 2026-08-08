/**
 * Tests for recordPayoutIntent and the payout-intent wiring in payToBuyer
 * (ln/pay_request.ts).
 *
 * The payout attempt's payment hash must be persisted on the order BEFORE any
 * money moves: LND can settle a payment after payRequest times out locally,
 * and the completion callbacks (pending-payments job) then run minutes later.
 * During that window an outgoing payment exists on the node with no trace in
 * the DB, which the external reconciliation monitor must treat as suspicious.
 * Writing the hash pre-flight closes that window.
 */

const { expect } = require('chai');
const sinon = require('sinon');
const proxyquire = require('proxyquire');

const ORDER_ID = 'order000000000000000000001';
const PARSED_PAYMENT_HASH = 'a'.repeat(64);

describe('recordPayoutIntent', () => {
  let sandbox: any;
  let orderUpdateOneStub: any;
  let parsePaymentRequestStub: any;
  let payViaPaymentRequestStub: any;
  let getPaymentStub: any;
  let payRequestModule: any;

  function makeFakeOrder(overrides = {}) {
    return {
      _id: ORDER_ID,
      buyer_id: 'buyer00000000000000000001',
      seller_id: 'seller0000000000000000001',
      buyer_invoice: 'lnbc_buyer_invoice',
      amount: 1000,
      status: 'PAID_HOLD_INVOICE',
      payout_hash: null,
      payout_preimage: null,
      save: sandbox.stub().resolves(),
      ...overrides,
    };
  }

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    process.env.MAX_ROUTING_FEE = '0.003';

    orderUpdateOneStub = sandbox.stub().resolves({});
    parsePaymentRequestStub = sandbox
      .stub()
      .returns({ id: PARSED_PAYMENT_HASH, is_expired: false });
    payViaPaymentRequestStub = sandbox.stub().rejects(new Error('no route'));
    getPaymentStub = sandbox
      .stub()
      .resolves({ is_confirmed: false, is_pending: false });

    payRequestModule = proxyquire('../../ln/pay_request', {
      lightning: {
        payViaPaymentRequest: payViaPaymentRequestStub,
        getPayment: getPaymentStub,
        deleteForwardingReputations: sandbox.stub().resolves(),
        '@noCallThru': true,
      },
      './connect': { default: {}, '@noCallThru': true },
      invoices: {
        parsePaymentRequest: parsePaymentRequestStub,
        '@noCallThru': true,
      },
      '../models': {
        Order: { updateOne: orderUpdateOneStub },
        User: { findOne: sandbox.stub().resolves({ _id: 'u1', tg_id: 't1' }) },
        PendingPayment: function (this: any) {
          this.save = sandbox.stub().resolves();
        },
        '@noCallThru': true,
      },
      '../util': {
        handleReputationItems: sandbox.stub().resolves(),
        getUserI18nContext: sandbox.stub().resolves({ t: (k: string) => k }),
        '@noCallThru': true,
      },
      '../bot/messages': {
        invoicePaymentFailedMessage: sandbox.stub().resolves(),
        toAdminChannelOrderErrorMessage: sandbox.stub().resolves(),
        '@noCallThru': true,
      },
      '../bot/modules/events/orders': {
        orderUpdated: sandbox.stub(),
        '@noCallThru': true,
      },
      '../logger': {
        logger: {
          info: sandbox.stub(),
          error: sandbox.stub(),
          warning: sandbox.stub(),
          debug: sandbox.stub(),
        },
        logTimeout: sandbox.stub(),
        logOperationDuration: sandbox.stub(),
        '@noCallThru': true,
      },
    });
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('persists the parsed payment hash on the order before paying', async () => {
    const order = makeFakeOrder();

    await payRequestModule.recordPayoutIntent(order, 'lnbc_new_invoice');

    sinon.assert.calledWithMatch(
      orderUpdateOneStub,
      { _id: ORDER_ID },
      { $set: { payout_hash: PARSED_PAYMENT_HASH } },
    );
    expect(order.payout_hash).to.equal(PARSED_PAYMENT_HASH);
  });

  it('never throws when the invoice cannot be parsed', async () => {
    parsePaymentRequestStub.throws(new Error('invalid invoice'));
    const order = makeFakeOrder();

    await payRequestModule.recordPayoutIntent(order, 'garbage');

    sinon.assert.notCalled(orderUpdateOneStub);
    expect(order.payout_hash).to.equal(null);
  });

  it('never blocks the payout when the DB write fails', async () => {
    orderUpdateOneStub.rejects(new Error('mongo down'));
    const order = makeFakeOrder();

    // Must resolve without throwing: this write is bookkeeping, the
    // completion path records the hash again.
    await payRequestModule.recordPayoutIntent(order, 'lnbc_new_invoice');
  });

  it('payToBuyer records the payout intent before any payment attempt', async () => {
    const order = makeFakeOrder();

    await payRequestModule.payToBuyer({ telegram: {} }, order);

    // The intent write must land BEFORE the LND payment call.
    sinon.assert.calledWithMatch(
      orderUpdateOneStub,
      { _id: ORDER_ID },
      { $set: { payout_hash: PARSED_PAYMENT_HASH } },
    );
    sinon.assert.callOrder(orderUpdateOneStub, payViaPaymentRequestStub);
  });
});

export {};
