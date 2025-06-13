import { expect } from 'chai';
import * as sinon from 'sinon';
const proxyquire = require('proxyquire');

describe('Complex Utility Functions', () => {
  let sandbox: any;
  let utilStub: any;
  let axiosStub: any;
  let loggerStub: any;
  let OrderStub: any;
  let CommunityStub: any;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    
    axiosStub = {
      get: sinon.stub(),
    };

    loggerStub = {
      error: sinon.stub(),
      debug: sinon.stub(),
      info: sinon.stub(),
      warn: sinon.stub(),
    };

    OrderStub = {
      find: sinon.stub(),
      findOne: sinon.stub(),
    };

    CommunityStub = {
      findOne: sinon.stub(),
      findById: sinon.stub(),
    };

    // Stub environment variables
    sandbox.stub(process, 'env').value({
      FIAT_RATE_EP: 'https://api.example.com',
      MAX_FEE: '0.01',
      FEE_PERCENT: '0.7',
      CHANNEL: '@testchannel',
      DISPUTE_CHANNEL: '@disputechannel',
    });

    utilStub = proxyquire('../../util', {
      axios: axiosStub,
      '../logger': { logger: loggerStub },
      '../models': {
        Order: OrderStub,
        Community: CommunityStub,
      },
    });
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('getBtcFiatPrice', () => {
    it('should return BTC price in sats for valid fiat amount', async () => {
      const mockResponse = {
        data: {
          btc: 50000, // $50,000 per BTC
        },
      };
      axiosStub.get.resolves(mockResponse);

      const sats = await utilStub.getBtcFiatPrice('USD', 500); // $500
      const expectedSats = (500 / 50000) * 100000000; // 1M sats
      expect(sats).to.equal(expectedSats);
    });

    it('should return 0 for API error response', async () => {
      const mockResponse = {
        data: {
          error: 'API Error',
        },
      };
      axiosStub.get.resolves(mockResponse);

      const sats = await utilStub.getBtcFiatPrice('USD', 500);
      expect(sats).to.equal(0);
    });

    it('should return undefined for invalid currency', async () => {
      const result = await utilStub.getBtcFiatPrice('INVALID', 500);
      expect(result).to.be.undefined;
    });

    it('should handle network errors gracefully', async () => {
      axiosStub.get.rejects(new Error('Network error'));

      const result = await utilStub.getBtcFiatPrice('USD', 500);
      expect(result).to.be.undefined;
      expect(loggerStub.error.calledOnce).to.equal(true);
    });
  });

  describe('getBtcExchangePrice', () => {
    it('should calculate correct exchange rate', () => {
      const fiatAmount = 100;
      const satsAmount = 200000; // 0.002 BTC
      const expectedRate = (1e8 * fiatAmount) / satsAmount; // 50,000,000

      const rate = utilStub.getBtcExchangePrice(fiatAmount, satsAmount);
      expect(rate).to.equal(expectedRate);
    });

    it('should handle division by zero', () => {
      const result = utilStub.getBtcExchangePrice(100, 0);
      expect(result).to.equal(Infinity);
    });

    it('should handle errors gracefully', () => {
      // getBtcExchangePrice returns NaN for invalid inputs, not undefined
      const result = utilStub.getBtcExchangePrice(null, null);
      expect(result).to.be.NaN;
    });
  });

  describe('handleReputationItems', () => {
    let buyer: any, seller: any;

    beforeEach(() => {
      buyer = {
        _id: 'buyer123',
        trades_completed: 5,
        volume_traded: 1000000,
        save: sinon.stub().resolves(),
      };

      seller = {
        _id: 'seller123',
        trades_completed: 3,
        volume_traded: 500000,
        save: sinon.stub().resolves(),
      };
    });

    it('should increment stats for new legitimate trade', async () => {
      OrderStub.find.resolves([]); // No circular trades found

      await utilStub.handleReputationItems(buyer, seller, 100000);

      expect(buyer.trades_completed).to.equal(6);
      expect(seller.trades_completed).to.equal(4);
      expect(buyer.volume_traded).to.equal(1100000);
      expect(seller.volume_traded).to.equal(600000);
      expect(buyer.save.calledOnce).to.equal(true);
      expect(seller.save.calledOnce).to.equal(true);
    });

    it('should decrease stats for circular trades when current amount is larger', async () => {
      const circularOrders = [
        { amount: 50000 },
        { amount: 30000 },
      ];
      OrderStub.find.resolves(circularOrders);

      await utilStub.handleReputationItems(buyer, seller, 100000); // Larger than last order (30000)

      // Should decrease by number of circular orders
      expect(buyer.trades_completed).to.equal(3); // 5 - 2
      expect(seller.trades_completed).to.equal(1); // 3 - 2
      expect(buyer.volume_traded).to.equal(920000); // 1000000 - 80000
      expect(seller.volume_traded).to.equal(420000); // 500000 - 80000
    });

    it('should decrease stats by one trade when current amount is smaller', async () => {
      const circularOrders = [
        { amount: 50000 },
        { amount: 100000 }, // Last order is larger than current
      ];
      OrderStub.find.resolves(circularOrders);

      await utilStub.handleReputationItems(buyer, seller, 80000); // Smaller than last order

      expect(buyer.trades_completed).to.equal(4); // 5 - 1
      expect(seller.trades_completed).to.equal(2); // 3 - 1
      expect(buyer.volume_traded).to.equal(920000); // 1000000 - 80000
      expect(seller.volume_traded).to.equal(420000); // 500000 - 80000
    });

    it('should not go below zero for trades_completed', async () => {
      buyer.trades_completed = 1;
      seller.trades_completed = 1;

      const circularOrders = [
        { amount: 50000 },
        { amount: 30000 },
        { amount: 20000 },
      ];
      OrderStub.find.resolves(circularOrders);

      await utilStub.handleReputationItems(buyer, seller, 100000);

      expect(buyer.trades_completed).to.equal(0);
      expect(seller.trades_completed).to.equal(0);
    });

    it('should handle database errors gracefully', async () => {
      OrderStub.find.rejects(new Error('Database error'));

      await utilStub.handleReputationItems(buyer, seller, 100000);

      expect(loggerStub.error.calledOnce).to.equal(true);
    });
  });

  describe('isGroupAdmin', () => {
    let telegramStub: any;
    let user: any;

    beforeEach(() => {
      telegramStub = {
        getChatMember: sinon.stub(),
      };

      user = {
        tg_id: '123456',
        username: 'testuser',
      };
    });

    it('should return success for group creator', async () => {
      telegramStub.getChatMember.resolves({
        status: 'creator',
      });

      const result = await utilStub.isGroupAdmin('groupId', user, telegramStub);

      expect(result.success).to.equal(true);
      expect(result.message).to.include('creator');
    });

    it('should return success for group administrator', async () => {
      telegramStub.getChatMember.resolves({
        status: 'administrator',
      });

      const result = await utilStub.isGroupAdmin('groupId', user, telegramStub);

      expect(result.success).to.equal(true);
      expect(result.message).to.include('administrator');
    });

    it('should return failure for regular member', async () => {
      telegramStub.getChatMember.resolves({
        status: 'member',
      });

      const result = await utilStub.isGroupAdmin('groupId', user, telegramStub);

      expect(result.success).to.equal(false);
      expect(result.message).to.include('not an admin');
    });

    it('should return failure for user who left the group', async () => {
      telegramStub.getChatMember.resolves({
        status: 'left',
      });

      const result = await utilStub.isGroupAdmin('groupId', user, telegramStub);

      expect(result.success).to.equal(false);
      expect(result.message).to.include('not a member');
    });

    it('should handle Telegram API errors', async () => {
      telegramStub.getChatMember.rejects(new Error('Telegram API error'));

      const result = await utilStub.isGroupAdmin('groupId', user, telegramStub);

      expect(result.success).to.equal(false);
      expect(result.message).to.include('Telegram API error');
      expect(loggerStub.error.calledOnce).to.equal(true);
    });
  });

  describe('getFee', () => {
    beforeEach(() => {
      CommunityStub.findOne.resolves({
        fee: 50, // 50% of community fee
      });
    });

    it('should return max fee for no community and non-golden honey badger', async () => {
      const amount = 100000;
      const maxFee = Math.round(amount * 0.01); // 1000 sats

      const fee = await utilStub.getFee(amount, null, false);
      expect(fee).to.equal(maxFee);
    });

    it('should return 0 for no community and golden honey badger', async () => {
      const amount = 100000;

      const fee = await utilStub.getFee(amount, null, true);
      expect(fee).to.equal(0);
    });

    it('should calculate combined bot and community fee', async () => {
      const amount = 100000;
      const maxFee = Math.round(amount * 0.01); // 1000 sats
      const botFee = maxFee * 0.7; // 700 sats
      const communityFee = Math.round(maxFee - botFee) * 0.5; // 150 sats (50% of 300)

      const fee = await utilStub.getFee(amount, 'communityId', false);
      expect(fee).to.equal(botFee + communityFee);
    });

    it('should return only community fee for golden honey badger', async () => {
      const amount = 100000;
      const maxFee = Math.round(amount * 0.01); // 1000 sats
      const communityFee = Math.round(maxFee - (maxFee * 0.7)) * 0.5; // 150 sats

      const fee = await utilStub.getFee(amount, 'communityId', true);
      expect(fee).to.equal(communityFee);
    });

    it('should handle missing community', async () => {
      CommunityStub.findOne.resolves(null);

      try {
        await utilStub.getFee(100000, 'invalidCommunityId', false);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('Community was not found');
      }
    });
  });

  describe('getOrderChannel', () => {
    it('should return default channel for orders without community', async () => {
      const order = { type: 'sell' };

      const channel = await utilStub.getOrderChannel(order);
      expect(channel).to.equal('@testchannel');
    });

    it('should return community channel for single channel setup', async () => {
      const order = { type: 'sell', community_id: 'communityId' };
      CommunityStub.findOne.resolves({
        order_channels: [{ name: '@communitychannel' }],
      });

      const channel = await utilStub.getOrderChannel(order);
      expect(channel).to.equal('@communitychannel');
    });

    it('should return type-specific channel for multi-channel setup', async () => {
      const order = { type: 'buy', community_id: 'communityId' };
      CommunityStub.findOne.resolves({
        order_channels: [
          { name: '@sellchannel', type: 'sell' },
          { name: '@buychannel', type: 'buy' },
        ],
      });

      const channel = await utilStub.getOrderChannel(order);
      expect(channel).to.equal('@buychannel');
    });

    it('should return default channel if community not found', async () => {
      const order = { type: 'sell', community_id: 'invalidId' };
      CommunityStub.findOne.resolves(null);

      const channel = await utilStub.getOrderChannel(order);
      expect(channel).to.equal('@testchannel');
    });
  });

  describe('deleteOrderFromChannel', () => {
    let telegramStub: any;

    beforeEach(() => {
      telegramStub = {
        deleteMessage: sinon.stub().resolves(),
      };
    });

    it('should delete message from default channel', async () => {
      const order = {
        tg_channel_message1: 123,
      };

      await utilStub.deleteOrderFromChannel(order, telegramStub);

      expect(telegramStub.deleteMessage.calledOnceWith('@testchannel', 123)).to.equal(true);
    });

    it('should delete message from community channel', async () => {
      const order = {
        type: 'sell',
        community_id: 'communityId',
        tg_channel_message1: 456,
      };

      CommunityStub.findOne.resolves({
        order_channels: [{ name: '@communitychannel' }],
      });

      await utilStub.deleteOrderFromChannel(order, telegramStub);

      expect(telegramStub.deleteMessage.calledOnceWith('@communitychannel', 456)).to.equal(true);
    });

    it('should handle telegram errors gracefully', async () => {
      const order = { tg_channel_message1: 123 };
      telegramStub.deleteMessage.rejects(new Error('Message not found'));

      await utilStub.deleteOrderFromChannel(order, telegramStub);

      expect(loggerStub.error.calledOnce).to.equal(true);
    });
  });
});