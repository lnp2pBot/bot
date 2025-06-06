import { expect } from 'chai';
import * as sinon from 'sinon';
import * as mongoose from 'mongoose';

// Import model schemas
import User from '../../models/user';
import Order from '../../models/order';
import Community from '../../models/community';
import Dispute from '../../models/dispute';
import PendingPayment from '../../models/pending_payment';
import Config from '../../models/config';

describe('Model Schemas and Methods', () => {
  let sandbox: any;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('User Model', () => {
    it('should have correct default values', () => {
      const userData = {
        tg_id: '123456',
        username: 'testuser',
      };

      const user = new User(userData);

      expect(user.lang).to.equal('en');
      expect(user.trades_completed).to.equal(0);
      expect(user.total_reviews).to.equal(0);
      expect(user.last_rating).to.equal(0);
      expect(user.total_rating).to.equal(0);
      expect(user.volume_traded).to.equal(0);
      expect(user.admin).to.equal(false);
      expect(user.banned).to.equal(false);
      expect(user.show_username).to.equal(false);
      expect(user.show_volume_traded).to.equal(false);
      expect(user.disputes).to.equal(0);
      expect(user.reviews).to.be.an('array').that.is.empty;
    });

    it('should enforce rating constraints', () => {
      const user = new User({
        tg_id: '123456',
        last_rating: 6, // Above max
        total_rating: -1, // Below min
      });

      const validationError = user.validateSync();
      
      expect(validationError).to.exist;
      expect(validationError.errors).to.have.property('last_rating');
      expect(validationError.errors).to.have.property('total_rating');
    });

    it('should enforce minimum values for numeric fields', () => {
      const user = new User({
        tg_id: '123456',
        trades_completed: -1,
        total_reviews: -1,
        volume_traded: -1,
        disputes: -1,
      });

      const validationError = user.validateSync();
      
      expect(validationError).to.exist;
      expect(validationError.errors).to.have.property('trades_completed');
      expect(validationError.errors).to.have.property('total_reviews');
      expect(validationError.errors).to.have.property('volume_traded');
      expect(validationError.errors).to.have.property('disputes');
    });

    it('should require unique tg_id', () => {
      const userSchema = User.schema;
      const tgIdPath = userSchema.paths.tg_id;
      
      expect(tgIdPath.options.unique).to.equal(true);
    });

    it('should validate review schema', () => {
      const user = new User({
        tg_id: '123456',
        reviews: [
          {
            rating: 4,
            reviewed_at: new Date(),
          },
          {
            rating: 6, // Invalid rating
          },
        ],
      });

      const validationError = user.validateSync();
      
      expect(validationError).to.exist;
      expect(validationError.errors).to.have.property('reviews.1.rating');
    });
  });

  describe('Order Model', () => {
    it('should have correct default values', () => {
      const orderData = {
        description: 'Test order',
        amount: 100000,
        fiat_amount: 1000,
        fiat_code: 'USD',
        payment_method: 'Bank Transfer',
        type: 'sell',
        status: 'PENDING',
        creator_id: new mongoose.Types.ObjectId(),
      };

      const order = new Order(orderData);

      expect(order.buyer_dispute).to.equal(false);
      expect(order.seller_dispute).to.equal(false);
      expect(order.buyer_cooperativecancel).to.equal(false);
      expect(order.seller_cooperativecancel).to.equal(false);
      expect(order.is_frozen).to.equal(false);
      expect(order.is_golden_honey_badger).to.equal(false);
      expect(order.price_margin).to.equal(0);
      expect(order.routing_fee).to.equal(0);
    });

    it('should enforce required fields', () => {
      const order = new Order({
        // Missing required fields
      });

      const validationError = order.validateSync();
      
      expect(validationError).to.exist;
      expect(validationError.errors).to.have.property('description');
      expect(validationError.errors).to.have.property('payment_method');
    });

    it('should validate status enum', () => {
      const order = new Order({
        description: 'Test order',
        amount: 100000,
        fiat_amount: 1000,
        fiat_code: 'USD',
        payment_method: 'Bank Transfer',
        type: 'sell',
        status: 'INVALID_STATUS',
        creator_id: new mongoose.Types.ObjectId(),
      });

      const validationError = order.validateSync();
      
      expect(validationError).to.exist;
      expect(validationError.errors).to.have.property('status');
    });

    it('should validate status enum', () => {
      const order = new Order({
        amount: 100000,
        fiat_amount: [1000],
        fiat_code: 'USD',
        payment_method: 'Bank Transfer',
        type: 'sell',
        status: 'INVALID_STATUS',
        creator_id: new mongoose.Types.ObjectId(),
      });

      const validationError = order.validateSync();
      
      expect(validationError).to.exist;
      expect(validationError.errors).to.have.property('status');
    });

    it('should enforce minimum values', () => {
      const order = new Order({
        description: 'Test order',
        amount: -1,
        fiat_amount: 0, // Must be min 1
        fiat_code: 'USD',
        payment_method: 'Bank Transfer',
        type: 'sell',
        status: 'PENDING',
        creator_id: new mongoose.Types.ObjectId(),
        fee: -1,
      });

      const validationError = order.validateSync();
      
      expect(validationError).to.exist;
      expect(validationError.errors).to.have.property('amount');
      expect(validationError.errors).to.have.property('fee');
      expect(validationError.errors).to.have.property('fiat_amount');
    });
  });

  describe('Community Model', () => {
    it('should have correct default values', () => {
      const communityData = {
        name: 'Test Community',
        creator_id: new mongoose.Types.ObjectId(),
        currencies: ['USD', 'EUR'],
      };

      const community = new Community(communityData);

      expect(community.public).to.equal(true);
      expect(community.fee).to.equal(0);
      expect(community.earnings).to.equal(0);
      expect(community.orders_to_redeem).to.equal(0);
      expect(community.solvers).to.be.an('array').that.is.empty;
      expect(community.banned_users).to.be.an('array').that.is.empty;
      expect(community.order_channels).to.be.an('array').that.is.empty;
    });

    it('should enforce required fields', () => {
      const community = new Community({
        // Missing required fields
      });

      const validationError = community.validateSync();
      
      expect(validationError).to.exist;
      expect(validationError.errors).to.have.property('name');
      expect(validationError.errors).to.have.property('currencies');
    });

    it('should enforce fee constraints', () => {
      const community = new Community({
        name: 'Test Community',
        creator_id: new mongoose.Types.ObjectId(),
        currencies: ['USD'],
        fee: -1, // Below minimum
      });

      const validationError = community.validateSync();
      
      expect(validationError).to.exist;
      expect(validationError.errors).to.have.property('fee');
    });

    it('should validate with negative earnings (no min constraint)', () => {
      const community = new Community({
        name: 'Test Community',
        creator_id: new mongoose.Types.ObjectId(),
        currencies: ['USD'],
        earnings: -1,
        orders_to_redeem: -1,
      });

      const validationError = community.validateSync();
      
      // If there are validation errors, they shouldn't be about earnings/orders_to_redeem
      if (validationError) {
        expect(validationError.errors).to.not.have.property('earnings');
        expect(validationError.errors).to.not.have.property('orders_to_redeem');
      }
    });

    it('should validate order channel schema', () => {
      const community = new Community({
        name: 'Test Community',
        creator_id: new mongoose.Types.ObjectId(),
        currencies: ['USD'],
        order_channels: [
          {
            name: '@channel1',
            type: 'sell',
          },
          {
            name: '@channel2',
            type: 'invalid_type', // Invalid type
          },
        ],
      });

      const validationError = community.validateSync();
      
      expect(validationError).to.exist;
      expect(validationError.errors).to.have.property('order_channels.1.type');
    });
  });

  describe('Dispute Model', () => {
    it('should have correct default values', () => {
      const disputeData = {
        initiator: 'buyer',
        order_id: new mongoose.Types.ObjectId().toString(),
        buyer_id: new mongoose.Types.ObjectId().toString(),
        seller_id: new mongoose.Types.ObjectId().toString(),
      };

      const dispute = new Dispute(disputeData);

      expect(dispute.community_id).to.equal(null);
      expect(dispute.solver_id).to.equal(null);
    });

    it('should enforce required fields', () => {
      const dispute = new Dispute({
        // Missing required fields
      });

      const validationError = dispute.validateSync();
      
      expect(validationError).to.exist;
      expect(validationError.errors).to.have.property('initiator');
    });

    it('should validate status enum', () => {
      const dispute = new Dispute({
        initiator: 'buyer',
        order_id: new mongoose.Types.ObjectId().toString(),
        buyer_id: new mongoose.Types.ObjectId().toString(),
        seller_id: new mongoose.Types.ObjectId().toString(),
        status: 'INVALID_STATUS',
      });

      const validationError = dispute.validateSync();
      
      expect(validationError).to.exist;
      expect(validationError.errors).to.have.property('status');
    });
  });

  describe('PendingPayment Model', () => {
    it('should have correct default values', () => {
      const pendingPaymentData = {
        order_id: new mongoose.Types.ObjectId().toString(),
        hash: 'payment_hash_123',
        payment_request: 'lnbc123...',
      };

      const pendingPayment = new PendingPayment(pendingPaymentData);

      expect(pendingPayment.attempts).to.equal(0);
    });

    it('should not have required fields (all optional)', () => {
      const pendingPayment = new PendingPayment({
        // No required fields in this model
      });

      const validationError = pendingPayment.validateSync();
      
      // No validation errors expected since all fields are optional
      expect(validationError).to.not.exist;
    });

    it('should enforce minimum attempts', () => {
      const pendingPayment = new PendingPayment({
        order_id: new mongoose.Types.ObjectId().toString(),
        hash: 'payment_hash_123',
        payment_request: 'lnbc123...',
        attempts: -1,
      });

      const validationError = pendingPayment.validateSync();
      
      expect(validationError).to.exist;
      expect(validationError.errors).to.have.property('attempts');
    });
  });

  describe('Config Model', () => {
    it('should have correct default values', () => {
      const config = new Config({});

      expect(config.maintenance).to.equal(false);
    });

    it('should allow setting maintenance mode', () => {
      const config = new Config({
        maintenance: true,
      });

      expect(config.maintenance).to.equal(true);
      
      const validationError = config.validateSync();
      expect(validationError).to.not.exist;
    });
  });
});