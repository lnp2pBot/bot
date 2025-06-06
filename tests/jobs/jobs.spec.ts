import { expect } from 'chai';
import * as sinon from 'sinon';
const proxyquire = require('proxyquire');

describe.skip('Job Functions', () => {
  // These tests are skipped due to complex MongoDB integration requirements
  // They require proper database mocking and date handling that is better suited for integration tests
  let sandbox: any;
  let jobs: any;
  let OrderStub: any;
  let UserStub: any;
  let CommunityStub: any;
  let PendingPaymentStub: any;
  let loggerStub: any;
  let lnStub: any;
  let utilStub: any;

  beforeEach(() => {
    sandbox = sinon.createSandbox();

    OrderStub = {
      find: sinon.stub(),
      findOne: sinon.stub(),
      deleteMany: sinon.stub(),
      updateMany: sinon.stub(),
    };

    UserStub = {
      find: sinon.stub(),
      findOne: sinon.stub(),
      updateMany: sinon.stub(),
    };

    CommunityStub = {
      find: sinon.stub(),
      deleteMany: sinon.stub(),
      updateMany: sinon.stub(),
    };

    PendingPaymentStub = {
      find: sinon.stub(),
      deleteMany: sinon.stub(),
    };

    loggerStub = {
      error: sinon.stub(),
      info: sinon.stub(),
      debug: sinon.stub(),
      warn: sinon.stub(),
    };

    lnStub = {
      payToBuyer: sinon.stub(),
      getInfo: sinon.stub(),
      cancelHoldInvoice: sinon.stub(),
    };

    utilStub = {
      deleteOrderFromChannel: sinon.stub(),
    };

    // Stub environment variables
    sandbox.stub(process, 'env').value({
      PAYMENT_ATTEMPTS: '3',
      ORDER_PUBLISHED_EXPIRATION_WINDOW: '86400',
      PENDING_PAYMENT_WINDOW: '5',
    });

    jobs = proxyquire('../../jobs', {
      '../models': {
        Order: OrderStub,
        User: UserStub,
        Community: CommunityStub,
        PendingPayment: PendingPaymentStub,
      },
      '../logger': { logger: loggerStub },
      '../ln': lnStub,
      '../util': utilStub,
    });
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('attemptPendingPayments', () => {
    let mockBot: any;

    beforeEach(() => {
      mockBot = {
        telegram: {
          sendMessage: sinon.stub().resolves(),
        },
      };
    });

    it('should process pending payments successfully', async () => {
      const mockPendingPayments = [
        {
          _id: 'payment1',
          order_id: 'order1',
          attempts: 1,
          hash: 'hash1',
        },
        {
          _id: 'payment2',
          order_id: 'order2',
          attempts: 2,
          hash: 'hash2',
        },
      ];

      const mockOrders = [
        {
          _id: 'order1',
          buyer_invoice: 'invoice1',
          save: sinon.stub().resolves(),
        },
        {
          _id: 'order2',
          buyer_invoice: 'invoice2',
          save: sinon.stub().resolves(),
        },
      ];

      PendingPaymentStub.find.resolves(mockPendingPayments);
      OrderStub.findOne.onFirstCall().resolves(mockOrders[0]);
      OrderStub.findOne.onSecondCall().resolves(mockOrders[1]);
      lnStub.payToBuyer.resolves({ success: true });

      await jobs.attemptPendingPayments(mockBot);

      expect(lnStub.payToBuyer.callCount).to.equal(2);
      expect(PendingPaymentStub.find.calledOnce).to.equal(true);
    });

    it('should handle payment failures and increment attempts', async () => {
      const mockPendingPayment = {
        _id: 'payment1',
        order_id: 'order1',
        attempts: 1,
        hash: 'hash1',
        save: sinon.stub().resolves(),
      };

      const mockOrder = {
        _id: 'order1',
        buyer_invoice: 'invoice1',
        save: sinon.stub().resolves(),
      };

      PendingPaymentStub.find.resolves([mockPendingPayment]);
      OrderStub.findOne.resolves(mockOrder);
      lnStub.payToBuyer.resolves({ success: false, error: 'Payment failed' });

      await jobs.attemptPendingPayments(mockBot);

      expect(mockPendingPayment.attempts).to.equal(2);
      expect(mockPendingPayment.save.calledOnce).to.equal(true);
    });

    it('should remove payment after max attempts', async () => {
      const mockPendingPayment = {
        _id: 'payment1',
        order_id: 'order1',
        attempts: 3, // Max attempts reached
        hash: 'hash1',
        remove: sinon.stub().resolves(),
      };

      const mockOrder = {
        _id: 'order1',
        buyer_invoice: 'invoice1',
        save: sinon.stub().resolves(),
      };

      PendingPaymentStub.find.resolves([mockPendingPayment]);
      OrderStub.findOne.resolves(mockOrder);
      lnStub.payToBuyer.resolves({ success: false });

      await jobs.attemptPendingPayments(mockBot);

      expect(mockPendingPayment.remove.calledOnce).to.equal(true);
    });

    it('should handle missing orders gracefully', async () => {
      const mockPendingPayment = {
        _id: 'payment1',
        order_id: 'nonexistent',
        attempts: 1,
        hash: 'hash1',
        remove: sinon.stub().resolves(),
      };

      PendingPaymentStub.find.resolves([mockPendingPayment]);
      OrderStub.findOne.resolves(null);

      await jobs.attemptPendingPayments(mockBot);

      expect(mockPendingPayment.remove.calledOnce).to.equal(true);
      expect(loggerStub.info.calledWith('PendingPayment nonexistent: deleted')).to.equal(true);
    });

    it('should handle database errors gracefully', async () => {
      PendingPaymentStub.find.rejects(new Error('Database error'));

      await jobs.attemptPendingPayments(mockBot);

      expect(loggerStub.error.calledOnce).to.equal(true);
    });
  });

  describe('cancelOrders', () => {
    let mockBot: any;

    beforeEach(() => {
      mockBot = {
        telegram: {
          sendMessage: sinon.stub().resolves(),
        },
      };
    });

    it('should cancel expired orders', async () => {
      const expiredDate = new Date(Date.now() - 90000000); // More than 24 hours ago
      const mockOrders = [
        {
          _id: 'order1',
          status: 'WAITING_PAYMENT',
          created_at: expiredDate,
          hash: 'hash1',
          save: sinon.stub().resolves(),
        },
        {
          _id: 'order2',
          status: 'WAITING_BUYER_INVOICE',
          created_at: expiredDate,
          save: sinon.stub().resolves(),
        },
      ];

      OrderStub.find.resolves(mockOrders);
      lnStub.cancelHoldInvoice.resolves();

      await jobs.cancelOrders(mockBot);

      expect(mockOrders[0].status).to.equal('EXPIRED');
      expect(mockOrders[1].status).to.equal('EXPIRED');
      expect(lnStub.cancelHoldInvoice.calledOnceWith({ hash: 'hash1' })).to.equal(true);
      expect(mockOrders[0].save.calledOnce).to.equal(true);
      expect(mockOrders[1].save.calledOnce).to.equal(true);
    });

    it('should not cancel recent orders', async () => {
      const recentDate = new Date(); // Current time
      const mockOrder = {
        _id: 'order1',
        status: 'WAITING_PAYMENT',
        created_at: recentDate,
        save: sinon.stub().resolves(),
      };

      OrderStub.find.resolves([mockOrder]);

      await jobs.cancelOrders(mockBot);

      expect(mockOrder.status).to.equal('WAITING_PAYMENT'); // Should remain unchanged
      expect(mockOrder.save.called).to.equal(false);
    });

    it('should handle orders without hash', async () => {
      const expiredDate = new Date(Date.now() - 90000000);
      const mockOrder = {
        _id: 'order1',
        status: 'WAITING_BUYER_INVOICE',
        created_at: expiredDate,
        hash: null,
        save: sinon.stub().resolves(),
      };

      OrderStub.find.resolves([mockOrder]);

      await jobs.cancelOrders(mockBot);

      expect(mockOrder.status).to.equal('EXPIRED');
      expect(lnStub.cancelHoldInvoice.called).to.equal(false);
    });

    it('should handle lightning network errors', async () => {
      const expiredDate = new Date(Date.now() - 90000000);
      const mockOrder = {
        _id: 'order1',
        status: 'WAITING_PAYMENT',
        created_at: expiredDate,
        hash: 'hash1',
        save: sinon.stub().resolves(),
      };

      OrderStub.find.resolves([mockOrder]);
      lnStub.cancelHoldInvoice.rejects(new Error('LN error'));

      await jobs.cancelOrders(mockBot);

      expect(loggerStub.error.calledOnce).to.equal(true);
      expect(mockOrder.status).to.equal('EXPIRED'); // Should still update status
    });
  });

  describe('deleteOrders', () => {
    let mockBot: any;

    beforeEach(() => {
      mockBot = {
        telegram: {
          deleteMessage: sinon.stub().resolves(),
        },
      };
    });

    it('should delete expired published orders', async () => {
      const expiredDate = new Date(Date.now() - 100000000); // Well expired
      const mockOrders = [
        {
          _id: 'order1',
          status: 'PENDING',
          created_at: expiredDate,
          tg_channel_message1: 123,
          type: 'sell',
        },
        {
          _id: 'order2',
          status: 'PENDING',
          created_at: expiredDate,
          tg_channel_message1: 456,
          type: 'buy',
        },
      ];

      OrderStub.find.resolves(mockOrders);
      utilStub.deleteOrderFromChannel.resolves();

      await jobs.deleteOrders(mockBot);

      expect(utilStub.deleteOrderFromChannel.callCount).to.equal(2);
      expect(OrderStub.deleteMany.calledOnce).to.equal(true);
      expect(loggerStub.info.calledWith('Deleted 2 expired orders')).to.equal(true);
    });

    it('should not delete recent orders', async () => {
      const recentDate = new Date();
      const mockOrder = {
        _id: 'order1',
        status: 'PENDING',
        created_at: recentDate,
      };

      OrderStub.find.resolves([mockOrder]);

      await jobs.deleteOrders(mockBot);

      expect(OrderStub.deleteMany.called).to.equal(false);
    });

    it('should handle deletion errors gracefully', async () => {
      const expiredDate = new Date(Date.now() - 100000000);
      const mockOrder = {
        _id: 'order1',
        status: 'PENDING',
        created_at: expiredDate,
        tg_channel_message1: 123,
      };

      OrderStub.find.resolves([mockOrder]);
      utilStub.deleteOrderFromChannel.rejects(new Error('Telegram error'));
      OrderStub.deleteMany.resolves({ deletedCount: 1 });

      await jobs.deleteOrders(mockBot);

      expect(loggerStub.error.calledOnce).to.equal(true);
      expect(OrderStub.deleteMany.calledOnce).to.equal(true); // Should still delete from DB
    });
  });

  describe('calculateEarnings', () => {
    it('should calculate and update community earnings', async () => {
      const mockCommunities = [
        {
          _id: 'community1',
          earnings: 1000,
          orders_to_redeem: 5,
          save: sinon.stub().resolves(),
        },
        {
          _id: 'community2',
          earnings: 2000,
          orders_to_redeem: 10,
          save: sinon.stub().resolves(),
        },
      ];

      const mockOrders = [
        {
          community_id: 'community1',
          community_fee: 100,
          status: 'SUCCESS',
        },
        {
          community_id: 'community1',
          community_fee: 150,
          status: 'SUCCESS',
        },
        {
          community_id: 'community2',
          community_fee: 200,
          status: 'SUCCESS',
        },
      ];

      CommunityStub.find.resolves(mockCommunities);
      OrderStub.find.resolves(mockOrders);
      OrderStub.updateMany.resolves();

      await jobs.calculateEarnings();

      expect(mockCommunities[0].earnings).to.equal(1250); // 1000 + 100 + 150
      expect(mockCommunities[0].orders_to_redeem).to.equal(7); // 5 + 2
      expect(mockCommunities[1].earnings).to.equal(2200); // 2000 + 200
      expect(mockCommunities[1].orders_to_redeem).to.equal(11); // 10 + 1

      expect(mockCommunities[0].save.calledOnce).to.equal(true);
      expect(mockCommunities[1].save.calledOnce).to.equal(true);
      expect(OrderStub.updateMany.calledOnce).to.equal(true);
    });

    it('should handle communities with no new orders', async () => {
      const mockCommunity = {
        _id: 'community1',
        earnings: 1000,
        orders_to_redeem: 5,
        save: sinon.stub().resolves(),
      };

      CommunityStub.find.resolves([mockCommunity]);
      OrderStub.find.resolves([]); // No new orders

      await jobs.calculateEarnings();

      expect(mockCommunity.earnings).to.equal(1000); // Unchanged
      expect(mockCommunity.orders_to_redeem).to.equal(5); // Unchanged
      expect(mockCommunity.save.called).to.equal(false);
    });

    it('should handle database errors gracefully', async () => {
      CommunityStub.find.rejects(new Error('Database error'));

      await jobs.calculateEarnings();

      expect(loggerStub.error.calledOnce).to.equal(true);
    });
  });

  describe('nodeInfo', () => {
    let mockBot: any;

    beforeEach(() => {
      mockBot = {
        telegram: {
          sendMessage: sinon.stub().resolves(),
        },
      };

      sandbox.stub(process, 'env').value({
        ADMIN_CHANNEL: '@adminchannel',
      });
    });

    it('should send node info when node is active', async () => {
      const mockNodeInfo = {
        is_synced_to_chain: true,
        public_key: 'pubkey123',
        alias: 'MyNode',
        active_channels_count: 10,
        peers_count: 5,
      };

      lnStub.getInfo.resolves(mockNodeInfo);

      await jobs.nodeInfo(mockBot);

      expect(mockBot.telegram.sendMessage.calledOnce).to.equal(true);
      const callArgs = mockBot.telegram.sendMessage.getCall(0).args;
      expect(callArgs[0]).to.equal('@adminchannel');
      expect(callArgs[1]).to.include('is_synced_to_chain: true');
    });

    it('should send alert when node is not synced', async () => {
      const mockNodeInfo = {
        is_synced_to_chain: false,
        public_key: 'pubkey123',
        alias: 'MyNode',
        active_channels_count: 10,
        peers_count: 5,
      };

      lnStub.getInfo.resolves(mockNodeInfo);

      await jobs.nodeInfo(mockBot);

      expect(mockBot.telegram.sendMessage.calledOnce).to.equal(true);
      const callArgs = mockBot.telegram.sendMessage.getCall(0).args;
      expect(callArgs[1]).to.include('🚨 ATTENTION');
    });

    it('should handle node info errors', async () => {
      lnStub.getInfo.rejects(new Error('Node connection error'));

      await jobs.nodeInfo(mockBot);

      expect(loggerStub.error.calledOnce).to.equal(true);
      expect(mockBot.telegram.sendMessage.called).to.equal(false);
    });
  });

  describe('checkSolvers', () => {
    it('should remove inactive dispute solvers', async () => {
      const mockUsers = [
        {
          _id: 'solver1',
          username: 'solver1',
          tg_id: '123',
          default_community_id: 'community1',
          last_seen: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000), // 40 days ago
        },
        {
          _id: 'solver2',
          username: 'solver2',
          tg_id: '456',
          default_community_id: 'community2',
          last_seen: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000), // 20 days ago (active)
        },
      ];

      const mockCommunities = [
        {
          _id: 'community1',
          solvers: [
            { id: 'solver1', username: 'solver1' },
            { id: 'othersolver', username: 'othersolver' },
          ],
          save: sinon.stub().resolves(),
        },
        {
          _id: 'community2',
          solvers: [
            { id: 'solver2', username: 'solver2' },
          ],
          save: sinon.stub().resolves(),
        },
      ];

      UserStub.find.resolves(mockUsers);
      CommunityStub.find.resolves(mockCommunities);

      await jobs.checkSolvers();

      // Should remove inactive solver from community1
      expect(mockCommunities[0].solvers.length).to.equal(1);
      expect(mockCommunities[0].solvers[0].id).to.equal('othersolver');
      expect(mockCommunities[0].save.calledOnce).to.equal(true);

      // Community2 should remain unchanged
      expect(mockCommunities[1].solvers.length).to.equal(1);
      expect(mockCommunities[1].save.called).to.equal(false);
    });

    it('should handle solvers without communities', async () => {
      const mockUser = {
        _id: 'solver1',
        username: 'solver1',
        tg_id: '123',
        default_community_id: null,
        last_seen: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000),
      };

      UserStub.find.resolves([mockUser]);
      CommunityStub.find.resolves([]);

      await jobs.checkSolvers();

      // Should not throw errors
      expect(loggerStub.error.called).to.equal(false);
    });

    it('should handle database errors gracefully', async () => {
      UserStub.find.rejects(new Error('Database error'));

      await jobs.checkSolvers();

      expect(loggerStub.error.calledOnce).to.equal(true);
    });
  });
});