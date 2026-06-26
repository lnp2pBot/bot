const { expect } = require('chai');
const sinon = require('sinon');
const proxyquire = require('proxyquire');

describe('Job: delete_published_orders (auto-republish)', () => {
  let sandbox: any;
  let findStub: any;
  let userFindOneStub: any;
  let deleteOrderFromChannelStub: any;
  let getUserI18nContextStub: any;
  let publishBuyStub: any;
  let publishSellStub: any;
  let bot: any;

  const loadJob = () =>
    proxyquire('../../jobs/delete_published_orders', {
      '../models': {
        Order: { find: findStub },
        User: { findOne: userFindOneStub },
      },
      '../util': {
        deleteOrderFromChannel: deleteOrderFromChannelStub,
        getUserI18nContext: getUserI18nContextStub,
      },
      '../bot/messages': {
        publishBuyOrderMessage: publishBuyStub,
        publishSellOrderMessage: publishSellStub,
      },
      '../logger': {
        logger: {
          info: sandbox.stub(),
          error: sandbox.stub(),
          warning: sandbox.stub(),
        },
      },
    }).default;

  const makeOrder = (overrides: any = {}) => ({
    _id: 'order-1',
    type: 'sell',
    creator_id: 'creator-1',
    republish_count: 0,
    created_at: new Date('2020-01-01T00:00:00Z'),
    toObject() {
      return { _id: this._id, type: this.type };
    },
    save: sinon.stub().resolves(),
    deleteOne: sinon.stub().resolves(),
    ...overrides,
  });

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    sandbox.stub(process, 'env').value({
      ORDER_PUBLISHED_EXPIRATION_WINDOW: '82800',
    });
    findStub = sinon.stub();
    userFindOneStub = sinon.stub();
    deleteOrderFromChannelStub = sinon.stub().resolves();
    getUserI18nContextStub = sinon.stub().resolves({});
    publishBuyStub = sinon.stub().resolves();
    publishSellStub = sinon.stub().resolves();
    bot = { telegram: {} };
  });

  afterEach(() => {
    sandbox.restore();
    sinon.restore();
  });

  it('only queries PENDING orders (disputed/active never republish)', async () => {
    findStub.resolves([]);
    await loadJob()(bot);
    expect(findStub.calledOnce).to.equal(true);
    expect(findStub.firstCall.args[0].status).to.equal('PENDING');
  });

  it('republishes a scheduled order and decrements the counter', async () => {
    const order = makeOrder({ republish_count: 5, type: 'sell' });
    findStub.resolves([order]);
    userFindOneStub.resolves({ _id: 'creator-1' });

    await loadJob()(bot);

    expect(order.republish_count).to.equal(4);
    expect(order.save.calledOnce).to.equal(true);
    expect(publishSellStub.calledOnce).to.equal(true);
    expect(deleteOrderFromChannelStub.calledOnce).to.equal(true);
    // It must NOT be deleted from the database
    expect(order.deleteOne.called).to.equal(false);
  });

  it('restarts the expiration window on republish (resets created_at)', async () => {
    const order = makeOrder({ republish_count: 2 });
    findStub.resolves([order]);
    userFindOneStub.resolves({ _id: 'creator-1' });
    const before = order.created_at.getTime();

    await loadJob()(bot);

    expect(order.created_at.getTime()).to.be.greaterThan(before);
  });

  it('uses the buy publisher for buy orders', async () => {
    const order = makeOrder({ republish_count: 1, type: 'buy' });
    findStub.resolves([order]);
    userFindOneStub.resolves({ _id: 'creator-1' });

    await loadJob()(bot);

    expect(publishBuyStub.calledOnce).to.equal(true);
    expect(publishSellStub.called).to.equal(false);
  });

  it('deletes the order when there are no republish cycles left', async () => {
    const order = makeOrder({ republish_count: 0 });
    findStub.resolves([order]);

    await loadJob()(bot);

    expect(order.deleteOne.calledOnce).to.equal(true);
    expect(deleteOrderFromChannelStub.calledOnce).to.equal(true);
    expect(publishSellStub.called).to.equal(false);
    expect(publishBuyStub.called).to.equal(false);
  });

  it('falls back to deletion when the creator no longer exists', async () => {
    const order = makeOrder({ republish_count: 3 });
    findStub.resolves([order]);
    userFindOneStub.resolves(null);

    await loadJob()(bot);

    expect(order.deleteOne.calledOnce).to.equal(true);
    expect(publishSellStub.called).to.equal(false);
  });
});

export {};
