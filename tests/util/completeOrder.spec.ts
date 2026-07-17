export {};

const { expect } = require('chai');
const sinon = require('sinon');
const proxyquire = require('proxyquire').noCallThru();

/**
 * Unit tests for issue #864: completeOrderAsSuccess must record the invoice that
 * was actually paid in order.buyer_invoice_paid (written atomically with the
 * SUCCESS flip) without ever overwriting the original order.buyer_invoice.
 */
describe('completeOrderAsSuccess (issue #864)', () => {
  afterEach(() => sinon.restore());

  function load({ won }: { won: any }) {
    const findOneAndUpdate = sinon.stub().resolves(won);
    const messages = {
      __esModule: true,
      toAdminChannelPendingPaymentSuccessMessage: sinon.stub().resolves(),
      toBuyerPendingPaymentSuccessMessage: sinon.stub().resolves(),
      rateUserMessage: sinon.stub().resolves(),
      toAdminChannelOrderErrorMessage: sinon.stub().resolves(),
    };
    const mod = proxyquire('../../util/completeOrder', {
      '../models': {
        Order: { findOneAndUpdate },
        User: { findOne: sinon.stub() },
      },
      '../bot/messages': messages,
      '../logger': { logger: { info: sinon.stub(), error: sinon.stub() } },
      '../util': {
        getUserI18nContext: sinon.stub().resolves({ t: (k: string) => k }),
      },
    });
    return {
      completeOrderAsSuccess: mod.completeOrderAsSuccess,
      findOneAndUpdate,
    };
  }

  const makeArgs = () => {
    const order: any = {
      _id: 'o1',
      buyer_id: 'b1',
      seller_id: 's1',
      buyer_invoice: 'lnbc-original',
      status: 'PAID_HOLD_INVOICE',
    };
    const buyerUser: any = {
      trades_completed: 0,
      save: sinon.stub().resolves(),
    };
    const sellerUser: any = {
      trades_completed: 0,
      save: sinon.stub().resolves(),
    };
    const payment: any = { fee: 7, id: 'real-hash', secret: 'preimage' };
    const i18nCtx: any = { t: (k: string) => k };
    return { order, buyerUser, sellerUser, payment, i18nCtx };
  };

  it('records buyer_invoice_paid atomically and in memory, keeping buyer_invoice, when paidInvoice is provided', async () => {
    const { order, buyerUser, sellerUser, payment, i18nCtx } = makeArgs();
    const { completeOrderAsSuccess, findOneAndUpdate } = load({
      won: { _id: 'o1' },
    });

    const result = await completeOrderAsSuccess(
      {} as any,
      order,
      payment,
      buyerUser,
      sellerUser,
      i18nCtx,
      undefined,
      'lnbc-new-retry',
    );

    expect(result).to.equal(true);
    // Written in the same atomic $set as the SUCCESS flip.
    const setArg = findOneAndUpdate.firstCall.args[1].$set;
    expect(setArg.status).to.equal('SUCCESS');
    expect(setArg.routing_fee).to.equal(7);
    expect(setArg.buyer_invoice_paid).to.equal('lnbc-new-retry');
    // ...and mirrored in memory, with the original preserved.
    expect(order.buyer_invoice_paid).to.equal('lnbc-new-retry');
    expect(order.buyer_invoice).to.equal('lnbc-original');
  });

  it('does not set buyer_invoice_paid when no paidInvoice is provided', async () => {
    const { order, buyerUser, sellerUser, payment, i18nCtx } = makeArgs();
    const { completeOrderAsSuccess, findOneAndUpdate } = load({
      won: { _id: 'o1' },
    });

    await completeOrderAsSuccess(
      {} as any,
      order,
      payment,
      buyerUser,
      sellerUser,
      i18nCtx,
    );

    const setArg = findOneAndUpdate.firstCall.args[1].$set;
    expect('buyer_invoice_paid' in setArg).to.equal(false);
    expect(order.buyer_invoice_paid).to.equal(undefined);
  });

  it('returns false and leaves buyer_invoice_paid untouched when it loses the CAS race', async () => {
    const { order, buyerUser, sellerUser, payment, i18nCtx } = makeArgs();
    const { completeOrderAsSuccess } = load({ won: null });

    const result = await completeOrderAsSuccess(
      {} as any,
      order,
      payment,
      buyerUser,
      sellerUser,
      i18nCtx,
      undefined,
      'lnbc-new-retry',
    );

    expect(result).to.equal(false);
    expect(order.buyer_invoice_paid).to.equal(undefined);
    expect(order.status).to.equal('PAID_HOLD_INVOICE');
  });
});
