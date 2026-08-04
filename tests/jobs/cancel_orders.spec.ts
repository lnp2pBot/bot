const { expect } = require('chai');
const sinon = require('sinon');
const proxyquire = require('proxyquire');

proxyquire.noCallThru();

describe('Job: cancel_orders (ACTIVE hold invoice cancellation branch)', () => {
  let sandbox: any;
  let cancelOrders: any;

  let orderFindStub: any;
  let orderFindByIdStub: any;
  let userFindOneStub: any;
  let cancelHoldInvoiceStub: any;
  let toBuyerHoldInvoiceExpiredMessageStub: any;
  let toSellerHoldInvoiceExpiredMessageStub: any;
  let orderUpdatedStub: any;
  let loggerWarningStub: any;
  let loggerErrorStub: any;
  let getUserI18nContextStub: any;

  let expiredOrders: any[];
  let updatedOrder: any;

  const buyerUser = { _id: 'buyer1' };
  const sellerUser = { _id: 'seller1' };
  const i18nCtx = { t: (key: string) => key };

  beforeEach(() => {
    sandbox = sinon.createSandbox();

    orderFindByIdStub = sandbox.stub().callsFake(async () => updatedOrder);

    // The job runs three separate Order.find queries; only the "expired
    // orders" query (no `$and`, no `admin_warned`) is relevant here.
    orderFindStub = sandbox.stub().callsFake(async (query: any) => {
      if (query && ('$and' in query || 'admin_warned' in query)) return [];
      return expiredOrders;
    });

    userFindOneStub = sandbox.stub().callsFake(async ({ _id }: any) => {
      if (_id === 'buyer1') return buyerUser;
      if (_id === 'seller1') return sellerUser;
      return null;
    });

    cancelHoldInvoiceStub = sandbox.stub().resolves();
    toBuyerHoldInvoiceExpiredMessageStub = sandbox.stub().resolves();
    toSellerHoldInvoiceExpiredMessageStub = sandbox.stub().resolves();
    orderUpdatedStub = sandbox.stub();
    loggerWarningStub = sandbox.stub();
    loggerErrorStub = sandbox.stub();
    getUserI18nContextStub = sandbox.stub().resolves(i18nCtx);

    const jobModule = proxyquire('../../jobs/cancel_orders', {
      '../models': {
        User: { findOne: userFindOneStub },
        Order: { find: orderFindStub, findById: orderFindByIdStub },
      },
      '../bot/commands': {
        cancelShowHoldInvoice: sandbox.stub().resolves(),
        cancelAddInvoice: sandbox.stub().resolves(),
      },
      '../ln': { cancelHoldInvoice: cancelHoldInvoiceStub },
      '../bot/messages': {
        expiredOrderMessage: sandbox.stub().resolves(),
        toBuyerExpiredOrderMessage: sandbox.stub().resolves(),
        toSellerExpiredOrderMessage: sandbox.stub().resolves(),
        toBuyerHoldInvoiceExpiredMessage: toBuyerHoldInvoiceExpiredMessageStub,
        toSellerHoldInvoiceExpiredMessage:
          toSellerHoldInvoiceExpiredMessageStub,
      },
      '../util': {
        getUserI18nContext: getUserI18nContextStub,
        holdInvoiceExpirationInSecs: () => ({
          expirationTimeInSecs: 0,
          safetyWindowInSecs: 0,
        }),
        PerOrderIdMutex: {
          instance: {
            runExclusive: async (_id: string, cb: () => Promise<any>) => cb(),
          },
        },
      },
      '../logger': {
        logger: {
          error: loggerErrorStub,
          warning: loggerWarningStub,
          info: sandbox.stub(),
        },
      },
      '../bot/modules/events/orders': { orderUpdated: orderUpdatedStub },
    });

    cancelOrders = jobModule.default;
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('marks an ACTIVE order with a hash as EXPIRED when cancelHoldInvoice succeeds', async () => {
    updatedOrder = {
      _id: 'order1',
      id: 'order1',
      status: 'ACTIVE',
      hash: 'hash1',
      buyer_id: 'buyer1',
      seller_id: 'seller1',
      save: sandbox.stub().resolves(),
    };
    expiredOrders = [{ _id: 'order1' }];

    await cancelOrders({} as any);

    expect(cancelHoldInvoiceStub.calledOnceWith({ hash: 'hash1' })).to.equal(
      true,
    );
    expect(updatedOrder.status).to.equal('EXPIRED');
    expect(updatedOrder.save.calledOnce).to.equal(true);
    expect(toBuyerHoldInvoiceExpiredMessageStub.calledOnce).to.equal(true);
    expect(toSellerHoldInvoiceExpiredMessageStub.calledOnce).to.equal(true);
    expect(orderUpdatedStub.calledOnceWith(updatedOrder)).to.equal(true);
  });

  it('leaves the order ACTIVE and sends no messages when cancelHoldInvoice throws', async () => {
    updatedOrder = {
      _id: 'order1',
      id: 'order1',
      status: 'ACTIVE',
      hash: 'hash1',
      buyer_id: 'buyer1',
      seller_id: 'seller1',
      save: sandbox.stub().resolves(),
    };
    expiredOrders = [{ _id: 'order1' }];
    cancelHoldInvoiceStub.rejects(new Error('LND error: unable to cancel'));

    await cancelOrders({} as any);

    expect(cancelHoldInvoiceStub.calledOnceWith({ hash: 'hash1' })).to.equal(
      true,
    );
    expect(updatedOrder.status).to.equal('ACTIVE');
    expect(updatedOrder.save.called).to.equal(false);
    expect(toBuyerHoldInvoiceExpiredMessageStub.called).to.equal(false);
    expect(toSellerHoldInvoiceExpiredMessageStub.called).to.equal(false);
    expect(orderUpdatedStub.called).to.equal(false);
  });

  it('marks an ACTIVE order without a hash as EXPIRED without calling cancelHoldInvoice', async () => {
    updatedOrder = {
      _id: 'order1',
      id: 'order1',
      status: 'ACTIVE',
      hash: null,
      buyer_id: 'buyer1',
      seller_id: 'seller1',
      save: sandbox.stub().resolves(),
    };
    expiredOrders = [{ _id: 'order1' }];

    await cancelOrders({} as any);

    expect(cancelHoldInvoiceStub.called).to.equal(false);
    expect(updatedOrder.status).to.equal('EXPIRED');
    expect(updatedOrder.save.calledOnce).to.equal(true);
    expect(orderUpdatedStub.calledOnceWith(updatedOrder)).to.equal(true);
  });

  it('marks a FIAT_SENT order as EXPIRED without calling cancelHoldInvoice, warning instead', async () => {
    updatedOrder = {
      _id: 'order1',
      id: 'order1',
      status: 'FIAT_SENT',
      hash: 'hash1',
      buyer_id: 'buyer1',
      seller_id: 'seller1',
      save: sandbox.stub().resolves(),
    };
    expiredOrders = [{ _id: 'order1' }];

    await cancelOrders({} as any);

    expect(cancelHoldInvoiceStub.called).to.equal(false);
    expect(loggerWarningStub.calledOnce).to.equal(true);
    expect(loggerWarningStub.firstCall.args[0]).to.match(
      /dispute\/admin handling/,
    );
    expect(updatedOrder.status).to.equal('EXPIRED');
    expect(updatedOrder.save.calledOnce).to.equal(true);
    expect(orderUpdatedStub.calledOnceWith(updatedOrder)).to.equal(true);
  });
});

export {};
