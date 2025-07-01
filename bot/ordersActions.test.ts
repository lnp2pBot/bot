const sinon = require('sinon');
const { expect } = require('chai');
const {
  createOrder,
  updateOrderStatus,
  cancelOrder,
  getOrderById,
  getUserOrders,
  validateOrderData,
  calculateOrderTotal,
  processPayment,
  sendOrderConfirmation,
  handleOrderError,
  getOrdersByStatus,
  updateOrderItems,
  processRefund,
  validateOrderPermissions
} = require('./ordersActions');

// Mock dependencies
const database = require('../database/connection');
const paymentService = require('../services/paymentService');
const emailService = require('../services/emailService');
const logger = require('../utils/logger');
const validator = require('../utils/validator');

describe('ordersActions', () => {
  let sandbox: any;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('createOrder', () => {
    const validOrderData = {
      userId: 'user_12345',
      items: [
        { productId: 'prod_001', quantity: 2, price: 15.99, name: 'Test Product 1' },
        { productId: 'prod_002', quantity: 1, price: 29.50, name: 'Test Product 2' }
      ],
      shippingAddress: {
        street: '123 Main Street',
        city: 'Anytown',
        state: 'CA',
        zipCode: '12345',
        country: 'US'
      },
      billingAddress: {
        street: '123 Main Street',
        city: 'Anytown',
        state: 'CA',
        zipCode: '12345',
        country: 'US'
      },
      paymentMethod: 'credit_card',
      paymentToken: 'tok_test_123456'
    };

    it('should create a new order successfully with valid data', async () => {
      const mockOrderId = 'order_67890';
      const expectedOrder = { 
        id: mockOrderId, 
        ...validOrderData, 
        status: 'pending',
        total: 61.48,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      sandbox.stub(database, 'insertOrder').resolves(expectedOrder);
      sandbox.stub(paymentService, 'processPayment').resolves({ 
        success: true, 
        transactionId: 'txn_789',
        amount: 61.48
      });
      sandbox.stub(emailService, 'sendOrderConfirmation').resolves(true);
      sandbox.stub(validator, 'validateOrderData').returns({ valid: true });

      const result = await createOrder(validOrderData);

      expect(result).to.deep.equal(expectedOrder);
      expect(database.insertOrder).to.have.been.calledWith(sinon.match(validOrderData));
      expect(paymentService.processPayment).to.have.been.calledWith(
        validOrderData.paymentToken, 
        61.48
      );
      expect(emailService.sendOrderConfirmation).to.have.been.calledWith(
        validOrderData.userId, 
        mockOrderId
      );
    });

    it('should throw ValidationError when order data is invalid', async () => {
      const invalidOrderData = { ...validOrderData, userId: '' };
      
      sandbox.stub(validator, 'validateOrderData').returns({ 
        valid: false, 
        errors: ['userId is required'] 
      });

      try {
        await createOrder(invalidOrderData);
        expect.fail('Should have thrown ValidationError');
      } catch (error: any) {
        expect(error.name).to.equal('ValidationError');
        expect(error.message).to.include('userId is required');
      }
    });

    it('should throw ValidationError when items array is empty', async () => {
      const emptyItemsOrderData = { ...validOrderData, items: [] };
      
      sandbox.stub(validator, 'validateOrderData').returns({
        valid: false,
        errors: ['At least one item is required']
      });

      try {
        await createOrder(emptyItemsOrderData);
        expect.fail('Should have thrown ValidationError');
      } catch (error: any) {
        expect(error.name).to.equal('ValidationError');
        expect(error.message).to.include('At least one item is required');
      }
    });

    it('should handle payment processing failure and update order status', async () => {
      const mockOrder = { id: 'order_123', ...validOrderData, status: 'pending' };
      
      sandbox.stub(database, 'insertOrder').resolves(mockOrder);
      sandbox.stub(paymentService, 'processPayment').rejects(new Error('Payment declined'));
      sandbox.stub(database, 'updateOrderStatus').resolves({ ...mockOrder, status: 'payment_failed' });
      sandbox.stub(validator, 'validateOrderData').returns({ valid: true });
      sandbox.stub(logger, 'error');

      try {
        await createOrder(validOrderData);
        expect.fail('Should have thrown payment error');
      } catch (error: any) {
        expect(error.message).to.equal('Payment declined');
        expect(database.updateOrderStatus).to.have.been.calledWith('order_123', 'payment_failed');
        expect(logger.error).to.have.been.called;
      }
    });

    it('should handle database insertion failure', async () => {
      sandbox.stub(validator, 'validateOrderData').returns({ valid: true });
      sandbox.stub(database, 'insertOrder').rejects(new Error('Database connection failed'));
      sandbox.stub(logger, 'error');

      try {
        await createOrder(validOrderData);
        expect.fail('Should have thrown database error');
      } catch (error: any) {
        expect(error.message).to.equal('Database connection failed');
        expect(logger.error).to.have.been.calledWith('Failed to create order', sinon.match.instanceOf(Error));
      }
    });

    it('should calculate correct total for multiple items with tax', async () => {
      const multiItemOrderData = {
        ...validOrderData,
        items: [
          { productId: 'prod_001', quantity: 3, price: 15.99, name: 'Product 1' },
          { productId: 'prod_002', quantity: 2, price: 8.50, name: 'Product 2' },
          { productId: 'prod_003', quantity: 1, price: 100.00, name: 'Product 3' }
        ],
        taxRate: 0.08,
        shippingCost: 9.99
      };

      const expectedSubtotal = (3 * 15.99) + (2 * 8.50) + (1 * 100.00); // 164.97
      const expectedTax = expectedSubtotal * 0.08; // 13.20
      const expectedTotal = expectedSubtotal + expectedTax + 9.99; // 188.16

      sandbox.stub(validator, 'validateOrderData').returns({ valid: true });
      sandbox.stub(database, 'insertOrder').resolves({ 
        id: 'order_123', 
        ...multiItemOrderData, 
        total: expectedTotal 
      });
      sandbox.stub(paymentService, 'processPayment').resolves({ success: true });
      sandbox.stub(emailService, 'sendOrderConfirmation').resolves(true);

      await createOrder(multiItemOrderData);

      expect(paymentService.processPayment).to.have.been.calledWith(
        multiItemOrderData.paymentToken,
        expectedTotal
      );
    });

    it('should handle missing shipping address', async () => {
      const noShippingOrderData = { ...validOrderData };
      delete (noShippingOrderData as any).shippingAddress;
      
      sandbox.stub(validator, 'validateOrderData').returns({
        valid: false,
        errors: ['Shipping address is required']
      });

      try {
        await createOrder(noShippingOrderData);
        expect.fail('Should have thrown ValidationError');
      } catch (error: any) {
        expect(error.name).to.equal('ValidationError');
        expect(error.message).to.include('Shipping address is required');
      }
    });

    it('should handle invalid payment method', async () => {
      const invalidPaymentOrderData = { ...validOrderData, paymentMethod: 'invalid_method' };
      
      sandbox.stub(validator, 'validateOrderData').returns({
        valid: false,
        errors: ['Invalid payment method']
      });

      try {
        await createOrder(invalidPaymentOrderData);
        expect.fail('Should have thrown ValidationError');
      } catch (error: any) {
        expect(error.name).to.equal('ValidationError');
        expect(error.message).to.include('Invalid payment method');
      }
    });

    it('should handle items with zero or negative quantities', async () => {
      const invalidQuantityOrderData = {
        ...validOrderData,
        items: [
          { productId: 'prod_001', quantity: 0, price: 15.99, name: 'Product 1' },
          { productId: 'prod_002', quantity: -1, price: 8.50, name: 'Product 2' }
        ]
      };
      
      sandbox.stub(validator, 'validateOrderData').returns({
        valid: false,
        errors: ['All items must have positive quantities']
      });

      try {
        await createOrder(invalidQuantityOrderData);
        expect.fail('Should have thrown ValidationError');
      } catch (error: any) {
        expect(error.name).to.equal('ValidationError');
        expect(error.message).to.include('All items must have positive quantities');
      }
    });
  });

  describe('updateOrderStatus', () => {
    it('should update order status successfully', async () => {
      const orderId = 'order_123';
      const newStatus = 'shipped';
      const updatedOrder = { 
        id: orderId, 
        status: newStatus, 
        updatedAt: new Date(),
        statusHistory: [
          { status: 'pending', timestamp: new Date() },
          { status: 'confirmed', timestamp: new Date() },
          { status: 'shipped', timestamp: new Date() }
        ]
      };

      sandbox.stub(database, 'updateOrderStatus').resolves(updatedOrder);
      sandbox.stub(database, 'getOrderById').resolves({ id: orderId, status: 'confirmed' });

      const result = await updateOrderStatus(orderId, newStatus);

      expect(result).to.deep.equal(updatedOrder);
      expect(database.updateOrderStatus).to.have.been.calledWith(orderId, newStatus);
    });

    it('should throw error for invalid order ID', async () => {
      try {
        await updateOrderStatus('', 'shipped');
        expect.fail('Should have thrown error for empty order ID');
      } catch (error: any) {
        expect(error.message).to.include('Order ID is required');
      }
    });

    it('should throw error for invalid status', async () => {
      try {
        await updateOrderStatus('order_123', 'invalid_status');
        expect.fail('Should have thrown error for invalid status');
      } catch (error: any) {
        expect(error.message).to.include('Invalid order status');
      }
    });

    it('should handle database update failure', async () => {
      sandbox.stub(database, 'getOrderById').resolves({ id: 'order_123', status: 'pending' });
      sandbox.stub(database, 'updateOrderStatus').rejects(new Error('Order not found'));

      try {
        await updateOrderStatus('nonexistent_order', 'shipped');
        expect.fail('Should have thrown database error');
      } catch (error: any) {
        expect(error.message).to.equal('Order not found');
      }
    });

    it('should validate all possible status transitions', async () => {
      const validStatuses = ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'];
      const orderId = 'order_123';

      for (const status of validStatuses) {
        sandbox.stub(database, 'getOrderById').resolves({ id: orderId, status: 'pending' });
        sandbox.stub(database, 'updateOrderStatus').resolves({ id: orderId, status });
        
        const result = await updateOrderStatus(orderId, status);
        expect(result.status).to.equal(status);
        
        sandbox.restore();
        sandbox = sinon.createSandbox();
      }
    });

    it('should prevent invalid status transitions', async () => {
      const orderId = 'order_123';
      sandbox.stub(database, 'getOrderById').resolves({ id: orderId, status: 'delivered' });

      try {
        await updateOrderStatus(orderId, 'processing');
        expect.fail('Should have thrown error for invalid transition');
      } catch (error: any) {
        expect(error.message).to.include('Invalid status transition');
      }
    });
  });

  describe('cancelOrder', () => {
    it('should cancel order successfully when in cancellable state', async () => {
      const orderId = 'order_123';
      const originalOrder = { 
        id: orderId, 
        status: 'pending', 
        total: 100.00,
        paymentId: 'pay_123'
      };
      const cancelledOrder = { 
        ...originalOrder, 
        status: 'cancelled', 
        cancelledAt: new Date(),
        cancelReason: 'Customer request'
      };

      sandbox.stub(database, 'getOrderById').resolves(originalOrder);
      sandbox.stub(database, 'updateOrderStatus').resolves(cancelledOrder);
      sandbox.stub(paymentService, 'refundPayment').resolves({ 
        success: true, 
        refundId: 'ref_123' 
      });
      sandbox.stub(emailService, 'sendCancellationNotification').resolves(true);

      const result = await cancelOrder(orderId, 'Customer request');

      expect(result).to.deep.equal(cancelledOrder);
      expect(paymentService.refundPayment).to.have.been.calledWith('pay_123', 100.00);
      expect(emailService.sendCancellationNotification).to.have.been.calledWith(orderId);
    });

    it('should throw error when trying to cancel shipped order', async () => {
      const orderId = 'order_123';
      sandbox.stub(database, 'getOrderById').resolves({ 
        id: orderId, 
        status: 'shipped' 
      });

      try {
        await cancelOrder(orderId);
        expect.fail('Should have thrown error for shipped order');
      } catch (error: any) {
        expect(error.message).to.include('Cannot cancel order that has already been shipped');
      }
    });

    it('should throw error when trying to cancel already cancelled order', async () => {
      const orderId = 'order_123';
      sandbox.stub(database, 'getOrderById').resolves({ 
        id: orderId, 
        status: 'cancelled' 
      });

      try {
        await cancelOrder(orderId);
        expect.fail('Should have thrown error for already cancelled order');
      } catch (error: any) {
        expect(error.message).to.include('Order is already cancelled');
      }
    });

    it('should handle refund failure gracefully', async () => {
      const orderId = 'order_123';
      sandbox.stub(database, 'getOrderById').resolves({ 
        id: orderId, 
        status: 'confirmed',
        paymentId: 'pay_123',
        total: 100.00
      });
      sandbox.stub(paymentService, 'refundPayment').rejects(new Error('Refund failed'));
      sandbox.stub(logger, 'error');

      try {
        await cancelOrder(orderId);
        expect.fail('Should have thrown refund error');
      } catch (error: any) {
        expect(error.message).to.equal('Refund failed');
        expect(logger.error).to.have.been.calledWith(
          'Refund failed for order', 
          orderId, 
          sinon.match.instanceOf(Error)
        );
      }
    });

    it('should handle partial refunds for partially shipped orders', async () => {
      const orderId = 'order_123';
      const originalOrder = {
        id: orderId,
        status: 'partially_shipped',
        total: 100.00,
        shippedItems: [{ productId: 'prod_001', quantity: 1, price: 25.00 }],
        paymentId: 'pay_123'
      };

      sandbox.stub(database, 'getOrderById').resolves(originalOrder);
      sandbox.stub(database, 'updateOrderStatus').resolves({ 
        ...originalOrder, 
        status: 'partially_cancelled' 
      });
      sandbox.stub(paymentService, 'refundPayment').resolves({ 
        success: true, 
        refundAmount: 75.00 
      });

      const result = await cancelOrder(orderId);

      expect(paymentService.refundPayment).to.have.been.calledWith('pay_123', 75.00);
      expect(result.status).to.equal('partially_cancelled');
    });
  });

  describe('getOrderById', () => {
    it('should retrieve order by ID successfully', async () => {
      const orderId = 'order_123';
      const expectedOrder = { 
        id: orderId, 
        status: 'pending', 
        items: [
          { productId: 'prod_001', quantity: 2, price: 15.99 }
        ],
        total: 31.98,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      sandbox.stub(database, 'getOrderById').resolves(expectedOrder);

      const result = await getOrderById(orderId);

      expect(result).to.deep.equal(expectedOrder);
      expect(database.getOrderById).to.have.been.calledWith(orderId);
    });

    it('should throw error for invalid order ID', async () => {
      try {
        await getOrderById('');
        expect.fail('Should have thrown error for empty order ID');
      } catch (error: any) {
        expect(error.message).to.include('Order ID is required');
      }
    });

    it('should return null when order not found', async () => {
      sandbox.stub(database, 'getOrderById').resolves(null);

      const result = await getOrderById('nonexistent_order');

      expect(result).to.be.null;
    });

    it('should handle database connection error', async () => {
      sandbox.stub(database, 'getOrderById').rejects(new Error('Database connection failed'));

      try {
        await getOrderById('order_123');
        expect.fail('Should have thrown database error');
      } catch (error: any) {
        expect(error.message).to.equal('Database connection failed');
      }
    });

    it('should handle malformed order data from database', async () => {
      sandbox.stub(database, 'getOrderById').resolves({ 
        id: 'order_123', 
        // Missing required fields
        status: undefined,
        items: null
      });

      try {
        await getOrderById('order_123');
        expect.fail('Should have thrown validation error');
      } catch (error: any) {
        expect(error.message).to.include('Invalid order data');
      }
    });
  });

  describe('getUserOrders', () => {
    it('should retrieve all orders for a user', async () => {
      const userId = 'user_123';
      const expectedOrders = [
        { id: 'order_1', userId, status: 'delivered', total: 50.00 },
        { id: 'order_2', userId, status: 'pending', total: 25.99 }
      ];

      sandbox.stub(database, 'getOrdersByUserId').resolves(expectedOrders);

      const result = await getUserOrders(userId);

      expect(result).to.deep.equal(expectedOrders);
      expect(database.getOrdersByUserId).to.have.been.calledWith(userId, undefined);
    });

    it('should return empty array when user has no orders', async () => {
      const userId = 'user_123';
      sandbox.stub(database, 'getOrdersByUserId').resolves([]);

      const result = await getUserOrders(userId);

      expect(result).to.deep.equal([]);
    });

    it('should handle pagination parameters', async () => {
      const userId = 'user_123';
      const options = { 
        page: 2, 
        limit: 10, 
        sortBy: 'createdAt', 
        sortOrder: 'desc' 
      };

      sandbox.stub(database, 'getOrdersByUserId').resolves([]);

      await getUserOrders(userId, options);

      expect(database.getOrdersByUserId).to.have.been.calledWith(userId, options);
    });

    it('should throw error for invalid user ID', async () => {
      try {
        await getUserOrders('');
        expect.fail('Should have thrown error for empty user ID');
      } catch (error: any) {
        expect(error.message).to.include('User ID is required');
      }
    });

    it('should filter orders by status when specified', async () => {
      const userId = 'user_123';
      const statusFilter = 'pending';
      const filteredOrders = [
        { id: 'order_1', userId, status: 'pending', total: 25.99 }
      ];

      sandbox.stub(database, 'getOrdersByUserId').resolves(filteredOrders);

      const result = await getUserOrders(userId, { status: statusFilter });

      expect(result).to.deep.equal(filteredOrders);
      expect(database.getOrdersByUserId).to.have.been.calledWith(
        userId, 
        { status: statusFilter }
      );
    });

    it('should filter orders by date range', async () => {
      const userId = 'user_123';
      const dateRange = {
        startDate: new Date('2023-01-01'),
        endDate: new Date('2023-12-31')
      };

      sandbox.stub(database, 'getOrdersByUserId').resolves([]);

      await getUserOrders(userId, dateRange);

      expect(database.getOrdersByUserId).to.have.been.calledWith(userId, dateRange);
    });
  });

  describe('validateOrderData', () => {
    const validOrderData = {
      userId: 'user123',
      items: [{ productId: 'prod1', quantity: 1, price: 10.99, name: 'Test Product' }],
      shippingAddress: { 
        street: '123 Main St', 
        city: 'Anytown', 
        state: 'CA', 
        zipCode: '12345',
        country: 'US'
      },
      paymentMethod: 'credit_card',
      paymentToken: 'tok_123456'
    };

    it('should return valid result for complete order data', () => {
      const result = validateOrderData(validOrderData);
      expect(result.valid).to.be.true;
      expect(result.errors).to.be.empty;
    });

    it('should return invalid result for missing userId', () => {
      const invalidData = { ...validOrderData, userId: '' };
      const result = validateOrderData(invalidData);
      expect(result.valid).to.be.false;
      expect(result.errors).to.include('userId is required');
    });

    it('should return invalid result for empty items array', () => {
      const invalidData = { ...validOrderData, items: [] };
      const result = validateOrderData(invalidData);
      expect(result.valid).to.be.false;
      expect(result.errors).to.include('At least one item is required');
    });

    it('should return invalid result for items with invalid quantity', () => {
      const invalidData = {
        ...validOrderData,
        items: [{ productId: 'prod1', quantity: 0, price: 10.99, name: 'Test' }]
      };
      const result = validateOrderData(invalidData);
      expect(result.valid).to.be.false;
      expect(result.errors).to.include('All items must have positive quantities');
    });

    it('should return invalid result for items with invalid price', () => {
      const invalidData = {
        ...validOrderData,
        items: [{ productId: 'prod1', quantity: 1, price: -5.99, name: 'Test' }]
      };
      const result = validateOrderData(invalidData);
      expect(result.valid).to.be.false;
      expect(result.errors).to.include('All items must have valid prices');
    });

    it('should return invalid result for missing shipping address', () => {
      const invalidData = { ...validOrderData };
      delete (invalidData as any).shippingAddress;
      const result = validateOrderData(invalidData);
      expect(result.valid).to.be.false;
      expect(result.errors).to.include('Shipping address is required');
    });

    it('should validate postal code format', () => {
      const invalidZipData = {
        ...validOrderData,
        shippingAddress: { 
          ...validOrderData.shippingAddress, 
          zipCode: '123' 
        }
      };
      const result = validateOrderData(invalidZipData);
      expect(result.valid).to.be.false;
      expect(result.errors).to.include('Invalid postal code format');
    });

    it('should validate email format if provided', () => {
      const invalidEmailData = {
        ...validOrderData,
        customerEmail: 'invalid-email'
      };
      const result = validateOrderData(invalidEmailData);
      expect(result.valid).to.be.false;
      expect(result.errors).to.include('Invalid email format');
    });

    it('should validate phone number format if provided', () => {
      const invalidPhoneData = {
        ...validOrderData,
        customerPhone: '123'
      };
      const result = validateOrderData(invalidPhoneData);
      expect(result.valid).to.be.false;
      expect(result.errors).to.include('Invalid phone number format');
    });
  });

  describe('calculateOrderTotal', () => {
    it('should calculate total for single item', () => {
      const items = [{ productId: 'prod1', quantity: 2, price: 15.99, name: 'Test' }];
      const result = calculateOrderTotal(items);
      expect(result).to.equal(31.98);
    });

    it('should calculate total for multiple items', () => {
      const items = [
        { productId: 'prod1', quantity: 2, price: 15.99, name: 'Test 1' },
        { productId: 'prod2', quantity: 1, price: 25.50, name: 'Test 2' },
        { productId: 'prod3', quantity: 3, price: 8.33, name: 'Test 3' }
      ];
      const result = calculateOrderTotal(items);
      expect(result).to.equal(82.47);
    });

    it('should handle empty items array', () => {
      const result = calculateOrderTotal([]);
      expect(result).to.equal(0);
    });

    it('should handle decimal precision correctly', () => {
      const items = [{ productId: 'prod1', quantity: 3, price: 10.33, name: 'Test' }];
      const result = calculateOrderTotal(items);
      expect(result).to.equal(30.99);
    });

    it('should handle zero quantity items', () => {
      const items = [
        { productId: 'prod1', quantity: 0, price: 15.99, name: 'Test 1' },
        { productId: 'prod2', quantity: 2, price: 10.00, name: 'Test 2' }
      ];
      const result = calculateOrderTotal(items);
      expect(result).to.equal(20.00);
    });

    it('should apply tax when specified', () => {
      const items = [{ productId: 'prod1', quantity: 1, price: 100.00, name: 'Test' }];
      const taxRate = 0.08;
      const result = calculateOrderTotal(items, { taxRate });
      expect(result).to.equal(108.00);
    });

    it('should apply shipping cost when specified', () => {
      const items = [{ productId: 'prod1', quantity: 1, price: 100.00, name: 'Test' }];
      const shippingCost = 9.99;
      const result = calculateOrderTotal(items, { shippingCost });
      expect(result).to.equal(109.99);
    });

    it('should apply discount when specified', () => {
      const items = [{ productId: 'prod1', quantity: 1, price: 100.00, name: 'Test' }];
      const discount = 10.00;
      const result = calculateOrderTotal(items, { discount });
      expect(result).to.equal(90.00);
    });

    it('should apply all modifiers together', () => {
      const items = [{ productId: 'prod1', quantity: 1, price: 100.00, name: 'Test' }];
      const options = {
        taxRate: 0.08,
        shippingCost: 9.99,
        discount: 5.00
      };
      // (100 - 5) * 1.08 + 9.99 = 102.60 + 9.99 = 112.59
      const result = calculateOrderTotal(items, options);
      expect(result).to.equal(112.59);
    });
  });

  describe('processPayment', () => {
    it('should process payment successfully', async () => {
      const paymentData = { 
        token: 'tok_123', 
        amount: 100.00,
        currency: 'USD',
        orderId: 'order_123'
      };
      const expectedResponse = { 
        success: true, 
        transactionId: 'txn_123',
        amount: 100.00,
        currency: 'USD'
      };

      sandbox.stub(paymentService, 'processPayment').resolves(expectedResponse);

      const result = await processPayment(paymentData);

      expect(result).to.deep.equal(expectedResponse);
      expect(paymentService.processPayment).to.have.been.calledWith(
        paymentData.token, 
        paymentData.amount,
        paymentData.currency
      );
    });

    it('should handle payment service failure', async () => {
      const paymentData = { token: 'tok_123', amount: 100.00 };
      sandbox.stub(paymentService, 'processPayment').rejects(
        new Error('Payment service unavailable')
      );

      try {
        await processPayment(paymentData);
        expect.fail('Should have thrown payment service error');
      } catch (error: any) {
        expect(error.message).to.equal('Payment service unavailable');
      }
    });

    it('should validate payment amount', async () => {
      const invalidPaymentData = { token: 'tok_123', amount: -10.00 };

      try {
        await processPayment(invalidPaymentData);
        expect.fail('Should have thrown validation error');
      } catch (error: any) {
        expect(error.message).to.include('Invalid payment amount');
      }
    });

    it('should validate payment token', async () => {
      const invalidPaymentData = { token: '', amount: 100.00 };

      try {
        await processPayment(invalidPaymentData);
        expect.fail('Should have thrown validation error');
      } catch (error: any) {
        expect(error.message).to.include('Payment token is required');
      }
    });

    it('should handle different payment methods', async () => {
      const paymentMethods = ['credit_card', 'debit_card', 'paypal', 'apple_pay'];
      
      for (const method of paymentMethods) {
        const paymentData = {
          token: 'tok_123',
          amount: 100.00,
          paymentMethod: method
        };

        sandbox.stub(paymentService, 'processPayment').resolves({ success: true });
        
        const result = await processPayment(paymentData);
        expect(result.success).to.be.true;
        
        sandbox.restore();
        sandbox = sinon.createSandbox();
      }
    });

    it('should handle payment declined', async () => {
      const paymentData = { token: 'tok_123', amount: 100.00 };
      const declinedResponse = { 
        success: false, 
        error: 'Card declined',
        errorCode: 'CARD_DECLINED'
      };

      sandbox.stub(paymentService, 'processPayment').resolves(declinedResponse);

      const result = await processPayment(paymentData);

      expect(result.success).to.be.false;
      expect(result.error).to.equal('Card declined');
      expect(result.errorCode).to.equal('CARD_DECLINED');
    });
  });

  describe('getOrdersByStatus', () => {
    it('should retrieve orders by status successfully', async () => {
      const status = 'pending';
      const expectedOrders = [
        { id: 'order_1', status: 'pending', total: 50.00 },
        { id: 'order_2', status: 'pending', total: 75.99 }
      ];

      sandbox.stub(database, 'getOrdersByStatus').resolves(expectedOrders);

      const result = await getOrdersByStatus(status);

      expect(result).to.deep.equal(expectedOrders);
      expect(database.getOrdersByStatus).to.have.been.calledWith(status, undefined);
    });

    it('should handle pagination for status queries', async () => {
      const status = 'shipped';
      const options = { page: 1, limit: 50 };

      sandbox.stub(database, 'getOrdersByStatus').resolves([]);

      await getOrdersByStatus(status, options);

      expect(database.getOrdersByStatus).to.have.been.calledWith(status, options);
    });

    it('should throw error for invalid status', async () => {
      try {
        await getOrdersByStatus('invalid_status');
        expect.fail('Should have thrown error for invalid status');
      } catch (error: any) {
        expect(error.message).to.include('Invalid order status');
      }
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle concurrent order modifications', async () => {
      const orderId = 'order_123';
      sandbox.stub(database, 'updateOrderStatus').rejects(
        new Error('Concurrent modification detected')
      );

      try {
        await updateOrderStatus(orderId, 'shipped');
        expect.fail('Should have thrown concurrency error');
      } catch (error: any) {
        expect(error.message).to.equal('Concurrent modification detected');
      }
    });

    it('should handle network timeouts gracefully', async () => {
      const validOrderData = {
        userId: 'user123',
        items: [{ productId: 'prod1', quantity: 1, price: 10.99, name: 'Test' }],
        shippingAddress: { 
          street: '123 Main St', 
          city: 'Anytown', 
          state: 'CA', 
          zipCode: '12345' 
        }
      };

      sandbox.stub(validator, 'validateOrderData').returns({ valid: true });
      sandbox.stub(database, 'insertOrder').rejects(new Error('Network timeout'));
      sandbox.stub(logger, 'error');

      try {
        await createOrder(validOrderData);
        expect.fail('Should have thrown network timeout error');
      } catch (error: any) {
        expect(error.message).to.equal('Network timeout');
        expect(logger.error).to.have.been.calledWith(
          'Failed to create order', 
          sinon.match.instanceOf(Error)
        );
      }
    });

    it('should handle very large order totals', () => {
      const items = [{ 
        productId: 'expensive_item', 
        quantity: 1, 
        price: Number.MAX_SAFE_INTEGER,
        name: 'Expensive Item'
      }];
      const result = calculateOrderTotal(items);
      expect(result).to.equal(Number.MAX_SAFE_INTEGER);
    });

    it('should handle orders with many items', () => {
      const items = Array.from({ length: 1000 }, (_, i) => ({
        productId: `prod_${i}`,
        quantity: 1,
        price: 1.00,
        name: `Product ${i}`
      }));
      const result = calculateOrderTotal(items);
      expect(result).to.equal(1000.00);
    });

    it('should handle malformed item data', () => {
      const items = [
        { productId: 'prod1', quantity: 'invalid', price: 10.99, name: 'Test' },
        { productId: 'prod2', quantity: 1, price: 'invalid', name: 'Test 2' }
      ];

      try {
        calculateOrderTotal(items);
        expect.fail('Should have thrown validation error');
      } catch (error: any) {
        expect(error.message).to.include('Invalid item data');
      }
    });

    it('should handle database connection pool exhaustion', async () => {
      sandbox.stub(database, 'getOrderById').rejects(
        new Error('Connection pool exhausted')
      );

      try {
        await getOrderById('order_123');
        expect.fail('Should have thrown connection pool error');
      } catch (error: any) {
        expect(error.message).to.equal('Connection pool exhausted');
      }
    });
  });

  describe('Integration Scenarios', () => {
    it('should handle complete order lifecycle', async () => {
      const orderId = 'order_123';
      const userId = 'user_123';
      
      // Create order
      const orderData = {
        userId,
        items: [{ productId: 'prod1', quantity: 1, price: 50.00, name: 'Test Product' }],
        shippingAddress: { 
          street: '123 Main St', 
          city: 'Anytown', 
          state: 'CA', 
          zipCode: '12345' 
        },
        paymentMethod: 'credit_card',
        paymentToken: 'tok_123'
      };

      sandbox.stub(validator, 'validateOrderData').returns({ valid: true });
      sandbox.stub(database, 'insertOrder').resolves({ id: orderId, ...orderData, status: 'pending' });
      sandbox.stub(paymentService, 'processPayment').resolves({ success: true, transactionId: 'txn_123' });
      sandbox.stub(emailService, 'sendOrderConfirmation').resolves(true);

      // Update status through lifecycle
      const statusUpdates = ['confirmed', 'processing', 'shipped', 'delivered'];
      for (const status of statusUpdates) {
        sandbox.stub(database, 'getOrderById').resolves({ id: orderId, status: 'pending' });
        sandbox.stub(database, 'updateOrderStatus').resolves({ id: orderId, status });
      }

      const createdOrder = await createOrder(orderData);
      expect(createdOrder.id).to.equal(orderId);

      for (const status of statusUpdates) {
        const updatedOrder = await updateOrderStatus(orderId, status);
        expect(updatedOrder.status).to.equal(status);
      }
    });

    it('should handle order creation with inventory check failure', async () => {
      const orderData = {
        userId: 'user_123',
        items: [{ productId: 'out_of_stock', quantity: 5, price: 25.00, name: 'Unavailable Product' }],
        shippingAddress: { 
          street: '123 Main St', 
          city: 'Anytown', 
          state: 'CA', 
          zipCode: '12345' 
        }
      };

      sandbox.stub(validator, 'validateOrderData').returns({ valid: true });
      sandbox.stub(database, 'insertOrder').rejects(
        new Error('Insufficient inventory for product: out_of_stock')
      );
      sandbox.stub(logger, 'error');

      try {
        await createOrder(orderData);
        expect.fail('Should have thrown inventory error');
      } catch (error: any) {
        expect(error.message).to.include('Insufficient inventory');
      }
    });
  });
});