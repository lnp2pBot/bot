import { expect } from 'chai';
import sinon from 'sinon';
import { Telegraf } from 'telegraf';
import checkSolvers from './check_solvers';
import { Community, User } from '../models';
import { logger } from '../logger';
import { getUserI18nContext } from '../util';

describe('checkSolvers', () => {
  let bot: any;
  let sandbox: sinon.SinonSandbox;
  let communityFindStub: sinon.SinonStub;
  let userFindByIdStub: sinon.SinonStub;
  let loggerErrorStub: sinon.SinonStub;
  let loggerInfoStub: sinon.SinonStub;
  let getUserI18nContextStub: sinon.SinonStub;
  let telegramSendMessageStub: sinon.SinonStub;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    
    // Mock Telegraf bot
    bot = {
      telegram: {
        sendMessage: sandbox.stub()
      }
    };
    telegramSendMessageStub = bot.telegram.sendMessage;

    // Mock model methods
    communityFindStub = sandbox.stub(Community, 'find');
    userFindByIdStub = sandbox.stub(User, 'findById');
    
    // Mock logger
    loggerErrorStub = sandbox.stub(logger, 'error');
    loggerInfoStub = sandbox.stub(logger, 'info');
    
    // Mock utility functions
    getUserI18nContextStub = sandbox.stub();
    sandbox.stub(require('../util'), 'getUserI18nContext').callsFake(getUserI18nContextStub);

    // Mock environment variables
    process.env.MAX_ADMIN_WARNINGS_BEFORE_DEACTIVATION = '3';
  });

  afterEach(() => {
    sandbox.restore();
    delete process.env.MAX_ADMIN_WARNINGS_BEFORE_DEACTIVATION;
  });

  describe('Happy Path Scenarios', () => {
    it('should skip communities that already have solvers', async () => {
      const mockCommunities = [
        {
          _id: '1',
          name: 'Community 1',
          solvers: ['solver1', 'solver2'],
          warning_messages_count: 0,
          creator_id: 'admin1'
        },
        {
          _id: '2',
          name: 'Community 2',
          solvers: ['solver3'],
          warning_messages_count: 1,
          creator_id: 'admin2'
        }
      ];

      communityFindStub.resolves(mockCommunities);

      await checkSolvers(bot);

      expect(communityFindStub.calledOnce).to.be.true;
      expect(telegramSendMessageStub.called).to.be.false;
      expect(loggerErrorStub.called).to.be.false;
    });

    it('should notify admin when community has no solvers', async () => {
      const mockCommunity = {
        _id: '1',
        name: 'Test Community',
        solvers: [],
        warning_messages_count: 0,
        creator_id: 'admin1',
        save: sandbox.stub().resolves()
      };

      const mockAdmin = {
        _id: 'admin1',
        tg_id: '123456789'
      };

      const mockI18nContext = {
        t: sandbox.stub().returns('Warning message')
      };

      communityFindStub.resolves([mockCommunity]);
      userFindByIdStub.resolves(mockAdmin);
      getUserI18nContextStub.resolves(mockI18nContext);

      await checkSolvers(bot);

      expect(mockCommunity.warning_messages_count).to.equal(1);
      expect(mockCommunity.save.calledOnce).to.be.true;
      expect(telegramSendMessageStub.calledOnce).to.be.true;
      expect(telegramSendMessageStub.calledWith('123456789', 'Warning message')).to.be.true;
    });

    it('should handle multiple communities with different solver states', async () => {
      const mockCommunities = [
        {
          _id: '1',
          name: 'Has Solvers',
          solvers: ['solver1'],
          warning_messages_count: 0,
          creator_id: 'admin1'
        },
        {
          _id: '2',
          name: 'No Solvers',
          solvers: [],
          warning_messages_count: 0,
          creator_id: 'admin2',
          save: sandbox.stub().resolves()
        }
      ];

      const mockAdmin = {
        _id: 'admin2',
        tg_id: '987654321'
      };

      const mockI18nContext = {
        t: sandbox.stub().returns('Warning message')
      };

      communityFindStub.resolves(mockCommunities);
      userFindByIdStub.resolves(mockAdmin);
      getUserI18nContextStub.resolves(mockI18nContext);

      await checkSolvers(bot);

      expect(mockCommunities[1].warning_messages_count).to.equal(1);
      expect(telegramSendMessageStub.calledOnce).to.be.true;
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty communities list', async () => {
      communityFindStub.resolves([]);

      await checkSolvers(bot);

      expect(communityFindStub.calledOnce).to.be.true;
      expect(telegramSendMessageStub.called).to.be.false;
      expect(loggerErrorStub.called).to.be.false;
    });

    it('should handle community with warning_messages_count at maximum threshold', async () => {
      const mockCommunity = {
        _id: '1',
        name: 'Test Community',
        solvers: [],
        warning_messages_count: 2, // One less than max (3)
        creator_id: 'admin1',
        delete: sandbox.stub().resolves()
      };

      communityFindStub.resolves([mockCommunity]);

      await checkSolvers(bot);

      expect(mockCommunity.delete.calledOnce).to.be.true;
      expect(loggerInfoStub.calledOnce).to.be.true;
      expect(loggerInfoStub.calledWith('Community: Test Community has been deleted due to lack of solvers.')).to.be.true;
      expect(telegramSendMessageStub.called).to.be.false;
    });

    it('should handle community with exact maximum warning count', async () => {
      const mockCommunity = {
        _id: '1',
        name: 'Test Community',
        solvers: [],
        warning_messages_count: 3, // Equal to max
        creator_id: 'admin1',
        delete: sandbox.stub().resolves()
      };

      communityFindStub.resolves([mockCommunity]);

      await checkSolvers(bot);

      expect(mockCommunity.delete.calledOnce).to.be.true;
      expect(loggerInfoStub.calledOnce).to.be.true;
    });

    it('should handle admin not found scenario', async () => {
      const mockCommunity = {
        _id: '1',
        name: 'Test Community',
        solvers: [],
        warning_messages_count: 0,
        creator_id: 'nonexistent_admin',
        save: sandbox.stub().resolves()
      };

      communityFindStub.resolves([mockCommunity]);
      userFindByIdStub.resolves(null);

      await checkSolvers(bot);

      expect(mockCommunity.save.calledOnce).to.be.true;
      expect(telegramSendMessageStub.called).to.be.false;
      expect(loggerErrorStub.called).to.be.false;
    });

    it('should handle last warning message scenario', async () => {
      const mockCommunity = {
        _id: '1',
        name: 'Test Community',
        solvers: [],
        warning_messages_count: 1, // This will become 2, one before max (3)
        creator_id: 'admin1',
        save: sandbox.stub().resolves()
      };

      const mockAdmin = {
        _id: 'admin1',
        tg_id: '123456789'
      };

      const mockI18nContext = {
        t: sandbox.stub().callsFake((key, params) => {
          if (key === 'check_solvers_last_warning') {
            return `Last warning for ${params.communityName}`;
          }
          return 'Default message';
        })
      };

      communityFindStub.resolves([mockCommunity]);
      userFindByIdStub.resolves(mockAdmin);
      getUserI18nContextStub.resolves(mockI18nContext);

      await checkSolvers(bot);

      expect(mockCommunity.warning_messages_count).to.equal(2);
      expect(mockI18nContext.t.calledWith('check_solvers_last_warning', { communityName: 'Test Community' })).to.be.true;
      expect(telegramSendMessageStub.calledWith('123456789', 'Last warning for Test Community')).to.be.true;
    });

    it('should handle regular warning message scenario', async () => {
      const mockCommunity = {
        _id: '1',
        name: 'Test Community',
        solvers: [],
        warning_messages_count: 0,
        creator_id: 'admin1',
        save: sandbox.stub().resolves()
      };

      const mockAdmin = {
        _id: 'admin1',
        tg_id: '123456789'
      };

      const mockI18nContext = {
        t: sandbox.stub().callsFake((key, params) => {
          if (key === 'check_solvers') {
            return `Warning for ${params.communityName}, ${params.remainingDays} days remaining`;
          }
          return 'Default message';
        })
      };

      communityFindStub.resolves([mockCommunity]);
      userFindByIdStub.resolves(mockAdmin);
      getUserI18nContextStub.resolves(mockI18nContext);

      await checkSolvers(bot);

      expect(mockCommunity.warning_messages_count).to.equal(1);
      expect(mockI18nContext.t.calledWith('check_solvers', { 
        communityName: 'Test Community', 
        remainingDays: 1 
      })).to.be.true;
      expect(telegramSendMessageStub.calledWith('123456789', 'Warning for Test Community, 1 days remaining')).to.be.true;
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors when finding communities', async () => {
      const dbError = new Error('Database connection failed');
      communityFindStub.rejects(dbError);

      await checkSolvers(bot);

      expect(loggerErrorStub.calledOnce).to.be.true;
      expect(loggerErrorStub.calledWith('checkSolvers catch error: Database connection failed')).to.be.true;
    });

    it('should handle errors when saving community', async () => {
      const mockCommunity = {
        _id: '1',
        name: 'Test Community',
        solvers: [],
        warning_messages_count: 0,
        creator_id: 'admin1',
        save: sandbox.stub().rejects(new Error('Save failed'))
      };

      communityFindStub.resolves([mockCommunity]);

      await checkSolvers(bot);

      expect(loggerErrorStub.calledOnce).to.be.true;
      expect(loggerErrorStub.calledWith('checkSolvers catch error: Save failed')).to.be.true;
    });

    it('should handle errors when deleting community', async () => {
      const mockCommunity = {
        _id: '1',
        name: 'Test Community',
        solvers: [],
        warning_messages_count: 2,
        creator_id: 'admin1',
        delete: sandbox.stub().rejects(new Error('Delete failed'))
      };

      communityFindStub.resolves([mockCommunity]);

      await checkSolvers(bot);

      expect(loggerErrorStub.calledOnce).to.be.true;
      expect(loggerErrorStub.calledWith('checkSolvers catch error: Delete failed')).to.be.true;
    });

    it('should handle errors when finding admin user', async () => {
      const mockCommunity = {
        _id: '1',
        name: 'Test Community',
        solvers: [],
        warning_messages_count: 0,
        creator_id: 'admin1',
        save: sandbox.stub().resolves()
      };

      communityFindStub.resolves([mockCommunity]);
      userFindByIdStub.rejects(new Error('User query failed'));

      await checkSolvers(bot);

      expect(loggerErrorStub.calledOnce).to.be.true;
      expect(loggerErrorStub.calledWith('checkSolvers catch error: User query failed')).to.be.true;
    });

    it('should handle errors when getting i18n context', async () => {
      const mockCommunity = {
        _id: '1',
        name: 'Test Community',
        solvers: [],
        warning_messages_count: 0,
        creator_id: 'admin1',
        save: sandbox.stub().resolves()
      };

      const mockAdmin = {
        _id: 'admin1',
        tg_id: '123456789'
      };

      communityFindStub.resolves([mockCommunity]);
      userFindByIdStub.resolves(mockAdmin);
      getUserI18nContextStub.rejects(new Error('i18n context failed'));

      await checkSolvers(bot);

      expect(loggerErrorStub.calledOnce).to.be.true;
      expect(loggerErrorStub.calledWith('checkSolvers catch error: i18n context failed')).to.be.true;
    });

    it('should handle errors when sending telegram message', async () => {
      const mockCommunity = {
        _id: '1',
        name: 'Test Community',
        solvers: [],
        warning_messages_count: 0,
        creator_id: 'admin1',
        save: sandbox.stub().resolves()
      };

      const mockAdmin = {
        _id: 'admin1',
        tg_id: '123456789'
      };

      const mockI18nContext = {
        t: sandbox.stub().returns('Warning message')
      };

      communityFindStub.resolves([mockCommunity]);
      userFindByIdStub.resolves(mockAdmin);
      getUserI18nContextStub.resolves(mockI18nContext);
      telegramSendMessageStub.rejects(new Error('Telegram API failed'));

      await checkSolvers(bot);

      expect(loggerErrorStub.calledOnce).to.be.true;
      expect(loggerErrorStub.calledWith('checkSolvers catch error: Telegram API failed')).to.be.true;
    });

    it('should handle non-Error objects thrown as exceptions', async () => {
      communityFindStub.rejects('String error');

      await checkSolvers(bot);

      expect(loggerErrorStub.calledOnce).to.be.true;
      expect(loggerErrorStub.calledWith('checkSolvers catch error: String error')).to.be.true;
    });

    it('should handle null/undefined errors', async () => {
      communityFindStub.rejects(null);

      await checkSolvers(bot);

      expect(loggerErrorStub.calledOnce).to.be.true;
      expect(loggerErrorStub.calledWith('checkSolvers catch error: null')).to.be.true;
    });
  });

  describe('Environment Configuration', () => {
    it('should handle missing MAX_ADMIN_WARNINGS_BEFORE_DEACTIVATION environment variable', async () => {
      delete process.env.MAX_ADMIN_WARNINGS_BEFORE_DEACTIVATION;

      const mockCommunity = {
        _id: '1',
        name: 'Test Community',
        solvers: [],
        warning_messages_count: 0,
        creator_id: 'admin1',
        save: sandbox.stub().resolves()
      };

      const mockAdmin = {
        _id: 'admin1',
        tg_id: '123456789'
      };

      const mockI18nContext = {
        t: sandbox.stub().returns('Warning message')
      };

      communityFindStub.resolves([mockCommunity]);
      userFindByIdStub.resolves(mockAdmin);
      getUserI18nContextStub.resolves(mockI18nContext);

      await checkSolvers(bot);

      // Should handle NaN gracefully
      expect(mockCommunity.warning_messages_count).to.equal(1);
      expect(telegramSendMessageStub.calledOnce).to.be.true;
    });

    it('should handle different MAX_ADMIN_WARNINGS_BEFORE_DEACTIVATION values', async () => {
      process.env.MAX_ADMIN_WARNINGS_BEFORE_DEACTIVATION = '5';

      const mockCommunity = {
        _id: '1',
        name: 'Test Community',
        solvers: [],
        warning_messages_count: 4, // Equal to max
        creator_id: 'admin1',
        delete: sandbox.stub().resolves()
      };

      communityFindStub.resolves([mockCommunity]);

      await checkSolvers(bot);

      expect(mockCommunity.delete.calledOnce).to.be.true;
      expect(loggerInfoStub.calledOnce).to.be.true;
    });
  });

  describe('Input Validation', () => {
    it('should handle null bot parameter', async () => {
      await checkSolvers(null as any);

      expect(loggerErrorStub.called).to.be.true;
    });

    it('should handle undefined bot parameter', async () => {
      await checkSolvers(undefined as any);

      expect(loggerErrorStub.called).to.be.true;
    });

    it('should handle bot without telegram property', async () => {
      const invalidBot = {} as any;

      communityFindStub.resolves([{
        _id: '1',
        name: 'Test Community',
        solvers: [],
        warning_messages_count: 0,
        creator_id: 'admin1',
        save: sandbox.stub().resolves()
      }]);

      userFindByIdStub.resolves({
        _id: 'admin1',
        tg_id: '123456789'
      });

      getUserI18nContextStub.resolves({
        t: sandbox.stub().returns('Warning message')
      });

      await checkSolvers(invalidBot);

      expect(loggerErrorStub.called).to.be.true;
    });
  });

  describe('Concurrency and Performance', () => {
    it('should handle multiple communities efficiently', async () => {
      const mockCommunities = Array.from({ length: 10 }, (_, i) => ({
        _id: `${i}`,
        name: `Community ${i}`,
        solvers: [],
        warning_messages_count: 0,
        creator_id: `admin${i}`,
        save: sandbox.stub().resolves()
      }));

      const mockAdmin = {
        _id: 'admin0',
        tg_id: '123456789'
      };

      const mockI18nContext = {
        t: sandbox.stub().returns('Warning message')
      };

      communityFindStub.resolves(mockCommunities);
      userFindByIdStub.resolves(mockAdmin);
      getUserI18nContextStub.resolves(mockI18nContext);

      const startTime = Date.now();
      await checkSolvers(bot);
      const endTime = Date.now();

      expect(endTime - startTime).to.be.lessThan(1000); // Should complete quickly
      expect(telegramSendMessageStub.callCount).to.equal(10);
    });

    it('should handle mixed scenarios in batch processing', async () => {
      const mockCommunities = [
        {
          _id: '1',
          name: 'Has Solvers',
          solvers: ['solver1'],
          warning_messages_count: 0,
          creator_id: 'admin1'
        },
        {
          _id: '2',
          name: 'No Solvers Warning',
          solvers: [],
          warning_messages_count: 0,
          creator_id: 'admin2',
          save: sandbox.stub().resolves()
        },
        {
          _id: '3',
          name: 'To Delete',
          solvers: [],
          warning_messages_count: 2,
          creator_id: 'admin3',
          delete: sandbox.stub().resolves()
        }
      ];

      const mockAdmin = {
        _id: 'admin2',
        tg_id: '123456789'
      };

      const mockI18nContext = {
        t: sandbox.stub().returns('Warning message')
      };

      communityFindStub.resolves(mockCommunities);
      userFindByIdStub.resolves(mockAdmin);
      getUserI18nContextStub.resolves(mockI18nContext);

      await checkSolvers(bot);

      expect(mockCommunities[1].save.calledOnce).to.be.true;
      expect(mockCommunities[2].delete.calledOnce).to.be.true;
      expect(telegramSendMessageStub.calledOnce).to.be.true;
      expect(loggerInfoStub.calledOnce).to.be.true;
    });
  });
});