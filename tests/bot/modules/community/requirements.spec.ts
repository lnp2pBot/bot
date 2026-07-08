import {
  parseOptionalNumber,
  meetsCommunityCreationRequirements,
  getCommunityThresholds,
} from '../../../../bot/modules/community/requirements';
const { expect } = require('chai');

describe('Community Requirements', () => {
  describe('parseOptionalNumber', () => {
    it('should return { value: null, isValid: true } for undefined', () => {
      const res = parseOptionalNumber(undefined);
      expect(res).to.deep.equal({ value: null, isValid: true });
    });
    it('should return { value: null, isValid: true } for empty string', () => {
      const res = parseOptionalNumber('  ');
      expect(res).to.deep.equal({ value: null, isValid: true });
    });
    it('should return valid number for valid string', () => {
      const res = parseOptionalNumber('100');
      expect(res).to.deep.equal({ value: 100, isValid: true });
    });
    it('should return invalid for negative number', () => {
      const res = parseOptionalNumber('-5');
      expect(res).to.deep.equal({ value: null, isValid: false });
    });
    it('should return invalid for non-numeric string', () => {
      const res = parseOptionalNumber('abc');
      expect(res).to.deep.equal({ value: null, isValid: false });
    });
  });

  describe('getCommunityThresholds', () => {
    const originalEnv = process.env;

    beforeEach(() => {
      process.env = { ...originalEnv };
    });

    afterEach(() => {
      process.env = originalEnv;
    });

    it('should parse valid thresholds correctly', () => {
      process.env.COMMUNITY_CREATION_MIN_ORDERS = '10';
      process.env.COMMUNITY_CREATION_MIN_VOLUME_SATS = '1000';
      const result = getCommunityThresholds();
      expect(result.minOrders).to.equal(10);
      expect(result.minVolume).to.equal(1000);
      expect(result.invalidEnvVars).to.have.lengthOf(0);
    });

    it('should return invalidEnvVars for invalid thresholds', () => {
      process.env.COMMUNITY_CREATION_MIN_ORDERS = 'invalid';
      const result = getCommunityThresholds();
      expect(result.invalidEnvVars).to.contain('COMMUNITY_CREATION_MIN_ORDERS');
    });
  });

  describe('meetsCommunityCreationRequirements', () => {
    const user = {
      tg_id: '1',
      trades_completed: 10,
      volume_traded: 1000,
      total_rating: 4.5,
      created_at: new Date(Date.now() - 100 * 86400000).toISOString(), // 100 days ago
    };

    it('should meet requirements when all thresholds are null', () => {
      const thresholds = {
        minOrders: null,
        minVolume: null,
        minDays: null,
        minReputation: null,
      };
      const result = meetsCommunityCreationRequirements(user, thresholds);
      expect(result.meets).to.equal(true);
    });

    it('should fail if orders threshold not met', () => {
      const thresholds = {
        minOrders: 20,
        minVolume: null,
        minDays: null,
        minReputation: null,
      };
      const result = meetsCommunityCreationRequirements(user, thresholds);
      expect(result.meets).to.equal(false);
    });

    it('should meet if all thresholds met', () => {
      const thresholds = {
        minOrders: 5,
        minVolume: 500,
        minDays: 50,
        minReputation: 4,
      };
      const result = meetsCommunityCreationRequirements(user, thresholds);
      expect(result.meets).to.equal(true);
    });

    it('should return hasInvalidDate true for invalid date', () => {
      const invalidUser = { ...user, created_at: 'invalid-date' };
      const thresholds = {
        minOrders: null,
        minVolume: null,
        minDays: null,
        minReputation: null,
      };
      const result = meetsCommunityCreationRequirements(
        invalidUser,
        thresholds,
      );
      expect(result.hasInvalidDate).to.equal(true);
    });
  });
});
