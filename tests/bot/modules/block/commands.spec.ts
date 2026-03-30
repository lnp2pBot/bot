export {};
const { expect } = require('chai');
const sinon = require('sinon');
const proxyquire = require('proxyquire');

describe('Block module – commands', () => {
  let sandbox: any;
  let ctx: any;
  let commands: any;

  // Model stubs
  let userFindOneStub: any;
  let blockExistsStub: any;
  let blockSaveStub: any;
  let blockDeleteOneStub: any;
  let orderExistsStub: any;
  let blockFindStub: any;
  let userFindStub: any;

  // Message stubs
  let notFoundUserMessageStub: any;
  let userBlockedStub: any;
  let userAlreadyBlockedStub: any;
  let ordersInProcessStub: any;
  let userUnblockedStub: any;
  let blocklistMessageStub: any;
  let blocklistEmptyMessageStub: any;

  const makeUser = (overrides = {}) => ({
    id: 'user-db-id',
    tg_id: '111',
    username: 'alice',
    ...overrides,
  });

  beforeEach(() => {
    sandbox = sinon.createSandbox();

    ctx = {
      i18n: { t: (k: string) => k },
      reply: sandbox.stub(),
      user: makeUser({ tg_id: '111', username: 'alice' }),
    };

    userFindOneStub = sandbox.stub();
    blockExistsStub = sandbox.stub();
    blockSaveStub = sandbox.stub().resolves();
    blockDeleteOneStub = sandbox.stub();
    orderExistsStub = sandbox.stub();
    blockFindStub = sandbox.stub();
    userFindStub = sandbox.stub();

    notFoundUserMessageStub = sandbox.stub().resolves();
    userBlockedStub = sandbox.stub().resolves();
    userAlreadyBlockedStub = sandbox.stub().resolves();
    ordersInProcessStub = sandbox.stub().resolves();
    userUnblockedStub = sandbox.stub().resolves();
    blocklistMessageStub = sandbox.stub().resolves();
    blocklistEmptyMessageStub = sandbox.stub().resolves();

    const BlockConstructorStub = function (this: any, data: any) {
      Object.assign(this, data);
      this.save = blockSaveStub;
    };
    BlockConstructorStub.exists = blockExistsStub;
    BlockConstructorStub.deleteOne = blockDeleteOneStub;
    BlockConstructorStub.find = blockFindStub;

    commands = proxyquire('../../../../bot/modules/block/commands', {
      '../../../models': {
        User: { findOne: userFindOneStub, find: userFindStub },
        Block: BlockConstructorStub,
        Order: { exists: orderExistsStub },
      },
      './messages': {
        userBlocked: userBlockedStub,
        userAlreadyBlocked: userAlreadyBlockedStub,
        ordersInProcess: ordersInProcessStub,
        userUnblocked: userUnblockedStub,
        blocklistMessage: blocklistMessageStub,
        blocklistEmptyMessage: blocklistEmptyMessageStub,
      },
      '../../messages': {
        notFoundUserMessage: notFoundUserMessageStub,
      },
    });
  });

  afterEach(() => sandbox.restore());

  // ─── resolveUser (tested indirectly through block) ───────────────────────

  describe('block', () => {
    it('resolves user by @username', async () => {
      const target = makeUser({ tg_id: '222', username: 'spammer' });
      userFindOneStub.resolves(target);
      orderExistsStub.resolves(false);
      blockExistsStub.resolves(false);

      await commands.block(ctx, '@spammer');

      expect(userFindOneStub.calledWith({ username: 'spammer' })).to.equal(
        true,
      );
      expect(blockSaveStub.called).to.equal(true);
      expect(userBlockedStub.called).to.equal(true);
    });

    it('resolves user by numeric Telegram ID', async () => {
      const target = makeUser({ tg_id: '222', username: 'spammer' });
      userFindOneStub.resolves(target);
      orderExistsStub.resolves(false);
      blockExistsStub.resolves(false);

      await commands.block(ctx, '222');

      expect(userFindOneStub.calledWith({ tg_id: '222' })).to.equal(true);
      expect(blockSaveStub.called).to.equal(true);
      expect(userBlockedStub.called).to.equal(true);
    });

    it('replies not found when user does not exist', async () => {
      userFindOneStub.resolves(null);

      await commands.block(ctx, '999999');

      expect(notFoundUserMessageStub.called).to.equal(true);
      expect(blockSaveStub.called).to.equal(false);
    });

    it('rejects block when there are active orders between the two users', async () => {
      const target = makeUser({ tg_id: '222' });
      userFindOneStub.resolves(target);
      orderExistsStub.resolves(true);

      await commands.block(ctx, '222');

      expect(ordersInProcessStub.called).to.equal(true);
      expect(blockSaveStub.called).to.equal(false);
    });

    it('rejects block when user is already blocked', async () => {
      const target = makeUser({ tg_id: '222' });
      userFindOneStub.resolves(target);
      orderExistsStub.resolves(false);
      blockExistsStub.resolves(true);

      await commands.block(ctx, '222');

      expect(userAlreadyBlockedStub.called).to.equal(true);
      expect(blockSaveStub.called).to.equal(false);
    });
  });

  // ─── unblock ─────────────────────────────────────────────────────────────

  describe('unblock', () => {
    it('unblocks user found by @username', async () => {
      const target = makeUser({ tg_id: '222' });
      userFindOneStub.resolves(target);
      blockDeleteOneStub.resolves({ deletedCount: 1 });

      await commands.unblock(ctx, '@spammer');

      expect(userFindOneStub.calledWith({ username: 'spammer' })).to.equal(
        true,
      );
      expect(userUnblockedStub.called).to.equal(true);
    });

    it('unblocks user found by numeric ID', async () => {
      const target = makeUser({ tg_id: '222' });
      userFindOneStub.resolves(target);
      blockDeleteOneStub.resolves({ deletedCount: 1 });

      await commands.unblock(ctx, '222');

      expect(userFindOneStub.calledWith({ tg_id: '222' })).to.equal(true);
      expect(userUnblockedStub.called).to.equal(true);
    });

    it('replies not found when user does not exist', async () => {
      userFindOneStub.resolves(null);

      await commands.unblock(ctx, '999');

      expect(notFoundUserMessageStub.called).to.equal(true);
    });

    it('replies not found when block record does not exist', async () => {
      const target = makeUser({ tg_id: '222' });
      userFindOneStub.resolves(target);
      blockDeleteOneStub.resolves({ deletedCount: 0 });

      await commands.unblock(ctx, '222');

      expect(notFoundUserMessageStub.called).to.equal(true);
    });
  });

  // ─── blocklist ────────────────────────────────────────────────────────────

  describe('blocklist', () => {
    it('shows empty message when no blocks exist', async () => {
      blockFindStub.resolves([]);

      await commands.blocklist(ctx);

      expect(blocklistEmptyMessageStub.called).to.equal(true);
      expect(blocklistMessageStub.called).to.equal(false);
    });

    it('shows blocked users with known usernames', async () => {
      blockFindStub.resolves([{ blocked_tg_id: '222' }]);
      userFindStub.resolves([makeUser({ tg_id: '222', username: 'spammer' })]);

      await commands.blocklist(ctx);

      expect(blocklistMessageStub.called).to.equal(true);
      const [, users, unknownIds] = blocklistMessageStub.firstCall.args;
      expect(users).to.have.lengthOf(1);
      expect(unknownIds).to.have.lengthOf(0);
    });

    it('passes unknownIds for blocked tg_ids with no User record', async () => {
      blockFindStub.resolves([{ blocked_tg_id: '999' }]);
      userFindStub.resolves([]); // no matching user in DB

      await commands.blocklist(ctx);

      expect(blocklistMessageStub.called).to.equal(true);
      const [, users, unknownIds] = blocklistMessageStub.firstCall.args;
      expect(users).to.have.lengthOf(0);
      expect(unknownIds).to.deep.equal(['999']);
    });
  });
});
