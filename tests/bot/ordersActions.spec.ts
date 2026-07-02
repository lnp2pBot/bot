const { expect } = require('chai');
const { I18n } = require('@grammyjs/i18n');
const { getOrderTitleMessage } = require('../../bot/ordersActions');

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
      const title = getOrderTitleMessage(
        anonymousUser,
        'sell',
        100,
        'USD',
        false,
        i18nCtx,
      );

      expect(title).to.equal('Selling 100 sats');
    });

    it('shows the sats amount when buying', () => {
      const title = getOrderTitleMessage(
        anonymousUser,
        'buy',
        100,
        'USD',
        false,
        i18nCtx,
      );

      expect(title).to.equal('Buying 100 sats');
    });

    it('shows the username and the sats amount when the user shows their name', () => {
      const title = getOrderTitleMessage(
        publicUser,
        'sell',
        100,
        'USD',
        false,
        i18nCtx,
      );

      expect(title).to.equal('@alice is selling 100 sats');
    });
  });

  describe('market/range orders (amount is 0, price from API)', () => {
    it('omits the amount when selling', () => {
      const title = getOrderTitleMessage(
        anonymousUser,
        'sell',
        0,
        'USD',
        true,
        i18nCtx,
      );

      expect(title).to.equal('Selling sats');
    });

    it('omits the amount when buying', () => {
      const title = getOrderTitleMessage(
        anonymousUser,
        'buy',
        0,
        'USD',
        true,
        i18nCtx,
      );

      expect(title).to.equal('Buying sats');
    });

    it('shows the username but omits the amount when the user shows their name', () => {
      const title = getOrderTitleMessage(
        publicUser,
        'buy',
        0,
        'USD',
        true,
        i18nCtx,
      );

      expect(title).to.equal('@alice is buying sats');
    });
  });
});
