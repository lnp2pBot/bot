import { expect } from 'chai';
import { Types } from 'mongoose';
import {
  calculateBotFeeEarned,
  calculateCommunityFeeAllocated,
} from '../../util/financial';
import { IOrder } from '../../models/order';

describe('Financial Utilities', () => {
  describe('calculateBotFeeEarned', () => {
    it('should return 100% of fee for orders without community', () => {
      const order = {
        _id: new Types.ObjectId(),
        amount: 100000, // 100k sats
        fee: 1000, // 1k sats fee
        bot_fee: 0.01, // 1% max fee
        community_fee: 0.7, // 70% to community (but no community)
        community_id: null,
        is_golden_honey_badger: false,
        status: 'SUCCESS',
      } as unknown as IOrder;

      const botFee = calculateBotFeeEarned(order);

      // Without community, bot gets 100%
      expect(botFee).to.equal(1000);
    });

    it('should return ~30% of fee for orders with community', () => {
      const order = {
        _id: new Types.ObjectId(),
        amount: 100000, // 100k sats
        fee: 1000, // 1k sats fee
        bot_fee: 0.01, // 1% max fee
        community_fee: 0.7, // 70% for community, 30% for bot
        community_id: 'some-community-id',
        is_golden_honey_badger: false,
        status: 'SUCCESS',
      } as unknown as IOrder;

      const botFee = calculateBotFeeEarned(order);

      // Bot receives: maxFee * FEE_PERCENT
      // maxFee = 100000 * 0.01 = 1000
      // botFee = 1000 * 0.7 = 700
      expect(botFee).to.equal(700);
    });

    it('should return 0 for Golden Honey Badger orders', () => {
      const order = {
        _id: new Types.ObjectId(),
        amount: 100000,
        fee: 1000,
        bot_fee: 0.01,
        community_fee: 0.7,
        community_id: 'some-community-id',
        is_golden_honey_badger: true,
        status: 'SUCCESS',
      } as unknown as IOrder;

      const botFee = calculateBotFeeEarned(order);

      // Golden Honey Badger: bot gets 0%
      expect(botFee).to.equal(0);
    });

    it('should handle small amounts correctly', () => {
      const order = {
        _id: new Types.ObjectId(),
        amount: 1000, // 1k sats
        fee: 10, // 10 sats fee (1%)
        bot_fee: 0.01,
        community_fee: 0.7,
        community_id: 'some-community-id',
        is_golden_honey_badger: false,
        status: 'SUCCESS',
      } as unknown as IOrder;

      const botFee = calculateBotFeeEarned(order);

      // maxFee = 1000 * 0.01 = 10
      // botFee = 10 * 0.7 = 7
      expect(botFee).to.equal(7);
    });

    it('should round bot fee to nearest integer', () => {
      const order = {
        _id: new Types.ObjectId(),
        amount: 100000,
        fee: 1000,
        bot_fee: 0.01,
        community_fee: 0.65, // Will result in decimal
        community_id: 'some-community-id',
        is_golden_honey_badger: false,
        status: 'SUCCESS',
      } as unknown as IOrder;

      const botFee = calculateBotFeeEarned(order);

      // maxFee = 100000 * 0.01 = 1000
      // botFee = 1000 * 0.65 = 650 (should be rounded)
      expect(botFee).to.be.a('number');
      expect(Number.isInteger(botFee)).to.equal(true);
      expect(botFee).to.equal(650);
    });
  });

  describe('calculateCommunityFeeAllocated', () => {
    it('should return 0 for orders without community', () => {
      const order = {
        _id: new Types.ObjectId(),
        amount: 100000,
        fee: 1000,
        bot_fee: 0.01,
        community_fee: 0.7,
        community_id: null,
        is_golden_honey_badger: false,
        status: 'SUCCESS',
      } as unknown as IOrder;

      const communityFee = calculateCommunityFeeAllocated(order);
      expect(communityFee).to.equal(0);
    });

    it('should return ~70% of fee for orders with community', () => {
      const order = {
        _id: new Types.ObjectId(),
        amount: 100000,
        fee: 1000,
        bot_fee: 0.01,
        community_fee: 0.7,
        community_id: 'some-community-id',
        is_golden_honey_badger: false,
        status: 'SUCCESS',
      } as unknown as IOrder;

      const communityFee = calculateCommunityFeeAllocated(order);

      // Total fee - bot fee
      // 1000 - 700 = 300
      expect(communityFee).to.equal(300);
    });

    it('should return 100% of fee for Golden Honey Badger orders', () => {
      const order = {
        _id: new Types.ObjectId(),
        amount: 100000,
        fee: 1000,
        bot_fee: 0.01,
        community_fee: 0.7,
        community_id: 'some-community-id',
        is_golden_honey_badger: true,
        status: 'SUCCESS',
      } as unknown as IOrder;

      const communityFee = calculateCommunityFeeAllocated(order);

      // Bot gets 0, community gets 100%
      expect(communityFee).to.equal(1000);
    });

    it('should ensure bot fee + community fee equals total fee', () => {
      const order = {
        _id: new Types.ObjectId(),
        amount: 100000,
        fee: 1000,
        bot_fee: 0.01,
        community_fee: 0.7,
        community_id: 'some-community-id',
        is_golden_honey_badger: false,
        status: 'SUCCESS',
      } as unknown as IOrder;

      const botFee = calculateBotFeeEarned(order);
      const communityFee = calculateCommunityFeeAllocated(order);

      // Should add up to total fee
      expect(botFee + communityFee).to.equal(order.fee);
    });
  });

  describe('Fee Distribution Logic', () => {
    it('should correctly split fees with standard 70/30 distribution', () => {
      const testCases = [
        { amount: 10000, fee: 100 },
        { amount: 50000, fee: 500 },
        { amount: 100000, fee: 1000 },
        { amount: 1000000, fee: 10000 },
      ];

      testCases.forEach(({ amount, fee }) => {
        const order = {
          _id: new Types.ObjectId(),
          amount,
          fee,
          bot_fee: 0.01,
          community_fee: 0.7, // 70% community, 30% bot
          community_id: 'test-community',
          is_golden_honey_badger: false,
          status: 'SUCCESS',
        } as unknown as IOrder;

        const botFee = calculateBotFeeEarned(order);
        const communityFee = calculateCommunityFeeAllocated(order);

        // Verify total equals original fee
        expect(botFee + communityFee).to.equal(fee);

        // Verify approximate percentages (allowing for rounding)
        const botPercentage = (botFee / fee) * 100;
        const communityPercentage = (communityFee / fee) * 100;

        expect(botPercentage).to.be.closeTo(70, 1); // ~70% (from maxFee * 0.7)
        expect(communityPercentage).to.be.closeTo(30, 1); // ~30%
      });
    });

    it('should handle different FEE_PERCENT values', () => {
      const order = {
        _id: new Types.ObjectId(),
        amount: 100000,
        fee: 1000,
        bot_fee: 0.01,
        community_fee: 0.5, // 50/50 split
        community_id: 'test-community',
        is_golden_honey_badger: false,
        status: 'SUCCESS',
      } as unknown as IOrder;

      const botFee = calculateBotFeeEarned(order);
      const communityFee = calculateCommunityFeeAllocated(order);

      // maxFee = 100000 * 0.01 = 1000
      // botFee = 1000 * 0.5 = 500
      // communityFee = 1000 - 500 = 500
      expect(botFee).to.equal(500);
      expect(communityFee).to.equal(500);
    });
  });
});
