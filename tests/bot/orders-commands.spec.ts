export {};

const { expect } = require('chai');
const sinon = require('sinon');

const { Order } = require('../../models');
const validations = require('../../bot/validations');
const ordersActions = require('../../bot/ordersActions');
const messages = require('../../bot/messages');
const communityHelper = require('../../util/communityHelper');
const { buy, sell } = require('../../bot/modules/orders/commands');

/**
 * Command-path integration tests for /buy and /sell.
 *
 * These exercise the whole handler through resolveOrderCommunity and assert the
 * community_id actually handed to createOrder. That is the integration where the
 * previous private-vs-group routing bug lived: the helper-only tests would pass
 * even with that bug present, because they never run the command handler.
 */
describe('/buy and /sell community routing (command path)', () => {
  const user: any = { _id: 'user-1', default_community_id: undefined };

  let createOrder: any;

  const buildCtx = (chatType: string, params: any) => {
    const ctx: any = {
      user,
      i18n: { t: (k: string) => k },
      message: { chat: { type: chatType, id: -1001234567890 } },
      reply: sinon.stub().resolves(),
      deleteMessage: sinon.stub().resolves(),
    };
    // validateBuyOrder / validateSellOrder return the parsed params
    validations.validateBuyOrder.resolves(params);
    validations.validateSellOrder.resolves(params);
    return ctx;
  };

  beforeEach(() => {
    // isMaxPending -> not maxed out
    sinon.stub(Order, 'countDocuments').resolves(0);
    process.env.MAX_PENDING_ORDERS = process.env.MAX_PENDING_ORDERS || '5';

    // Sellers are always allowed to continue
    sinon.stub(validations, 'validateSeller').resolves(true);
    sinon.stub(validations, 'validateBuyOrder');
    sinon.stub(validations, 'validateSellOrder');

    // Currency supported by default; overridden per-test when needed
    sinon.stub(communityHelper, 'isCurrencySupported').returns(true);
    sinon.stub(communityHelper, 'getCommunityByIdentifier');
    sinon.stub(communityHelper, 'getCommunityInfo');

    // Capture the payload sent to createOrder and return a truthy order
    createOrder = sinon
      .stub(ordersActions, 'createOrder')
      .resolves({ _id: 'order-1' });

    // Silence publishing / error messages
    sinon.stub(messages, 'publishBuyOrderMessage').resolves();
    sinon.stub(messages, 'publishSellOrderMessage').resolves();
    sinon.stub(messages, 'bannedUserErrorMessage').resolves();
    sinon.stub(messages, 'currencyNotSupportedMessage').resolves();
  });

  afterEach(() => sinon.restore());

  const baseParams = {
    amount: 1000,
    fiatAmount: [100],
    fiatCode: 'USD',
    paymentMethod: 'cash',
    priceMargin: 0,
  };

  it('routes /buy to an explicit community by numeric group id in a group chat', async () => {
    const community = { _id: 'community-A', public: true, banned_users: [] };
    communityHelper.getCommunityByIdentifier.resolves({
      community,
      communityId: 'community-A',
      isBanned: false,
    });

    const ctx = buildCtx('supergroup', {
      ...baseParams,
      communityName: '-1009999999999',
    });
    await buy(ctx);

    expect(communityHelper.getCommunityByIdentifier.calledOnce).to.equal(true);
    expect(communityHelper.getCommunityByIdentifier.firstCall.args[1]).to.equal(
      '-1009999999999',
    );
    expect(createOrder.calledOnce).to.equal(true);
    expect(createOrder.firstCall.args[3].community_id).to.equal('community-A');
    expect(createOrder.firstCall.args[3].type).to.equal('buy');
  });

  it('explicit community takes precedence over the group community for /sell', async () => {
    const explicit = {
      _id: 'community-explicit',
      public: true,
      banned_users: [],
    };
    communityHelper.getCommunityByIdentifier.resolves({
      community: explicit,
      communityId: 'community-explicit',
      isBanned: false,
    });

    const ctx = buildCtx('supergroup', {
      ...baseParams,
      communityName: 'explicitName',
    });
    await sell(ctx);

    // The explicit destination wins; the group fallback is never consulted
    expect(communityHelper.getCommunityInfo.called).to.equal(false);
    expect(createOrder.firstCall.args[3].community_id).to.equal(
      'community-explicit',
    );
  });

  it('falls back to the group community when no explicit community is passed', async () => {
    const groupCommunity = {
      _id: 'community-group',
      public: true,
      banned_users: [],
    };
    communityHelper.getCommunityInfo.resolves({
      community: groupCommunity,
      communityId: 'community-group',
      isBanned: false,
    });

    const ctx = buildCtx('supergroup', {
      ...baseParams,
      communityName: undefined,
    });
    await buy(ctx);

    expect(communityHelper.getCommunityByIdentifier.called).to.equal(false);
    expect(communityHelper.getCommunityInfo.calledOnce).to.equal(true);
    expect(createOrder.firstCall.args[3].community_id).to.equal(
      'community-group',
    );
  });

  it('publishes to the explicit community from a private chat', async () => {
    const community = {
      _id: 'community-priv',
      public: false,
      banned_users: [],
    };
    communityHelper.getCommunityByIdentifier.resolves({
      community,
      communityId: 'community-priv',
      isBanned: false,
    });

    const ctx = buildCtx('private', {
      ...baseParams,
      communityName: '-1001234567890',
    });
    await buy(ctx);

    expect(createOrder.firstCall.args[3].community_id).to.equal(
      'community-priv',
    );
  });

  it('rejects and does not create an order when the user is banned', async () => {
    const community = { _id: 'community-A', public: true, banned_users: [] };
    communityHelper.getCommunityByIdentifier.resolves({
      community,
      communityId: 'community-A',
      isBanned: true,
    });

    const ctx = buildCtx('private', {
      ...baseParams,
      communityName: 'someName',
    });
    await sell(ctx);

    expect(messages.bannedUserErrorMessage.calledOnce).to.equal(true);
    expect(createOrder.called).to.equal(false);
  });

  it('rejects and does not create an order when the currency is unsupported', async () => {
    const community = {
      _id: 'community-A',
      public: true,
      banned_users: [],
      currencies: ['EUR'],
    };
    communityHelper.getCommunityByIdentifier.resolves({
      community,
      communityId: 'community-A',
      isBanned: false,
    });
    communityHelper.isCurrencySupported.returns(false);

    const ctx = buildCtx('private', {
      ...baseParams,
      communityName: 'someName',
    });
    await buy(ctx);

    expect(messages.currencyNotSupportedMessage.calledOnce).to.equal(true);
    expect(createOrder.called).to.equal(false);
  });

  it('stops without creating an order when an explicit community is not found', async () => {
    communityHelper.getCommunityByIdentifier.resolves({
      community: null,
      communityId: undefined,
      isBanned: false,
    });

    const ctx = buildCtx('private', { ...baseParams, communityName: 'ghost' });
    await buy(ctx);

    expect(ctx.reply.calledWith('community_not_found')).to.equal(true);
    expect(createOrder.called).to.equal(false);
  });
});
