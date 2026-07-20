export {};

const { expect } = require('chai');
const sinon = require('sinon');
const proxyquire = require('proxyquire');

// We only care about the take-limit reset side effect here, so Order.find is
// stubbed to return no previous SUCCESS orders (the "first completed trade"
// branch). The real PerUserIdMutex defined inside util is used.
const orderFindStub = sinon.stub().resolves([]);

const { handleReputationItems } = proxyquire('../../util/index', {
  '../models': {
    Order: { find: orderFindStub },
    Community: {},
    User: {},
    '@noCallThru': true,
  },
});

describe('handleReputationItems — take-limit reset', () => {
  beforeEach(() => {
    orderFindStub.resetHistory();
  });

  const makeUser = () => ({
    _id: '61006f0e85ad4f96cde94141',
    trades_completed: 3,
    volume_traded: 1000,
    take_order_count: 7,
    take_order_cooldown_until: new Date(Date.now() + 60 * 60 * 1000),
    save: sinon.stub().resolves(),
  });

  it('zeroes take_order_count and clears the cooldown for both parties', async () => {
    const buyer = makeUser();
    const seller = makeUser();
    seller._id = '61006f0e85ad4f96cde94142';

    await handleReputationItems(buyer, seller, 500);

    expect(buyer.take_order_count).to.equal(0);
    expect(buyer.take_order_cooldown_until).to.equal(null);
    expect(seller.take_order_count).to.equal(0);
    expect(seller.take_order_cooldown_until).to.equal(null);
    // The reset is persisted for each user.
    expect(buyer.save.called).to.equal(true);
    expect(seller.save.called).to.equal(true);
  });
});
