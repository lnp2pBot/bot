export {};

const { expect } = require('chai');
const sinon = require('sinon');
const proxyquire = require('proxyquire');

// In-memory fake of the User model. findById returns a mongoose-like doc whose
// save() writes its current fields back to the shared store. We add a small
// async gap inside findById so that, WITHOUT the per-user lock, two parallel
// takes would both read the same count and clobber each other (the classic race
// this feature must prevent). We keep the REAL PerUserIdMutex (util is not
// stubbed), so the lock is what we are actually exercising.
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

function makeFakeUser(store: Map<string, any>) {
  return {
    findById: async (id: any) => {
      await delay(5); // async gap: read is not instantaneous
      const key = String(id);
      const state = store.get(key);
      if (!state) return null;
      // Return a fresh "document" backed by the shared store.
      const doc: any = {
        _id: key,
        take_order_count: state.take_order_count,
        take_order_cooldown_until: state.take_order_cooldown_until,
        async save() {
          await delay(5); // async gap: write is not instantaneous
          store.set(key, {
            take_order_count: this.take_order_count,
            take_order_cooldown_until: this.take_order_cooldown_until,
          });
        },
      };
      return doc;
    },
  };
}

const messagesMock = {
  orderTakeRateLimitMessage: sinon.stub().resolves(),
  '@noCallThru': true,
};

let store: Map<string, any>;

const { reserveTakeSlot, releaseTakeSlot } = proxyquire(
  '../../../../bot/modules/orders/takeOrder',
  {
    // NOTE: '../../../util' is intentionally NOT stubbed, so the real
    // PerUserIdMutex is used.
    '../../../models': { User: makeFakeUser((store = new Map())) },
    '../../messages': messagesMock,
  },
);

describe('take slot rate limit — concurrency', () => {
  const USER_ID = '61006f0e85ad4f96cde94141';
  const ctx: any = {};

  beforeEach(() => {
    store.clear();
    store.set(USER_ID, {
      take_order_count: 0,
      take_order_cooldown_until: null,
    });
    messagesMock.orderTakeRateLimitMessage.resetHistory();
    process.env.MAX_ORDERS_TAKE = '10';
    process.env.ORDER_TAKE_COOLDOWN_HOURS = '24';
  });

  const freshUser = () => ({
    _id: USER_ID,
    take_order_count: 0,
    take_order_cooldown_until: null,
  });

  it('does not exceed the cap when 10 takes fire at once', async () => {
    const results = await Promise.all(
      Array.from({ length: 10 }, () => reserveTakeSlot(ctx, freshUser())),
    );

    // None of the 10 are blocked; all fit inside the window.
    expect(results.every(blocked => blocked === false)).to.equal(true);
    // Counter lands EXACTLY on the cap — no lost updates.
    expect(store.get(USER_ID).take_order_count).to.equal(10);
    // Reaching the cap opens the cooldown.
    expect(store.get(USER_ID).take_order_cooldown_until).to.be.instanceOf(Date);
  });

  it('blocks the extra takes when 15 fire at once', async () => {
    const results = await Promise.all(
      Array.from({ length: 15 }, () => reserveTakeSlot(ctx, freshUser())),
    );

    const allowed = results.filter(blocked => blocked === false).length;
    const blocked = results.filter(b => b === true).length;

    // Exactly the cap is allowed, the rest are blocked — never more than 10.
    expect(allowed).to.equal(10);
    expect(blocked).to.equal(5);
    expect(store.get(USER_ID).take_order_count).to.equal(10);
  });

  it('release returns a slot and clears a just-opened cooldown', async () => {
    // Fill the window to the cap.
    await Promise.all(
      Array.from({ length: 10 }, () => reserveTakeSlot(ctx, freshUser())),
    );
    expect(store.get(USER_ID).take_order_cooldown_until).to.be.instanceOf(Date);

    // A failed take releases its slot.
    await releaseTakeSlot(freshUser());

    expect(store.get(USER_ID).take_order_count).to.equal(9);
    // Back below the cap -> cooldown cleared.
    expect(store.get(USER_ID).take_order_cooldown_until).to.equal(null);
  });

  it('blocks a take while a cooldown is active', async () => {
    store.set(USER_ID, {
      take_order_count: 10,
      take_order_cooldown_until: new Date(Date.now() + 60 * 60 * 1000),
    });

    const blocked = await reserveTakeSlot(ctx, freshUser());

    expect(blocked).to.equal(true);
    expect(messagesMock.orderTakeRateLimitMessage.calledOnce).to.equal(true);
    // Counter untouched while blocked.
    expect(store.get(USER_ID).take_order_count).to.equal(10);
  });

  it('starts a fresh window once the cooldown has expired', async () => {
    store.set(USER_ID, {
      take_order_count: 10,
      take_order_cooldown_until: new Date(Date.now() - 60 * 1000), // expired
    });

    const blocked = await reserveTakeSlot(ctx, freshUser());

    expect(blocked).to.equal(false);
    // Window reset then this take counted -> 1.
    expect(store.get(USER_ID).take_order_count).to.equal(1);
    expect(store.get(USER_ID).take_order_cooldown_until).to.equal(null);
  });
});
