const { expect } = require('chai');
const sinon = require('sinon');
const proxyquire = require('proxyquire').noPreserveCache();

describe('Migration Script: migrate_duplicated_community_channels_and_groups', () => {
  let sandbox: any;
  let exitStub: any;
  let communityFindStub: any;
  let userFindByIdStub: any;
  let isGroupAdminStub: any;
  let connectStub: any;
  let botStub: any;
  let createInterfaceStub: any;
  let mockRl: any;

  beforeEach(() => {
    sandbox = sinon.createSandbox();

    // Set process env locally
    process.env.BOT_TOKEN = 'testtoken';
    process.env.MONGO_URI = 'mongodb://localhost:test';

    exitStub = sandbox.stub(process, 'exit').callsFake((code: number) => {
      throw new Error(`process.exit: ${code}`);
    });
    const mockMongoose = {
      connection: {
        once: sandbox.stub().callsFake((event: string, cb: any) => {
          if (event === 'open') cb(); // eslint-disable-line n/no-callback-literal
        }),
        on: sandbox.stub(),
      },
    };
    connectStub = sandbox.stub().returns(mockMongoose);

    mockRl = {
      question: sandbox.stub().callsFake((q: any, cb: any) => cb('YES')), // eslint-disable-line n/no-callback-literal
      close: sandbox.stub(),
    };
    createInterfaceStub = sandbox.stub().returns(mockRl);

    botStub = {
      telegram: {},
    };

    communityFindStub = sandbox.stub().resolves([]);
    userFindByIdStub = sandbox.stub().resolves(null);
    isGroupAdminStub = sandbox.stub().resolves({ success: false });
    // Silence console
    sandbox.stub(console, 'log');
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('should exit with 0 if no duplicates found', async () => {
    communityFindStub.resolves([
      {
        _id: '1',
        name: 'Community 1',
        group: '@group1',
        dispute_channel: '@disp1',
        order_channels: [{ name: '@order1' }],
        creator_id: 'user1',
      },
      {
        _id: '2',
        name: 'Community 2',
        group: '@group2',
        dispute_channel: '@disp2',
        order_channels: [{ name: '@order2' }],
        creator_id: 'user2',
      },
    ]);

    const { runMigration } = proxyquire(
      '../../scripts/migrate_duplicated_community_channels_and_groups',
      {
        '../db_connect': { connect: connectStub },
        '../models': {
          Community: { find: communityFindStub },
          User: { findById: userFindByIdStub },
        },
        telegraf: {
          Telegraf: sandbox.stub().returns(botStub),
        },
        '../util': {
          isGroupAdmin: isGroupAdminStub,
        },
        readline: {
          createInterface: createInterfaceStub,
        },
        '../logger': {
          logger: {
            info: sandbox.stub(),
            error: sandbox.stub(),
            warn: sandbox.stub(),
          },
        },
      },
    );

    try {
      await runMigration();
    } catch (e: any) {
      if (!e.message.includes('process.exit')) throw e;
    }

    expect(connectStub.called).to.equal(true);
    expect(exitStub.calledWith(0)).to.equal(true);
    expect(createInterfaceStub.called).to.equal(false);
  });

  it('should unset fields and clear order_channels for non-admin on grouped dupes and save on YES', async () => {
    const c1Save = sandbox.stub().resolves();
    const c2Save = sandbox.stub().resolves();

    communityFindStub.resolves([
      {
        _id: '1',
        name: 'Community 1',
        group: '@duplicate_group',
        dispute_channel: '@duplicate_disp',
        order_channels: [{ name: '@duplicate_order' }, { name: '@safe_order' }],
        creator_id: 'user1',
        save: c1Save,
      },
      {
        _id: '2',
        name: 'Community 2',
        group: '@duplicate_group',
        dispute_channel: '@duplicate_disp',
        order_channels: [{ name: '@duplicate_order' }],
        creator_id: 'user2',
        save: c2Save,
      },
    ]);

    userFindByIdStub.withArgs('user1').resolves({ id: 'user1' });
    userFindByIdStub.withArgs('user2').resolves({ id: 'user2' });

    // creator1 is admin, creator2 is not
    isGroupAdminStub.callsFake(async (target: string, user: any) => {
      if (user.id === 'user1') return { success: true };
      return { success: false };
    });

    const { runMigration } = proxyquire(
      '../../scripts/migrate_duplicated_community_channels_and_groups',
      {
        '../db_connect': { connect: connectStub },
        '../models': {
          Community: { find: communityFindStub },
          User: { findById: userFindByIdStub },
        },
        telegraf: {
          Telegraf: sandbox.stub().returns(botStub),
        },
        '../util': {
          isGroupAdmin: isGroupAdminStub,
        },
        readline: {
          createInterface: createInterfaceStub,
        },
        '../logger': {
          logger: {
            info: sandbox.stub(),
            error: sandbox.stub(),
            warn: sandbox.stub(),
          },
        },
      },
    );

    try {
      await runMigration();
    } catch (e: any) {
      if (!e.message.includes('process.exit')) throw e;
    }

    expect(createInterfaceStub.calledOnce).to.equal(true);
    expect(c1Save.called).to.equal(false); // Was not modified because user1 is admin
    expect(c2Save.calledOnce).to.equal(true); // Was modified because user2 is not admin

    const communities = await communityFindStub.firstCall.returnValue;
    const resolvedC2 = communities[1];

    expect(resolvedC2.group).to.equal(undefined);
    expect(resolvedC2.dispute_channel).to.equal(undefined);
    expect(resolvedC2.order_channels.length).to.equal(0);
    expect(exitStub.calledWith(0)).to.equal(true);
  });
  it('should handle more than two duplicates and clear multiple communities', async () => {
    const c1Save = sandbox.stub().resolves();
    const c2Save = sandbox.stub().resolves();
    const c3Save = sandbox.stub().resolves();

    communityFindStub.resolves([
      {
        _id: '1',
        name: 'C1',
        group: '@dupe',
        creator_id: 'u1',
        save: c1Save,
        order_channels: [{ name: '@c1' }],
      },
      {
        _id: '2',
        name: 'C2',
        group: '@dupe',
        creator_id: 'u2',
        save: c2Save,
        order_channels: [{ name: '@c2' }],
      },
      {
        _id: '3',
        name: 'C3',
        group: '@dupe',
        creator_id: 'u3',
        save: c3Save,
        order_channels: [{ name: '@c3' }],
      },
    ]);

    userFindByIdStub.withArgs('u1').resolves({ id: 'u1' });
    userFindByIdStub.withArgs('u2').resolves({ id: 'u2' });
    userFindByIdStub.withArgs('u3').resolves({ id: 'u3' });

    // Only u1 is admin
    isGroupAdminStub.callsFake(async (target: string, user: any) => {
      return { success: user.id === 'u1' };
    });

    const { runMigration } = proxyquire(
      '../../scripts/migrate_duplicated_community_channels_and_groups',
      {
        '../db_connect': { connect: connectStub },
        '../models': {
          Community: { find: communityFindStub },
          User: { findById: userFindByIdStub },
        },
        telegraf: { Telegraf: sandbox.stub().returns(botStub) },
        '../util': { isGroupAdmin: isGroupAdminStub },
        readline: { createInterface: createInterfaceStub },
        '../logger': {
          logger: {
            info: sandbox.stub(),
            error: sandbox.stub(),
            warn: sandbox.stub(),
          },
        },
      },
    );

    try {
      await runMigration();
    } catch (e: any) {
      if (!e.message.includes('process.exit')) throw e;
    }

    expect(c1Save.called).to.equal(false);
    expect(c2Save.calledOnce).to.equal(true);
    expect(c3Save.calledOnce).to.equal(true);
  });

  it('should NOT save changes if admin answers NO', async () => {
    const cSave = sandbox.stub().resolves();
    communityFindStub.resolves([
      {
        _id: '1',
        name: 'C1',
        group: '@d',
        creator_id: 'u1',
        order_channels: [{ name: '@o1' }],
        save: cSave,
      },
      {
        _id: '2',
        name: 'C2',
        group: '@d',
        creator_id: 'u2',
        order_channels: [{ name: '@o2' }],
        save: cSave,
      },
    ]);

    // User u2 is not admin, so C2 needs change
    isGroupAdminStub.resolves({ success: false });
    mockRl.question.callsFake((q: any, cb: any) => cb('NO')); // eslint-disable-line n/no-callback-literal

    const { runMigration } = proxyquire(
      '../../scripts/migrate_duplicated_community_channels_and_groups',
      {
        '../db_connect': { connect: connectStub },
        '../models': {
          Community: { find: communityFindStub },
          User: { findById: userFindByIdStub },
        },
        telegraf: { Telegraf: sandbox.stub().returns(botStub) },
        '../util': { isGroupAdmin: isGroupAdminStub },
        readline: { createInterface: createInterfaceStub },
        '../logger': {
          logger: {
            info: sandbox.stub(),
            error: sandbox.stub(),
            warn: sandbox.stub(),
          },
        },
      },
    );

    try {
      await runMigration();
    } catch (e: any) {
      if (!e.message.includes('process.exit')) throw e;
    }

    expect(cSave.called).to.equal(false);
  });

  it('should only clear group if only group is duplicated', async () => {
    const c2Save = sandbox.stub().resolves();
    communityFindStub.resolves([
      {
        _id: '1',
        group: '@g',
        dispute_channel: '@d1',
        order_channels: [{ name: '@o1' }],
        creator_id: 'u1',
        save: sandbox.stub(),
      },
      {
        _id: '2',
        group: '@g',
        dispute_channel: '@d2',
        order_channels: [{ name: '@o2' }],
        creator_id: 'u2',
        save: c2Save,
      },
    ]);
    isGroupAdminStub.resolves({ success: false });

    const { runMigration } = proxyquire(
      '../../scripts/migrate_duplicated_community_channels_and_groups',
      {
        '../db_connect': { connect: connectStub },
        '../models': {
          Community: { find: communityFindStub },
          User: { findById: userFindByIdStub },
        },
        telegraf: { Telegraf: sandbox.stub().returns(botStub) },
        '../util': { isGroupAdmin: isGroupAdminStub },
        readline: { createInterface: createInterfaceStub },
        '../logger': {
          logger: {
            info: sandbox.stub(),
            error: sandbox.stub(),
            warn: sandbox.stub(),
          },
        },
      },
    );

    try {
      await runMigration();
    } catch (e: any) {
      if (!e.message.includes('process.exit')) throw e;
    }

    const communities = await communityFindStub.firstCall.returnValue;
    expect(communities[1].group).to.equal(undefined);
    expect(communities[1].dispute_channel).to.be.equal('@d2'); // Remains untouched
    expect(communities[1].order_channels[0].name).to.be.equal('@o2'); // Remains untouched
  });

  it('should only clear dispute_channel if only dispute_channel is duplicated', async () => {
    const c2Save = sandbox.stub().resolves();
    communityFindStub.resolves([
      {
        _id: '1',
        group: '@g1',
        dispute_channel: '@d',
        order_channels: [{ name: '@o1' }],
        creator_id: 'u1',
        save: sandbox.stub(),
      },
      {
        _id: '2',
        group: '@g2',
        dispute_channel: '@d',
        order_channels: [{ name: '@o2' }],
        creator_id: 'u2',
        save: c2Save,
      },
    ]);
    isGroupAdminStub.resolves({ success: false });

    const { runMigration } = proxyquire(
      '../../scripts/migrate_duplicated_community_channels_and_groups',
      {
        '../db_connect': { connect: connectStub },
        '../models': {
          Community: { find: communityFindStub },
          User: { findById: userFindByIdStub },
        },
        telegraf: { Telegraf: sandbox.stub().returns(botStub) },
        '../util': { isGroupAdmin: isGroupAdminStub },
        readline: { createInterface: createInterfaceStub },
        '../logger': {
          logger: {
            info: sandbox.stub(),
            error: sandbox.stub(),
            warn: sandbox.stub(),
          },
        },
      },
    );

    try {
      await runMigration();
    } catch (e: any) {
      if (!e.message.includes('process.exit')) throw e;
    }

    const communities = await communityFindStub.firstCall.returnValue;
    expect(communities[1].dispute_channel).to.equal(undefined);
    expect(communities[1].group).to.be.equal('@g2');
  });

  it('should only clear order_channels if only order_channels are duplicated', async () => {
    const c2Save = sandbox.stub().resolves();
    communityFindStub.resolves([
      {
        _id: '1',
        group: '@g1',
        dispute_channel: '@d1',
        order_channels: [{ name: '@o' }],
        creator_id: 'u1',
        save: sandbox.stub(),
      },
      {
        _id: '2',
        name: 'C2',
        group: '@g2',
        dispute_channel: '@d2',
        order_channels: [{ name: '@o' }, { name: '@safe' }],
        creator_id: 'u2',
        save: c2Save,
      },
    ]);
    isGroupAdminStub.resolves({ success: false });

    const { runMigration } = proxyquire(
      '../../scripts/migrate_duplicated_community_channels_and_groups',
      {
        '../db_connect': { connect: connectStub },
        '../models': {
          Community: { find: communityFindStub },
          User: { findById: userFindByIdStub },
        },
        telegraf: { Telegraf: sandbox.stub().returns(botStub) },
        '../util': { isGroupAdmin: isGroupAdminStub },
        readline: { createInterface: createInterfaceStub },
        '../logger': {
          logger: {
            info: sandbox.stub(),
            error: sandbox.stub(),
            warn: sandbox.stub(),
          },
        },
      },
    );

    try {
      await runMigration();
    } catch (e: any) {
      if (!e.message.includes('process.exit')) throw e;
    }

    const communities = await communityFindStub.firstCall.returnValue;
    expect(communities[1].order_channels.length).to.equal(0);
    expect(communities[1].group).to.be.equal('@g2');
    expect(communities[1].dispute_channel).to.be.equal('@d2');
  });
});

export {};
