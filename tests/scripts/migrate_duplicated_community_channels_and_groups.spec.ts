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
  let createInterfaceStub: any;
  let mockRl: any;
  let botStub: any;
  let consoleLogStub: any;

  beforeEach(() => {
    sandbox = sinon.createSandbox();

    // Set process env locally
    process.env.BOT_TOKEN = 'testtoken';
    process.env.DB_URI = 'mongodb://localhost:test';

    exitStub = sandbox.stub(process, 'exit').callsFake((code: number) => {
      throw new Error(`process.exit: ${code}`);
    });
    connectStub = sandbox.stub().resolves();

    mockRl = {
      question: sandbox.stub().callsFake((q: any, cb: any) => cb('YES')),
      close: sandbox.stub(),
    };
    createInterfaceStub = sandbox.stub().returns(mockRl);

    botStub = {
      telegram: {}
    };

    communityFindStub = sandbox.stub().resolves([]);
    userFindByIdStub = sandbox.stub().resolves(null);
    isGroupAdminStub = sandbox.stub().resolves({ success: false });
    // Print through original console
    consoleLogStub = sandbox.stub(console, 'log').callsFake((...args: any[]) => {
      console.info('STUBBED LOG:', ...args);
    });
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
        creator_id: 'user1'
      },
      {
        _id: '2',
        name: 'Community 2',
        group: '@group2',
        dispute_channel: '@disp2',
        order_channels: [{ name: '@order2' }],
        creator_id: 'user2'
      }
    ]);

    const { runMigration } = proxyquire('../../scripts/migrate_duplicated_community_channels_and_groups', {
      'mongoose': { connect: connectStub },
      '../models': {
        Community: { find: communityFindStub },
        User: { findById: userFindByIdStub }
      },
      'telegraf': {
        Telegraf: sandbox.stub().returns(botStub)
      },
      '../util': {
        isGroupAdmin: isGroupAdminStub
      },
      'readline': {
        createInterface: createInterfaceStub
      }
    });

    try {
      await runMigration();
    } catch (e: any) {
      if (!e.message.includes('process.exit')) throw e;
    }
    console.info('Test 1 finished runMigration');

    expect(connectStub.called).to.be.true;
    expect(exitStub.calledWith(0)).to.be.true;
    expect(createInterfaceStub.called).to.be.false;
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
        save: c1Save
      },
      {
        _id: '2',
        name: 'Community 2',
        group: '@duplicate_group',
        dispute_channel: '@duplicate_disp',
        order_channels: [{ name: '@duplicate_order' }],
        creator_id: 'user2',
        save: c2Save
      }
    ]);

    userFindByIdStub.withArgs('user1').resolves({ id: 'user1' });
    userFindByIdStub.withArgs('user2').resolves({ id: 'user2' });

    // creator1 is admin, creator2 is not
    isGroupAdminStub.callsFake(async (target: string, user: any) => {
      if (user.id === 'user1') return { success: true };
      return { success: false };
    });

    const { runMigration } = proxyquire('../../scripts/migrate_duplicated_community_channels_and_groups', {
      'mongoose': { connect: connectStub },
      '../models': {
        Community: { find: communityFindStub },
        User: { findById: userFindByIdStub }
      },
      'telegraf': {
        Telegraf: sandbox.stub().returns(botStub)
      },
      '../util': {
        isGroupAdmin: isGroupAdminStub
      },
      'readline': {
        createInterface: createInterfaceStub
      }
    });

    try {
      await runMigration();
    } catch (e: any) {
      if (!e.message.includes('process.exit')) throw e;
    }

    expect(createInterfaceStub.calledOnce).to.be.true;
    expect(c1Save.called).to.be.false; // Was not modified because user1 is admin
    expect(c2Save.calledOnce).to.be.true; // Was modified because user2 is not admin

    const communities = await communityFindStub.firstCall.returnValue;
    const resolvedC2 = communities[1];

    expect(resolvedC2.group).to.be.undefined;
    expect(resolvedC2.dispute_channel).to.be.undefined;
    expect(resolvedC2.order_channels).to.deep.equal([]);
    expect(exitStub.calledWith(0)).to.be.true;
  });
});

export {};
