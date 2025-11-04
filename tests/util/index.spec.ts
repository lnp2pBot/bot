/* eslint-disable no-unused-expressions */
import {
  getCurrency,
  numberFormat,
  decimalRound,
  plural,
  isFloat,
  toKebabCase,
} from '../../util/index';

const { expect } = require('chai');

describe('Utility Functions', () => {
  describe('getCurrency', () => {
    it('should return currency object for valid ISO code', () => {
      const result = getCurrency('USD');
      expect(result).to.not.be.null;
      if (result) {
        expect(result).to.have.property('symbol');
        expect(result).to.have.property('locale');
      }
    });

    it('should return null for invalid currency code', () => {
      const result = getCurrency('INVALID');
      expect(result).to.be.null;
    });

    it('should return null for empty string', () => {
      const result = getCurrency('');
      expect(result).to.be.null;
    });

    it('should handle common currency codes', () => {
      const usd = getCurrency('USD');
      const eur = getCurrency('EUR');

      expect(usd).to.not.be.null;
      expect(eur).to.not.be.null;
    });
  });

  describe('numberFormat', () => {
    it('should return false for invalid currency code', () => {
      const result = numberFormat('INVALID', 100);
      expect(result).to.equal(false);
    });

    it('should return original number if no locale found', () => {
      const result = numberFormat('USD', 1234.56);
      expect(result).to.not.be.false;
    });

    it('should return original number for NaN input', () => {
      const result = numberFormat('USD', NaN);
      expect(result).to.be.NaN;
    });

    it('should handle zero correctly', () => {
      const result = numberFormat('USD', 0);
      expect(result).to.not.be.false;
    });

    it('should handle negative numbers', () => {
      const result = numberFormat('USD', -100);
      expect(result).to.not.be.false;
    });
  });

  describe('decimalRound', () => {
    it('should round to integer when exp is 0', () => {
      expect(decimalRound(3.7, 0)).to.equal(4);
      expect(decimalRound(3.2, 0)).to.equal(3);
    });

    it('should round to specified decimal places', () => {
      expect(decimalRound(3.14159, -2)).to.equal(3.14);
      expect(decimalRound(3.16159, -2)).to.equal(3.16);
      expect(decimalRound(10.995, -2)).to.equal(11);
    });

    it('should handle single decimal place', () => {
      expect(decimalRound(3.16, -1)).to.equal(3.2);
      expect(decimalRound(3.14, -1)).to.equal(3.1);
    });

    it('should return NaN for invalid inputs', () => {
      expect(decimalRound('invalid' as any, -2)).to.be.NaN;
      expect(decimalRound(3.14, 2.5)).to.be.NaN;
    });

    it('should handle zero correctly', () => {
      expect(decimalRound(0, -2)).to.equal(0);
      expect(decimalRound(0.001, -2)).to.equal(0);
    });

    it('should handle negative numbers', () => {
      expect(decimalRound(-3.14159, -2)).to.equal(-3.14);
      expect(decimalRound(-3.16159, -2)).to.equal(-3.16);
    });
  });

  describe('plural', () => {
    it('should return empty string for 1', () => {
      const result = plural(1);
      expect(result).to.equal('');
    });

    it('should return "s" for numbers other than 1', () => {
      expect(plural(0)).to.equal('s');
      expect(plural(2)).to.equal('s');
      expect(plural(5)).to.equal('s');
    });
  });

  describe('isFloat', () => {
    it('should return true for float numbers', () => {
      expect(isFloat(3.14)).to.be.true;
      expect(isFloat(0.5)).to.be.true;
    });

    it('should return false for integers', () => {
      expect(isFloat(5)).to.be.false;
      expect(isFloat(0)).to.be.false;
    });
  });

  describe('toKebabCase', () => {
    it('should convert camelCase to kebab-case', () => {
      const result = toKebabCase('camelCaseString');
      expect(result).to.equal('camel-case-string');
    });

    it('should convert spaces and underscores to dashes', () => {
      expect(toKebabCase('hello world')).to.equal('hello-world');
      expect(toKebabCase('hello_world')).to.equal('hello-world');
    });
  });
});
