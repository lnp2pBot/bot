export {};

const { expect } = require('chai');
const sinon = require('sinon');
const proxyquire = require('proxyquire').noCallThru();

/**
 * These tests lock in the fix for the bug where cancellation messages were
 * delivered in the language of the user who ran /cancel (or of the admin),
 * instead of in each recipient's own language.
 *
 * Root cause: getUserI18nContext read a non-existent `user.language` field
 * (the User model uses `lang`), so it always fell back to the default locale.
 *
 * The cancel flow (/cancel, /cancelall and the inline cancel buttons) funnels
 * through cancelAddInvoice, cancelShowHoldInvoice and cancelOrder. We exercise
 * every buyer/seller x taker/creator combination and assert, generically, that
 * whenever a message is sent to a specific recipient with an explicit i18n
 * context, that context's language matches the recipient's language.
 */

// Distinct languages so any mismatch is caught immediately.
const BUYER = { _id: 'BUYER', tg_id: '100', lang: 'fa' };
const SELLER = { _id: 'SELLER', tg_id: '200', lang: 'es' };

// Records every messages.* call so we can audit recipient vs. i18n language.
const messageCalls: Array<{ name: string; args: any[] }> = [];
const messagesMock: any = new Proxy(
  {},
  {
    get: (_target, prop: string) => {
      return (...args: any[]) => {
        messageCalls.push({ name: prop, args });
        return Promise.resolve();
      };
    },
  },
);

// getUserI18nContext returns a context tagged with the user's language.
const taggedI18n = (lang: string) => ({ __lang: lang, t: (k: string) => k });

const utilMock = {
  getUserI18nContext: (user: any) => Promise.resolve(taggedI18n(user.lang)),
  deleteOrderFromChannel: sinon.stub().resolves(),
  getBtcFiatPrice: sinon.stub().resolves(1000),
  getFee: sinon.stub().resolves(0),
  removeLightningPrefix: (x: string) => x,
  PerOrderIdMutex: {
    instance: { runExclusive: (_id: string, fn: () => any) => fn() },
  },
};

const lnMock = {
  createHoldInvoice: sinon
    .stub()
    .resolves({ request: 'r', hash: 'h', secret: 's' }),
  subscribeInvoice: sinon.stub().resolves(),
  cancelHoldInvoice: sinon.stub().resolves(),
  settleHoldInvoice: sinon.stub().resolves(),
  getInvoice: sinon.stub().resolves({ request: 'r' }),
};

const UserMock = {
  findOne: (query: any) => {
    const id = query && query._id;
    if (id === 'BUYER') return Promise.resolve({ ...BUYER });
    if (id === 'SELLER') return Promise.resolve({ ...SELLER });
    return Promise.resolve(null);
  },
  findById: (id: any) => {
    if (id === 'BUYER') return Promise.resolve({ ...BUYER });
    if (id === 'SELLER') return Promise.resolve({ ...SELLER });
    return Promise.resolve(null);
  },
};

let currentOrder: any;
let cooperativeUpdateResult: any;
const OrderMock = {
  findOne: () => Promise.resolve(currentOrder),
  findOneAndUpdate: () => Promise.resolve(cooperativeUpdateResult),
};

const ordersActionsMock = {
  getOrder: () => Promise.resolve(currentOrder),
  getOrders: () => Promise.resolve([]),
};

const commands = proxyquire('../../bot/commands', {
  '../models': { Order: OrderMock, User: UserMock, Dispute: {} },
  '../ln': lnMock,
  '../util': utilMock,
  './messages': messagesMock,
  './ordersActions': ordersActionsMock,
  './modules/events/orders': { orderUpdated: sinon.stub() },
});

// Builds a minimal ctx whose implicit i18n (ctx.i18n) belongs to `caller`.
const makeCtx = (callerTgId: string, callerLang: string) => ({
  from: { id: Number(callerTgId) },
  i18n: taggedI18n(callerLang),
  deleteMessage: sinon.stub(),
  scene: { leave: sinon.stub() },
  telegram: { sendMessage: sinon.stub().resolves() },
  reply: sinon.stub().resolves(),
  botInfo: { username: 'bot' },
  update: {},
});

const baseOrder = (over: any) => ({
  _id: 'ORDER1',
  hash: null,
  buyer_id: 'BUYER',
  seller_id: 'SELLER',
  min_amount: null,
  max_amount: null,
  amount: 1000,
  fee: 1,
  fiat_amount: 100,
  fiat_code: 'usd',
  price_from_api: false,
  buyer_cooperativecancel: false,
  seller_cooperativecancel: false,
  save: sinon.stub().resolves(),
  ...over,
});

// The generic guard: for every recorded message call, if it targets a concrete
// recipient (a user object) AND carries an explicit i18n context, they must
// speak the same language.
const assertRecipientLanguages = () => {
  for (const call of messageCalls) {
    const recipient = call.args.find(
      a => a && typeof a === 'object' && 'tg_id' in a && 'lang' in a,
    );
    const i18n = call.args.find(
      a => a && typeof a === 'object' && '__lang' in a,
    );
    if (recipient && i18n) {
      expect(
        i18n.__lang,
        `${call.name}: message sent to ${recipient.tg_id} used locale ` +
          `"${i18n.__lang}" but recipient language is "${recipient.lang}"`,
      ).to.equal(recipient.lang);
    }
  }
};

describe('Cancel flow: messages must use each recipient language', () => {
  beforeEach(() => {
    messageCalls.length = 0;
    currentOrder = null;
    cooperativeUpdateResult = null;
  });

  describe('cancelAddInvoice (sell order taken, WAITING_BUYER_INVOICE)', () => {
    it('seller is the creator and cancels', async () => {
      currentOrder = baseOrder({
        type: 'sell',
        status: 'WAITING_BUYER_INVOICE',
        creator_id: 'SELLER',
      });
      const ctx = makeCtx(SELLER.tg_id, SELLER.lang);
      await commands.cancelAddInvoice(ctx, currentOrder);
      assertRecipientLanguages();
      expect(messageCalls.map(c => c.name)).to.include.members([
        'successCancelOrderMessage',
        'counterPartyCancelOrderMessage',
      ]);
    });

    it('buyer is the creator and cancels', async () => {
      currentOrder = baseOrder({
        type: 'buy',
        status: 'WAITING_BUYER_INVOICE',
        creator_id: 'BUYER',
      });
      const ctx = makeCtx(BUYER.tg_id, BUYER.lang);
      await commands.cancelAddInvoice(ctx, currentOrder);
      assertRecipientLanguages();
      expect(messageCalls.map(c => c.name)).to.include.members([
        'toBuyerDidntAddInvoiceMessage',
        'toSellerBuyerDidntAddInvoiceMessage',
      ]);
    });

    it('buyer is the taker and cancels (order republished)', async () => {
      currentOrder = baseOrder({
        type: 'sell',
        status: 'WAITING_BUYER_INVOICE',
        creator_id: 'SELLER',
      });
      const ctx = makeCtx(BUYER.tg_id, BUYER.lang);
      await commands.cancelAddInvoice(ctx, currentOrder);
      assertRecipientLanguages();
      expect(messageCalls.map(c => c.name)).to.include(
        'publishSellOrderMessage',
      );
    });
  });

  describe('cancelShowHoldInvoice (WAITING_PAYMENT)', () => {
    it('seller is the creator and cancels', async () => {
      currentOrder = baseOrder({
        type: 'sell',
        status: 'WAITING_PAYMENT',
        creator_id: 'SELLER',
      });
      const ctx = makeCtx(SELLER.tg_id, SELLER.lang);
      await commands.cancelShowHoldInvoice(ctx, currentOrder);
      assertRecipientLanguages();
      expect(messageCalls.map(c => c.name)).to.include.members([
        'toSellerDidntPayInvoiceMessage',
        'toBuyerSellerDidntPayInvoiceMessage',
      ]);
    });

    it('buyer is the creator and cancels', async () => {
      currentOrder = baseOrder({
        type: 'buy',
        status: 'WAITING_PAYMENT',
        creator_id: 'BUYER',
      });
      const ctx = makeCtx(BUYER.tg_id, BUYER.lang);
      await commands.cancelShowHoldInvoice(ctx, currentOrder);
      assertRecipientLanguages();
      expect(messageCalls.map(c => c.name)).to.include.members([
        'successCancelOrderMessage',
        'counterPartyCancelOrderMessage',
      ]);
    });

    it('seller is the taker and cancels (order republished)', async () => {
      currentOrder = baseOrder({
        type: 'buy',
        status: 'WAITING_PAYMENT',
        creator_id: 'BUYER',
      });
      const ctx = makeCtx(SELLER.tg_id, SELLER.lang);
      await commands.cancelShowHoldInvoice(ctx, currentOrder);
      assertRecipientLanguages();
      expect(messageCalls.map(c => c.name)).to.include(
        'publishBuyOrderMessage',
      );
    });
  });

  describe('cancelOrder cooperative cancellation (ACTIVE)', () => {
    it('buyer initiates and both parties agree', async () => {
      currentOrder = baseOrder({ type: 'sell', status: 'ACTIVE' });
      cooperativeUpdateResult = baseOrder({
        type: 'sell',
        status: 'ACTIVE',
        buyer_cooperativecancel: true,
        seller_cooperativecancel: true,
      });
      const ctx: any = makeCtx(BUYER.tg_id, BUYER.lang);
      await commands.cancelOrder(ctx, 'ORDER1', { ...BUYER });
      assertRecipientLanguages();
      expect(messageCalls.map(c => c.name)).to.include.members([
        'okCooperativeCancelMessage',
        'refundCooperativeCancelMessage',
      ]);
    });

    it('seller initiates and both parties agree', async () => {
      currentOrder = baseOrder({ type: 'sell', status: 'ACTIVE' });
      cooperativeUpdateResult = baseOrder({
        type: 'sell',
        status: 'ACTIVE',
        buyer_cooperativecancel: true,
        seller_cooperativecancel: true,
      });
      const ctx: any = makeCtx(SELLER.tg_id, SELLER.lang);
      await commands.cancelOrder(ctx, 'ORDER1', { ...SELLER });
      assertRecipientLanguages();
      expect(messageCalls.map(c => c.name)).to.include.members([
        'okCooperativeCancelMessage',
        'refundCooperativeCancelMessage',
      ]);
    });

    it('buyer initiates and waits for the counterparty', async () => {
      currentOrder = baseOrder({ type: 'sell', status: 'ACTIVE' });
      cooperativeUpdateResult = baseOrder({
        type: 'sell',
        status: 'ACTIVE',
        buyer_cooperativecancel: true,
        seller_cooperativecancel: false,
      });
      const ctx: any = makeCtx(BUYER.tg_id, BUYER.lang);
      await commands.cancelOrder(ctx, 'ORDER1', { ...BUYER });
      assertRecipientLanguages();
      expect(messageCalls.map(c => c.name)).to.include(
        'counterPartyWantsCooperativeCancelMessage',
      );
    });
  });
});
