import { getOrderTitleMessage } from '../../bot/ordersActions';

// chai v4 ships no types and @grammyjs/i18n's typed Config rejects the
// locale/directory options, so both are required CommonJS-style, matching
// every other spec and the production I18n usage in bot/ordersActions.ts.
const { expect } = require('chai');
const { I18n } = require('@grammyjs/i18n');

// Real i18n context so the test exercises the actual locale strings and
// their ${amount} interpolation (the part that regressed in PR #770).
const i18nCtx = new I18n({
  locale: 'en',
  defaultLanguageOnMissing: true,
  directory: 'locales',
}).createContext('en', {});

describe('getOrderTitleMessage', () => {
  const anonymousUser: any = { username: 'alice', show_username: false };
  const publicUser: any = { username: 'alice', show_username: true };

  describe('fixed orders (amount set, price not from API)', () => {
    it('shows the sats amount when selling', () => {
      const title = getOrderTitleMessage(i18nCtx, {
        user: anonymousUser,
        type: 'sell',
        amount: 100,
        fiatCode: 'USD',
        priceFromAPI: false,
      });

      expect(title).to.equal('Selling 100 sats');
    });

    it('shows the sats amount when buying', () => {
      const title = getOrderTitleMessage(i18nCtx, {
        user: anonymousUser,
        type: 'buy',
        amount: 100,
        fiatCode: 'USD',
        priceFromAPI: false,
      });

      expect(title).to.equal('Buying 100 sats');
    });

    it('shows the username and the sats amount when the user shows their name', () => {
      const title = getOrderTitleMessage(i18nCtx, {
        user: publicUser,
        type: 'sell',
        amount: 100,
        fiatCode: 'USD',
        priceFromAPI: false,
      });

      expect(title).to.equal('@alice is selling 100 sats');
    });
  });

  describe('market/range orders (amount is 0, price from API)', () => {
    it('omits the amount when selling', () => {
      const title = getOrderTitleMessage(i18nCtx, {
        user: anonymousUser,
        type: 'sell',
        amount: 0,
        fiatCode: 'USD',
        priceFromAPI: true,
      });

      expect(title).to.equal('Selling sats');
    });

    it('omits the amount when buying', () => {
      const title = getOrderTitleMessage(i18nCtx, {
        user: anonymousUser,
        type: 'buy',
        amount: 0,
        fiatCode: 'USD',
        priceFromAPI: true,
      });

      expect(title).to.equal('Buying sats');
    });

    it('shows the username but omits the amount when the user shows their name', () => {
      const title = getOrderTitleMessage(i18nCtx, {
        user: publicUser,
        type: 'buy',
        amount: 0,
        fiatCode: 'USD',
        priceFromAPI: true,
      });

      expect(title).to.equal('@alice is buying sats');
    });
  });
});
