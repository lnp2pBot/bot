const { expect } = require('chai');
const sinon = require('sinon');
const proxyquire = require('proxyquire');

import {
  isIso4217,
  getCurrency,
  numberFormat,
  decimalRound,
  sanitizeMD,
  secondsToTime,
  getEmojiRate,
  extractId,
  getStars,
  removeAtSymbol,
  removeLightningPrefix,
  plural,
  holdInvoiceExpirationInSecs,
  getUserAge,
  isFloat,
  itemsFromMessage,
  toKebabCase,
  isOrderCreator,
} from '../../util';
import { UserDocument } from '../../models/user';
import { IOrder } from '../../models/order';

describe('Utility Functions', () => {
  let sandbox: any;
  let loggerStub: any;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    
    // Mock logger to suppress console output during tests
    loggerStub = {
      error: sinon.stub(),
      info: sinon.stub(),
      debug: sinon.stub(),
      warn: sinon.stub(),
    };
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('isIso4217', () => {
    it('should return true for valid 3-letter currency codes', () => {
      expect(isIso4217('USD')).to.equal(true);
      expect(isIso4217('EUR')).to.equal(true);
      expect(isIso4217('BTC')).to.equal(true);
    });

    it('should return true for valid 4-5 letter codes', () => {
      expect(isIso4217('USDT')).to.equal(true);
      expect(isIso4217('DOGE')).to.equal(true);
    });

    it('should return false for codes shorter than 3 letters', () => {
      expect(isIso4217('US')).to.equal(false);
      expect(isIso4217('E')).to.equal(false);
    });

    it('should return false for codes longer than 5 letters', () => {
      expect(isIso4217('USDDDD')).to.equal(false);
    });

    it('should return false for codes with non-alphabetic characters', () => {
      expect(isIso4217('US1')).to.equal(false);
      expect(isIso4217('U$D')).to.equal(false);
      expect(isIso4217('USD-')).to.equal(false);
    });

    it('should handle uppercase and lowercase', () => {
      expect(isIso4217('usd')).to.equal(true);
      expect(isIso4217('Usd')).to.equal(true);
      expect(isIso4217('USD')).to.equal(true);
    });
  });

  describe('getCurrency', () => {
    it('should return null for invalid currency codes', () => {
      expect(getCurrency('INVALID')).to.equal(null);
      expect(getCurrency('12')).to.equal(null);
      expect(getCurrency('TOOLONG')).to.equal(null);
    });

    it('should return currency object for valid codes', () => {
      const currency = getCurrency('USD');
      if (currency) {
        expect(currency).to.have.property('code');
        expect(currency).to.have.property('name');
        expect(currency).to.have.property('symbol');
      }
    });
  });

  describe('numberFormat', () => {
    it('should return false for invalid currency codes', () => {
      expect(numberFormat('INVALID', 100)).to.equal(false);
      expect(numberFormat('12', 100)).to.equal(false);
    });

    it('should return the number if no locale is available', () => {
      expect(numberFormat('XYZ', 100)).to.equal(100);
    });

    it('should return the number if input is NaN', () => {
      expect(numberFormat('USD', NaN)).to.be.NaN;
    });

    it('should format numbers correctly for supported currencies', () => {
      const result = numberFormat('USD', 1234.56);
      expect(typeof result).to.be.oneOf(['string', 'number']);
    });
  });

  describe('decimalRound', () => {
    it('should round to nearest integer when exp is 0 or undefined', () => {
      expect(decimalRound(1.5, 0)).to.equal(2);
      expect(decimalRound(1.4, 0)).to.equal(1);
      expect(decimalRound(1.5, 0)).to.equal(2);
    });

    it('should round to specified decimal places', () => {
      expect(decimalRound(1.235, -2)).to.equal(1.24);
      expect(decimalRound(1.234, -2)).to.equal(1.23);
    });

    it('should return NaN for invalid inputs', () => {
      expect(decimalRound(NaN, -2)).to.be.NaN;
      expect(decimalRound(123, 1.5)).to.be.NaN;
    });

    it('should handle positive exponents', () => {
      expect(decimalRound(1234, 2)).to.equal(1200);
      expect(decimalRound(1256, 2)).to.equal(1300);
    });
  });

  describe('sanitizeMD', () => {
    it('should escape markdown special characters', () => {
      expect(sanitizeMD('test|pipe')).to.equal('test\\|pipe');
      expect(sanitizeMD('test<bracket')).to.equal('test\\<bracket');
      expect(sanitizeMD('test>bracket')).to.equal('test\\>bracket');
      expect(sanitizeMD('test(paren')).to.equal('test\\(paren');
      expect(sanitizeMD('test)paren')).to.equal('test\\)paren');
      expect(sanitizeMD('test{brace')).to.equal('test\\{brace');
      expect(sanitizeMD('test}brace')).to.equal('test\\}brace');
      expect(sanitizeMD('test[bracket')).to.equal('test\\[bracket');
      expect(sanitizeMD('test]bracket')).to.equal('test\\]bracket');
    });

    it('should handle null/undefined inputs', () => {
      expect(sanitizeMD(null)).to.equal('');
      expect(sanitizeMD(undefined)).to.equal('');
    });

    it('should convert non-string inputs to strings', () => {
      expect(sanitizeMD(123)).to.equal('123');
      expect(sanitizeMD(true)).to.equal('true');
    });
  });

  describe('secondsToTime', () => {
    it('should convert seconds to hours and minutes', () => {
      const result = secondsToTime(3661); // 1 hour, 1 minute, 1 second
      expect(result.hours).to.equal(1);
      expect(result.minutes).to.equal(1);
    });

    it('should handle exact hours', () => {
      const result = secondsToTime(7200); // 2 hours
      expect(result.hours).to.equal(2);
      expect(result.minutes).to.equal(0);
    });

    it('should handle exact minutes', () => {
      const result = secondsToTime(120); // 2 minutes
      expect(result.hours).to.equal(0);
      expect(result.minutes).to.equal(2);
    });

    it('should handle zero seconds', () => {
      const result = secondsToTime(0);
      expect(result.hours).to.equal(0);
      expect(result.minutes).to.equal(0);
    });
  });

  describe('getEmojiRate', () => {
    it('should return correct number of star emojis', () => {
      expect(getEmojiRate(1)).to.equal('⭐');
      expect(getEmojiRate(3)).to.equal('⭐⭐⭐');
      expect(getEmojiRate(5)).to.equal('⭐⭐⭐⭐⭐');
    });

    it('should round non-integer rates', () => {
      expect(getEmojiRate(2.4)).to.equal('⭐⭐');
      expect(getEmojiRate(2.6)).to.equal('⭐⭐⭐');
    });

    it('should handle zero rating', () => {
      expect(getEmojiRate(0)).to.equal('');
    });
  });

  describe('extractId', () => {
    it('should extract 24-character hex ID from text', () => {
      const testId = '507f1f77bcf86cd799439011';
      const text = `some text :${testId}:`;
      expect(extractId(text)).to.equal(testId);
    });

    it('should return null for invalid format', () => {
      expect(extractId('no id here')).to.equal(null);
      expect(extractId(':invalid::')).to.equal(null);
      expect(extractId(':tooshort:')).to.equal(null);
    });

    it('should return null for non-hex characters', () => {
      const invalidId = '507f1f77bcf86cd79943901g'; // 'g' is not hex
      const text = `:${invalidId}:`;
      expect(extractId(text)).to.equal(null);
    });
  });

  describe('getStars', () => {
    it('should format rating with stars and review count', () => {
      const result = getStars(4.2, 10);
      expect(result).to.include('4.2');
      expect(result).to.include('⭐⭐⭐⭐');
      expect(result).to.include('(10)');
    });

    it('should handle zero reviews', () => {
      const result = getStars(0, 0);
      expect(result).to.include('0');
      expect(result).to.include('(0)');
    });
  });

  describe('removeAtSymbol', () => {
    it('should remove @ symbol from beginning of text', () => {
      expect(removeAtSymbol('@username')).to.equal('username');
    });

    it('should not remove @ symbol from middle of text', () => {
      expect(removeAtSymbol('user@name')).to.equal('user@name');
    });

    it('should return text unchanged if no @ at beginning', () => {
      expect(removeAtSymbol('username')).to.equal('username');
    });
  });

  describe('removeLightningPrefix', () => {
    it('should remove lightning: prefix', () => {
      const invoice = 'lnbc1...';
      expect(removeLightningPrefix(`lightning:${invoice}`)).to.equal(invoice);
    });

    it('should return invoice unchanged if no prefix', () => {
      const invoice = 'lnbc1...';
      expect(removeLightningPrefix(invoice)).to.equal(invoice);
    });
  });

  describe('plural', () => {
    it('should return empty string for singular (1)', () => {
      expect(plural(1)).to.equal('');
    });

    it('should return "s" for plural', () => {
      expect(plural(0)).to.equal('s');
      expect(plural(2)).to.equal('s');
      expect(plural(10)).to.equal('s');
    });
  });

  describe('holdInvoiceExpirationInSecs', () => {
    beforeEach(() => {
      sandbox.stub(process, 'env').value({
        HOLD_INVOICE_CLTV_DELTA: '144',
        HOLD_INVOICE_CLTV_DELTA_SAFETY_WINDOW: '12',
      });
    });

    it('should calculate expiration times correctly', () => {
      const result = holdInvoiceExpirationInSecs();
      expect(result.expirationTimeInSecs).to.equal(144 * 10 * 60);
      expect(result.safetyWindowInSecs).to.equal(12 * 10 * 60);
    });
  });

  describe('getUserAge', () => {
    it('should calculate user age in days', () => {
      const user = {
        created_at: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
      } as UserDocument;
      const age = getUserAge(user);
      expect(age).to.equal(1);
    });

    it('should handle users created today', () => {
      const user = {
        created_at: new Date(),
      } as UserDocument;
      const age = getUserAge(user);
      expect(age).to.equal(0);
    });
  });

  describe('isFloat', () => {
    it('should return true for float numbers', () => {
      expect(isFloat(1.5)).to.equal(true);
      expect(isFloat(0.1)).to.equal(true);
      expect(isFloat(-2.5)).to.equal(true);
    });

    it('should return false for integers', () => {
      expect(isFloat(1)).to.equal(false);
      expect(isFloat(0)).to.equal(false);
      expect(isFloat(-2)).to.equal(false);
    });
  });

  describe('itemsFromMessage', () => {
    it('should split and trim message items', () => {
      const result = itemsFromMessage('  item1   item2   item3  ');
      expect(result).to.deep.equal(['item1', 'item2', 'item3']);
    });

    it('should filter out empty items', () => {
      const result = itemsFromMessage('item1    item2');
      expect(result).to.deep.equal(['item1', 'item2']);
    });

    it('should handle single item', () => {
      const result = itemsFromMessage('single');
      expect(result).to.deep.equal(['single']);
    });

    it('should handle empty string', () => {
      const result = itemsFromMessage('');
      expect(result).to.deep.equal([]);
    });
  });

  describe('toKebabCase', () => {
    it('should convert camelCase to kebab-case', () => {
      expect(toKebabCase('camelCase')).to.equal('camel-case');
      expect(toKebabCase('PascalCase')).to.equal('pascal-case');
    });

    it('should convert spaces to dashes', () => {
      expect(toKebabCase('space separated')).to.equal('space-separated');
    });

    it('should convert underscores to dashes', () => {
      expect(toKebabCase('snake_case')).to.equal('snake-case');
    });

    it('should handle mixed formats', () => {
      expect(toKebabCase('Mixed_Case with Spaces')).to.equal('mixed-case-with-spaces');
    });

    it('should handle already kebab-case strings', () => {
      expect(toKebabCase('already-kebab')).to.equal('already-kebab');
    });
  });

  describe('isOrderCreator', () => {
    let utilWithMockedLogger: any;

    beforeEach(() => {
      // Create a version of util functions with mocked logger to suppress console output
      utilWithMockedLogger = proxyquire('../../util', {
        '../logger': { logger: loggerStub },
      });
    });

    it('should return true when user is order creator', () => {
      const user = { _id: 'user123' } as UserDocument;
      const order = { creator_id: 'user123' } as IOrder;
      expect(utilWithMockedLogger.isOrderCreator(user, order)).to.equal(true);
    });

    it('should return false when user is not order creator', () => {
      const user = { _id: 'user123' } as UserDocument;
      const order = { creator_id: 'user456' } as IOrder;
      expect(utilWithMockedLogger.isOrderCreator(user, order)).to.equal(false);
    });

    it('should handle errors gracefully', () => {
      const user = null as any;
      const order = { creator_id: 'user123' } as IOrder;
      expect(utilWithMockedLogger.isOrderCreator(user, order)).to.equal(false);
      
      // Verify that the error was logged (but suppressed in console)
      expect(loggerStub.error.calledOnce).to.equal(true);
    });
  });
});