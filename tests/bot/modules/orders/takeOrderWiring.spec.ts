export {};

const { expect } = require('chai');
const sinon = require('sinon');
const proxyquire = require('proxyquire');

// Regression guard: reserveTakeSlot must gate takebuy/takesell. We drive each
// entry point with a taker that is already inside an active cooldown and assert
// the take is rejected before the order is persisted. If someone unwires
// reserveTakeSlot, order.save() would run and these tests would fail.
//
// The REAL util is used (so the real PerOrderIdMutex/PerUserIdMutex run); only
// the heavy/side-effecting helpers are overridden.
const realUtil = require('../../../../util');

const TAKER_ID = '61006f0e85ad4f96cde94141';
const MAKER_ID = '61006f0e85ad4f96cde94142';
const ORDER_ID = '61006f0e85ad4f96cde94143';

const orderSave = sinon.stub().resolves();

const makeOrder = (type: string) => ({
  _id: ORDER_ID,
  type,
  status: type === 'buy' ? 'PENDING' : 'PENDING',
  community_id: null,
  buyer_id: type === 'buy' ? MAKER_ID : null,
  seller_id: type === 'sell' ? MAKER_ID : null,
  creator_id: MAKER_ID,
  save: orderSave,
});

const maker = { _id: MAKER_ID, counterparty_requirements: undefined };

const modelsMock = {
  Order: { findOne: sinon.stub() },
  User: {
    findOne: sinon.stub().resolves(maker),
    // reserveTakeSlot reads the persisted taker: already at the cap with an
    // active cooldown, so the take must be blocked.
    findById: sinon.stub().callsFake(async () => ({
      _id: TAKER_ID,
      take_order_count: 10,
      take_order_cooldown_until: new Date(Date.now() + 60 * 60 * 1000),
      save: sinon.stub().resolves(),
    })),
  },
  Block: { exists: sinon.stub().resolves(null) },
  '@noCallThru': true,
};

const messagesMock = {
  orderTakeRateLimitMessage: sinon.stub().resolves(),
  '@noCallThru': true,
};

const validationsMock = {
  validateObjectId: sinon.stub().resolves(true),
  validateTakeBuyOrder: sinon.stub().resolves(true),
  validateTakeSellOrder: sinon.stub().resolves(true),
  isBannedFromCommunity: sinon.stub().resolves(false),
  '@noCallThru': true,
};

const { takebuy, takesell } = proxyquire(
  '../../../../bot/modules/orders/takeOrder',
  {
    '../../../models': modelsMock,
    '../../messages': messagesMock,
    '../../validations': validationsMock,
    '../../../util': {
      ...realUtil,
      generateRandomImage: () => ({ randomImage: 'x' }),
      deleteOrderFromChannel: sinon.stub().resolves(),
    },
  },
);

describe('take rate limit — wired into takebuy/takesell', () => {
  const bot: any = { telegram: {} };

  beforeEach(() => {
    orderSave.resetHistory();
    messagesMock.orderTakeRateLimitMessage.resetHistory();
    process.env.MAX_ORDERS_TAKE = '10';
    process.env.ORDER_TAKE_COOLDOWN_HOURS = '24';
  });

  it('takebuy blocks and does not persist when the taker is rate-limited', async () => {
    modelsMock.Order.findOne.resolves(makeOrder('buy'));
    const ctx: any = { user: { _id: TAKER_ID } };

    await takebuy(ctx, bot, ORDER_ID);

    expect(messagesMock.orderTakeRateLimitMessage.calledOnce).to.equal(true);
    expect(orderSave.called).to.equal(false);
  });

  it('takesell blocks and does not persist when the taker is rate-limited', async () => {
    modelsMock.Order.findOne.resolves(makeOrder('sell'));
    const ctx: any = { user: { _id: TAKER_ID } };

    await takesell(ctx, bot, ORDER_ID);

    expect(messagesMock.orderTakeRateLimitMessage.calledOnce).to.equal(true);
    expect(orderSave.called).to.equal(false);
  });
});
