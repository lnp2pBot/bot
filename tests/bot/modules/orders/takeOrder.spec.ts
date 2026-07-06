export {};

const { expect } = require('chai');
const sinon = require('sinon');
const proxyquire = require('proxyquire');

// Stub the two collaborators the requirements gate depends on so we can drive
// getUserAge and observe the denial message without loading the LN stack.
const getUserAgeStub = sinon.stub();
const messagesMock = {
  notMeetingRequirementsMessage: sinon.stub().resolves(),
  '@noCallThru': true,
};

const { meetsCounterpartyRequirements } = proxyquire(
  '../../../../bot/modules/orders/takeOrder',
  {
    '../../../util': { getUserAge: getUserAgeStub },
    '../../messages': messagesMock,
  },
);

describe('meetsCounterpartyRequirements', () => {
  const ctx: any = {};
  let taker: any;
  let maker: any;

  beforeEach(() => {
    getUserAgeStub.reset();
    messagesMock.notMeetingRequirementsMessage.resetHistory();
    taker = { tg_id: '1', trades_completed: 5, created_at: '2021-01-01' };
    maker = { tg_id: '2', counterparty_requirements: undefined };
  });

  it('passes legacy makers without requirements', async () => {
    const result = await meetsCounterpartyRequirements(ctx, taker, maker);
    expect(result).to.equal(true);
    expect(messagesMock.notMeetingRequirementsMessage.called).to.equal(false);
  });

  it('passes when requirements are all zero', async () => {
    maker.counterparty_requirements = {
      min_days_using_bot: 0,
      min_completed_orders: 0,
    };
    const result = await meetsCounterpartyRequirements(ctx, taker, maker);
    expect(result).to.equal(true);
    expect(messagesMock.notMeetingRequirementsMessage.called).to.equal(false);
  });

  it('passes when age equals the minimum (boundary)', async () => {
    getUserAgeStub.returns(30);
    maker.counterparty_requirements = {
      min_days_using_bot: 30,
      min_completed_orders: 0,
    };
    const result = await meetsCounterpartyRequirements(ctx, taker, maker);
    expect(result).to.equal(true);
    expect(messagesMock.notMeetingRequirementsMessage.called).to.equal(false);
  });

  it('fails and notifies when age is below the minimum', async () => {
    getUserAgeStub.returns(10);
    maker.counterparty_requirements = {
      min_days_using_bot: 30,
      min_completed_orders: 0,
    };
    const result = await meetsCounterpartyRequirements(ctx, taker, maker);
    expect(result).to.equal(false);
    expect(messagesMock.notMeetingRequirementsMessage.calledOnce).to.equal(
      true,
    );
    // The taker gets told the thresholds it failed.
    const params = messagesMock.notMeetingRequirementsMessage.firstCall.args[2];
    expect(params).to.deep.equal({
      failures: {
        age: true,
        orders: false,
      },
      min_days_using_bot: 30,
      min_completed_orders: 0,
      user_age: 10,
      user_trades: 5,
    });
  });

  it('passes when completed orders equal the minimum (boundary)', async () => {
    taker.trades_completed = 5;
    maker.counterparty_requirements = {
      min_days_using_bot: 0,
      min_completed_orders: 5,
    };
    const result = await meetsCounterpartyRequirements(ctx, taker, maker);
    expect(result).to.equal(true);
    expect(messagesMock.notMeetingRequirementsMessage.called).to.equal(false);
  });

  it('fails and notifies when completed orders are below the minimum', async () => {
    taker.trades_completed = 2;
    maker.counterparty_requirements = {
      min_days_using_bot: 0,
      min_completed_orders: 5,
    };
    const result = await meetsCounterpartyRequirements(ctx, taker, maker);
    expect(result).to.equal(false);
    expect(messagesMock.notMeetingRequirementsMessage.calledOnce).to.equal(
      true,
    );
  });

  it('lets legacy takers with no created_at (NaN age) pass the age check', async () => {
    getUserAgeStub.returns(NaN);
    maker.counterparty_requirements = {
      min_days_using_bot: 30,
      min_completed_orders: 0,
    };
    const result = await meetsCounterpartyRequirements(ctx, taker, maker);
    expect(result).to.equal(true);
    expect(messagesMock.notMeetingRequirementsMessage.called).to.equal(false);
  });
});
