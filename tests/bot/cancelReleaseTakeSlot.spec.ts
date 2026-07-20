export {};

const { expect } = require('chai');
const sinon = require('sinon');
const proxyquire = require('proxyquire');

// H1: an honest taker must not be penalized for the maker's behavior. When a
// WAITING order is CLOSED because the maker failed/cancelled, the taker's take
// slot is released; when the order is republished (the TAKER failed), it is not.
// These tests assert the wiring of that fix by spying releaseTakeSlot.

const releaseTakeSlot = sinon.stub().resolves();

// Builds a permissive namespace mock: any property is a resolved stub. The
// __esModule flag makes TS's __importStar return it untouched at load time.
const nsMock = () =>
  new Proxy(
    { __esModule: true },
    { get: (_t, k) => (k === '__esModule' ? true : sinon.stub().resolves()) },
  );

// A permissive messages mock: every message helper is a resolved stub.
const messagesMock: any = nsMock();

const BUYER = { _id: 'buyer1', tg_id: '111' };
const SELLER = { _id: 'seller1', tg_id: '222' };

const modelsMock = {
  Order: {},
  User: {
    findOne: sinon.stub().callsFake(async ({ _id }: any) => {
      if (_id === BUYER._id) return BUYER;
      if (_id === SELLER._id) return SELLER;
      return null;
    }),
  },
  Dispute: {},
  '@noCallThru': true,
};

const lnMock = {
  createHoldInvoice: sinon.stub().resolves(),
  subscribeInvoice: sinon.stub().resolves(),
  cancelHoldInvoice: sinon.stub().resolves(),
  settleHoldInvoice: sinon.stub().resolves(),
  getInvoice: sinon.stub().resolves(),
  '@noCallThru': true,
};

const utilMock = {
  getBtcFiatPrice: sinon.stub().resolves(),
  deleteOrderFromChannel: sinon.stub().resolves(),
  getUserI18nContext: sinon.stub().resolves({ t: (k: string) => k }),
  getFee: sinon.stub().resolves(0),
  removeLightningPrefix: sinon.stub(),
  PerOrderIdMutex: {
    instance: { runExclusive: async (_: any, cb: any) => cb() },
  },
  '@noCallThru': true,
};

const { cancelShowHoldInvoice, cancelAddInvoice } = proxyquire(
  '../../bot/commands',
  {
    '../ln': lnMock,
    '../models': modelsMock,
    './messages': messagesMock,
    '../util': utilMock,
    './modules/orders/takeOrder': { releaseTakeSlot, '@noCallThru': true },
    '../lnurl/lnurl-pay': {
      resolvLightningAddress: sinon.stub(),
      '@noCallThru': true,
    },
    './modules/events/orders': nsMock(),
    './ordersActions': nsMock(),
    './validations': nsMock(),
  },
);

describe('cancel releases the take slot for the honest taker (H1)', () => {
  const job = {};

  beforeEach(() => {
    releaseTakeSlot.resetHistory();
  });

  it('sell order expired because the seller (maker) never paid → releases the buyer (taker)', async () => {
    // sell order: creator = seller, taker = buyer. Status WAITING_PAYMENT and
    // creator === seller_id → CLOSED branch.
    const order: any = {
      _id: 'o1',
      type: 'sell',
      status: 'WAITING_PAYMENT',
      hash: null,
      buyer_id: BUYER._id,
      seller_id: SELLER._id,
      creator_id: SELLER._id,
      save: sinon.stub().resolves(),
    };

    await cancelShowHoldInvoice(null as any, order, job);

    expect(releaseTakeSlot.calledOnce).to.equal(true);
    expect(releaseTakeSlot.firstCall.args[0]).to.equal(BUYER);
    expect(order.status).to.equal('CLOSED');
  });

  it('buy order expired because the seller (taker) never paid → republished, slot NOT released', async () => {
    // buy order: creator = buyer, taker = seller. Status WAITING_PAYMENT and
    // creator === buyer_id → republish (else) branch: the taker failed.
    const order: any = {
      _id: 'o2',
      type: 'buy',
      status: 'WAITING_PAYMENT',
      hash: null,
      buyer_id: BUYER._id,
      seller_id: SELLER._id,
      creator_id: BUYER._id,
      save: sinon.stub().resolves(),
    };

    await cancelShowHoldInvoice(null as any, order, job);

    expect(releaseTakeSlot.called).to.equal(false);
    expect(order.status).to.equal('PENDING');
  });

  it('buy order expired because the buyer (maker) never added the invoice → releases the seller (taker)', async () => {
    // buy order: creator = buyer, taker = seller. Status WAITING_BUYER_INVOICE
    // and creator === buyer_id → CLOSED branch.
    const order: any = {
      _id: 'o3',
      type: 'buy',
      status: 'WAITING_BUYER_INVOICE',
      hash: null,
      buyer_id: BUYER._id,
      seller_id: SELLER._id,
      creator_id: BUYER._id,
      save: sinon.stub().resolves(),
    };

    await cancelAddInvoice(null as any, order, job);

    expect(releaseTakeSlot.calledOnce).to.equal(true);
    expect(releaseTakeSlot.firstCall.args[0]).to.equal(SELLER);
    expect(order.status).to.equal('CLOSED');
  });

  it('sell order expired because the buyer (taker) never added the invoice → republished, slot NOT released', async () => {
    // sell order: creator = seller, taker = buyer. Status WAITING_BUYER_INVOICE
    // and creator === seller_id → republish (else) branch: the taker failed.
    const order: any = {
      _id: 'o4',
      type: 'sell',
      status: 'WAITING_BUYER_INVOICE',
      hash: null,
      buyer_id: BUYER._id,
      seller_id: SELLER._id,
      creator_id: SELLER._id,
      save: sinon.stub().resolves(),
    };

    await cancelAddInvoice(null as any, order, job);

    expect(releaseTakeSlot.called).to.equal(false);
    expect(order.status).to.equal('PENDING');
  });
});
