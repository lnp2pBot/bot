import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import {
  createOrder,
  updateOrder,
  deleteOrder,
  getOrder,
  getOrdersByUser,
  validateOrderData,
  calculateOrderTotal,
  processOrderPayment,
  cancelOrder,
  fulfillOrder,
  getOrderHistory,
  applyOrderDiscount,
  updateOrderStatus,
  OrderStatus,
  OrderType,
  PaymentMethod
} from './ordersActions';

// Mock external dependencies
jest.mock('../utils/database', () => ({
  query: jest.fn(),
  transaction: jest.fn(),
}));

jest.mock('../utils/paymentProcessor', () => ({
  processPayment: jest.fn(),
  refundPayment: jest.fn(),
}));

jest.mock('../utils/logger', () => ({
  log: jest.fn(),
  error: jest.fn(),
}));

describe('ordersActions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('createOrder', () => {
    const validOrderData = {
      userId: 'user123',
      items: [
        { productId: 'prod1', quantity: 2, price: 25.99 },
        { productId: 'prod2', quantity: 1, price: 15.50 }
      ],
      shippingAddress: {
        street: '123 Main St',
        city: 'Anytown',
        state: 'ST',
        zipCode: '12345'
      },
      paymentMethod: PaymentMethod.CREDIT_CARD,
      paymentToken: 'token123'
    };

    it('should create a new order with valid data', async () => {
      const mockCreatedOrder = { id: 'order123', ...validOrderData, status: OrderStatus.PENDING };
      
      const mockQuery = require('../utils/database').query;
      mockQuery.mockResolvedValue({ rows: [mockCreatedOrder] });

      const result = await createOrder(validOrderData);

      expect(result).toEqual(mockCreatedOrder);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO orders'),
        expect.any(Array)
      );
    });

    it('should throw error when required fields are missing', async () => {
      const invalidOrderData = { ...validOrderData };
      delete invalidOrderData.userId;

      await expect(createOrder(invalidOrderData)).rejects.toThrow('User ID is required');
    });

    it('should throw error when items array is empty', async () => {
      const invalidOrderData = { ...validOrderData, items: [] };

      await expect(createOrder(invalidOrderData)).rejects.toThrow('Order must contain at least one item');
    });

    it('should throw error when shipping address is invalid', async () => {
      const invalidOrderData = { 
        ...validOrderData, 
        shippingAddress: { street: '', city: '', state: '', zipCode: '' }
      };

      await expect(createOrder(invalidOrderData)).rejects.toThrow('Invalid shipping address');
    });

    it('should handle database errors gracefully', async () => {
      const mockQuery = require('../utils/database').query;
      mockQuery.mockRejectedValue(new Error('Database connection failed'));

      await expect(createOrder(validOrderData)).rejects.toThrow('Failed to create order');
    });

    it('should calculate total correctly for multiple items', async () => {
      const mockCreatedOrder = { id: 'order123', ...validOrderData, total: 67.48, status: OrderStatus.PENDING };
      
      const mockQuery = require('../utils/database').query;
      mockQuery.mockResolvedValue({ rows: [mockCreatedOrder] });

      const result = await createOrder(validOrderData);

      expect(result.total).toBe(67.48); // (25.99 * 2) + 15.50
    });
  });

  describe('updateOrder', () => {
    const updateData = {
      items: [{ productId: 'prod1', quantity: 3, price: 25.99 }],
      shippingAddress: {
        street: '456 Oak Ave',
        city: 'Newtown',
        state: 'NT',
        zipCode: '54321'
      }
    };

    it('should update existing order successfully', async () => {
      const mockUpdatedOrder = { id: 'order123', ...updateData, status: OrderStatus.PENDING };
      
      const mockQuery = require('../utils/database').query;
      mockQuery.mockResolvedValue({ rows: [mockUpdatedOrder] });

      const result = await updateOrder('order123', updateData);

      expect(result).toEqual(mockUpdatedOrder);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE orders'),
        expect.any(Array)
      );
    });

    it('should throw error when order not found', async () => {
      const mockQuery = require('../utils/database').query;
      mockQuery.mockResolvedValue({ rows: [] });

      await expect(updateOrder('nonexistent', updateData)).rejects.toThrow('Order not found');
    });

    it('should not allow updating completed orders', async () => {
      const mockQuery = require('../utils/database').query;
      mockQuery.mockResolvedValue({ 
        rows: [{ id: 'order123', status: OrderStatus.COMPLETED }] 
      });

      await expect(updateOrder('order123', updateData)).rejects.toThrow('Cannot update completed order');
    });

    it('should validate update data before processing', async () => {
      const invalidUpdateData = { items: [] };

      await expect(updateOrder('order123', invalidUpdateData)).rejects.toThrow('Invalid update data');
    });
  });

  describe('deleteOrder', () => {
    it('should delete order successfully', async () => {
      const mockQuery = require('../utils/database').query;
      mockQuery.mockResolvedValue({ rows: [{ id: 'order123' }] });

      const result = await deleteOrder('order123');

      expect(result).toBe(true);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM orders'),
        ['order123']
      );
    });

    it('should return false when order not found', async () => {
      const mockQuery = require('../utils/database').query;
      mockQuery.mockResolvedValue({ rows: [] });

      const result = await deleteOrder('nonexistent');

      expect(result).toBe(false);
    });

    it('should not allow deleting completed orders', async () => {
      const mockQuery = require('../utils/database').query;
      mockQuery.mockResolvedValueOnce({ 
        rows: [{ id: 'order123', status: OrderStatus.COMPLETED }] 
      });

      await expect(deleteOrder('order123')).rejects.toThrow('Cannot delete completed order');
    });
  });

  describe('getOrder', () => {
    it('should retrieve order by ID successfully', async () => {
      const mockOrder = {
        id: 'order123',
        userId: 'user123',
        status: OrderStatus.PENDING,
        total: 67.48
      };
      
      const mockQuery = require('../utils/database').query;
      mockQuery.mockResolvedValue({ rows: [mockOrder] });

      const result = await getOrder('order123');

      expect(result).toEqual(mockOrder);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM orders WHERE id = $1'),
        ['order123']
      );
    });

    it('should return null when order not found', async () => {
      const mockQuery = require('../utils/database').query;
      mockQuery.mockResolvedValue({ rows: [] });

      const result = await getOrder('nonexistent');

      expect(result).toBeNull();
    });

    it('should handle database errors', async () => {
      const mockQuery = require('../utils/database').query;
      mockQuery.mockRejectedValue(new Error('Database error'));

      await expect(getOrder('order123')).rejects.toThrow('Failed to retrieve order');
    });
  });

  describe('getOrdersByUser', () => {
    it('should retrieve all orders for a user', async () => {
      const mockOrders = [
        { id: 'order1', userId: 'user123', status: OrderStatus.PENDING },
        { id: 'order2', userId: 'user123', status: OrderStatus.COMPLETED }
      ];
      
      const mockQuery = require('../utils/database').query;
      mockQuery.mockResolvedValue({ rows: mockOrders });

      const result = await getOrdersByUser('user123');

      expect(result).toEqual(mockOrders);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM orders WHERE user_id = $1'),
        ['user123']
      );
    });

    it('should return empty array when user has no orders', async () => {
      const mockQuery = require('../utils/database').query;
      mockQuery.mockResolvedValue({ rows: [] });

      const result = await getOrdersByUser('user123');

      expect(result).toEqual([]);
    });

    it('should support pagination', async () => {
      const mockOrders = [
        { id: 'order1', userId: 'user123', status: OrderStatus.PENDING }
      ];
      
      const mockQuery = require('../utils/database').query;
      mockQuery.mockResolvedValue({ rows: mockOrders });

      const result = await getOrdersByUser('user123', { limit: 10, offset: 0 });

      expect(result).toEqual(mockOrders);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('LIMIT $2 OFFSET $3'),
        ['user123', 10, 0]
      );
    });

    it('should filter by status when provided', async () => {
      const mockOrders = [
        { id: 'order1', userId: 'user123', status: OrderStatus.PENDING }
      ];
      
      const mockQuery = require('../utils/database').query;
      mockQuery.mockResolvedValue({ rows: mockOrders });

      const result = await getOrdersByUser('user123', { status: OrderStatus.PENDING });

      expect(result).toEqual(mockOrders);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('AND status = $2'),
        ['user123', OrderStatus.PENDING]
      );
    });
  });

  describe('validateOrderData', () => {
    const validOrderData = {
      userId: 'user123',
      items: [{ productId: 'prod1', quantity: 2, price: 25.99 }],
      shippingAddress: {
        street: '123 Main St',
        city: 'Anytown',
        state: 'ST',
        zipCode: '12345'
      }
    };

    it('should validate correct order data', () => {
      expect(() => validateOrderData(validOrderData)).not.toThrow();
    });

    it('should throw error for missing userId', () => {
      const invalidData = { ...validOrderData };
      delete invalidData.userId;

      expect(() => validateOrderData(invalidData)).toThrow('User ID is required');
    });

    it('should throw error for empty items array', () => {
      const invalidData = { ...validOrderData, items: [] };

      expect(() => validateOrderData(invalidData)).toThrow('Order must contain at least one item');
    });

    it('should throw error for invalid item data', () => {
      const invalidData = {
        ...validOrderData,
        items: [{ productId: '', quantity: 0, price: -1 }]
      };

      expect(() => validateOrderData(invalidData)).toThrow('Invalid item data');
    });

    it('should throw error for missing shipping address', () => {
      const invalidData = { ...validOrderData };
      delete invalidData.shippingAddress;

      expect(() => validateOrderData(invalidData)).toThrow('Shipping address is required');
    });

    it('should throw error for incomplete shipping address', () => {
      const invalidData = {
        ...validOrderData,
        shippingAddress: { street: '', city: 'Anytown', state: 'ST', zipCode: '12345' }
      };

      expect(() => validateOrderData(invalidData)).toThrow('Invalid shipping address');
    });

    it('should validate item quantities are positive', () => {
      const invalidData = {
        ...validOrderData,
        items: [{ productId: 'prod1', quantity: -1, price: 25.99 }]
      };

      expect(() => validateOrderData(invalidData)).toThrow('Item quantity must be positive');
    });

    it('should validate item prices are non-negative', () => {
      const invalidData = {
        ...validOrderData,
        items: [{ productId: 'prod1', quantity: 2, price: -25.99 }]
      };

      expect(() => validateOrderData(invalidData)).toThrow('Item price cannot be negative');
    });
  });

  describe('calculateOrderTotal', () => {
    it('should calculate total for single item', () => {
      const items = [{ productId: 'prod1', quantity: 2, price: 25.99 }];
      const result = calculateOrderTotal(items);

      expect(result).toBe(51.98);
    });

    it('should calculate total for multiple items', () => {
      const items = [
        { productId: 'prod1', quantity: 2, price: 25.99 },
        { productId: 'prod2', quantity: 1, price: 15.50 },
        { productId: 'prod3', quantity: 3, price: 10.00 }
      ];
      const result = calculateOrderTotal(items);

      expect(result).toBe(97.48); // (25.99 * 2) + 15.50 + (10.00 * 3)
    });

    it('should handle zero quantity items', () => {
      const items = [
        { productId: 'prod1', quantity: 0, price: 25.99 },
        { productId: 'prod2', quantity: 2, price: 15.50 }
      ];
      const result = calculateOrderTotal(items);

      expect(result).toBe(31.00);
    });

    it('should handle empty items array', () => {
      const items = [];
      const result = calculateOrderTotal(items);

      expect(result).toBe(0);
    });

    it('should round to 2 decimal places', () => {
      const items = [{ productId: 'prod1', quantity: 3, price: 10.333 }];
      const result = calculateOrderTotal(items);

      expect(result).toBe(30.999); // Should be properly rounded
    });

    it('should apply tax when provided', () => {
      const items = [{ productId: 'prod1', quantity: 2, price: 25.00 }];
      const result = calculateOrderTotal(items, 0.08); // 8% tax

      expect(result).toBe(54.00); // 50.00 + 4.00 tax
    });

    it('should apply discount when provided', () => {
      const items = [{ productId: 'prod1', quantity: 2, price: 25.00 }];
      const result = calculateOrderTotal(items, 0, 10.00); // $10 discount

      expect(result).toBe(40.00);
    });
  });

  describe('processOrderPayment', () => {
    const paymentData = {
      orderId: 'order123',
      paymentMethod: PaymentMethod.CREDIT_CARD,
      paymentToken: 'token123',
      amount: 67.48
    };

    it('should process payment successfully', async () => {
      const mockProcessPayment = require('../utils/paymentProcessor').processPayment;
      mockProcessPayment.mockResolvedValue({
        success: true,
        transactionId: 'txn123',
        status: 'completed'
      });

      const result = await processOrderPayment(paymentData);

      expect(result.success).toBe(true);
      expect(result.transactionId).toBe('txn123');
      expect(mockProcessPayment).toHaveBeenCalledWith(paymentData);
    });

    it('should handle payment failures', async () => {
      const mockProcessPayment = require('../utils/paymentProcessor').processPayment;
      mockProcessPayment.mockResolvedValue({
        success: false,
        error: 'Insufficient funds',
        status: 'failed'
      });

      const result = await processOrderPayment(paymentData);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Insufficient funds');
    });

    it('should handle payment processor errors', async () => {
      const mockProcessPayment = require('../utils/paymentProcessor').processPayment;
      mockProcessPayment.mockRejectedValue(new Error('Payment service unavailable'));

      await expect(processOrderPayment(paymentData)).rejects.toThrow('Payment processing failed');
    });

    it('should validate payment amount', async () => {
      const invalidPaymentData = { ...paymentData, amount: -10 };

      await expect(processOrderPayment(invalidPaymentData)).rejects.toThrow('Invalid payment amount');
    });

    it('should validate payment method', async () => {
      const invalidPaymentData = { ...paymentData, paymentMethod: 'INVALID' };

      await expect(processOrderPayment(invalidPaymentData)).rejects.toThrow('Invalid payment method');
    });
  });

  describe('cancelOrder', () => {
    it('should cancel order successfully', async () => {
      const mockQuery = require('../utils/database').query;
      mockQuery.mockResolvedValueOnce({ 
        rows: [{ id: 'order123', status: OrderStatus.PENDING }] 
      });
      mockQuery.mockResolvedValueOnce({ 
        rows: [{ id: 'order123', status: OrderStatus.CANCELLED }] 
      });

      const result = await cancelOrder('order123');

      expect(result.status).toBe(OrderStatus.CANCELLED);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE orders SET status = $1'),
        [OrderStatus.CANCELLED, 'order123']
      );
    });

    it('should not cancel already completed orders', async () => {
      const mockQuery = require('../utils/database').query;
      mockQuery.mockResolvedValue({ 
        rows: [{ id: 'order123', status: OrderStatus.COMPLETED }] 
      });

      await expect(cancelOrder('order123')).rejects.toThrow('Cannot cancel completed order');
    });

    it('should not cancel already cancelled orders', async () => {
      const mockQuery = require('../utils/database').query;
      mockQuery.mockResolvedValue({ 
        rows: [{ id: 'order123', status: OrderStatus.CANCELLED }] 
      });

      await expect(cancelOrder('order123')).rejects.toThrow('Order is already cancelled');
    });

    it('should handle refund when payment was processed', async () => {
      const mockQuery = require('../utils/database').query;
      mockQuery.mockResolvedValueOnce({ 
        rows: [{ 
          id: 'order123', 
          status: OrderStatus.PAID,
          paymentTransactionId: 'txn123'
        }] 
      });

      const mockRefundPayment = require('../utils/paymentProcessor').refundPayment;
      mockRefundPayment.mockResolvedValue({ success: true, refundId: 'refund123' });

      mockQuery.mockResolvedValueOnce({ 
        rows: [{ id: 'order123', status: OrderStatus.CANCELLED }] 
      });

      const result = await cancelOrder('order123');

      expect(result.status).toBe(OrderStatus.CANCELLED);
      expect(mockRefundPayment).toHaveBeenCalledWith('txn123');
    });
  });

  describe('fulfillOrder', () => {
    it('should fulfill order successfully', async () => {
      const mockQuery = require('../utils/database').query;
      mockQuery.mockResolvedValueOnce({ 
        rows: [{ id: 'order123', status: OrderStatus.PAID }] 
      });
      mockQuery.mockResolvedValueOnce({ 
        rows: [{ id: 'order123', status: OrderStatus.FULFILLED }] 
      });

      const result = await fulfillOrder('order123', 'tracking123');

      expect(result.status).toBe(OrderStatus.FULFILLED);
      expect(result.trackingNumber).toBe('tracking123');
    });

    it('should not fulfill unpaid orders', async () => {
      const mockQuery = require('../utils/database').query;
      mockQuery.mockResolvedValue({ 
        rows: [{ id: 'order123', status: OrderStatus.PENDING }] 
      });

      await expect(fulfillOrder('order123', 'tracking123')).rejects.toThrow('Cannot fulfill unpaid order');
    });

    it('should not fulfill cancelled orders', async () => {
      const mockQuery = require('../utils/database').query;
      mockQuery.mockResolvedValue({ 
        rows: [{ id: 'order123', status: OrderStatus.CANCELLED }] 
      });

      await expect(fulfillOrder('order123', 'tracking123')).rejects.toThrow('Cannot fulfill cancelled order');
    });

    it('should require tracking number', async () => {
      const mockQuery = require('../utils/database').query;
      mockQuery.mockResolvedValue({ 
        rows: [{ id: 'order123', status: OrderStatus.PAID }] 
      });

      await expect(fulfillOrder('order123', '')).rejects.toThrow('Tracking number is required');
    });
  });

  describe('getOrderHistory', () => {
    it('should retrieve order history with status changes', async () => {
      const mockHistory = [
        { orderId: 'order123', status: OrderStatus.PENDING, timestamp: '2023-01-01T00:00:00Z' },
        { orderId: 'order123', status: OrderStatus.PAID, timestamp: '2023-01-01T01:00:00Z' },
        { orderId: 'order123', status: OrderStatus.FULFILLED, timestamp: '2023-01-01T02:00:00Z' }
      ];
      
      const mockQuery = require('../utils/database').query;
      mockQuery.mockResolvedValue({ rows: mockHistory });

      const result = await getOrderHistory('order123');

      expect(result).toEqual(mockHistory);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM order_history WHERE order_id = $1'),
        ['order123']
      );
    });

    it('should return empty array for orders with no history', async () => {
      const mockQuery = require('../utils/database').query;
      mockQuery.mockResolvedValue({ rows: [] });

      const result = await getOrderHistory('order123');

      expect(result).toEqual([]);
    });
  });

  describe('applyOrderDiscount', () => {
    it('should apply percentage discount correctly', async () => {
      const mockOrder = {
        id: 'order123',
        subtotal: 100.00,
        discount: 0,
        total: 100.00
      };

      const mockQuery = require('../utils/database').query;
      mockQuery.mockResolvedValueOnce({ rows: [mockOrder] });
      mockQuery.mockResolvedValueOnce({ 
        rows: [{ ...mockOrder, discount: 10.00, total: 90.00 }] 
      });

      const result = await applyOrderDiscount('order123', { type: 'percentage', value: 10 });

      expect(result.discount).toBe(10.00);
      expect(result.total).toBe(90.00);
    });

    it('should apply fixed amount discount correctly', async () => {
      const mockOrder = {
        id: 'order123',
        subtotal: 100.00,
        discount: 0,
        total: 100.00
      };

      const mockQuery = require('../utils/database').query;
      mockQuery.mockResolvedValueOnce({ rows: [mockOrder] });
      mockQuery.mockResolvedValueOnce({ 
        rows: [{ ...mockOrder, discount: 15.00, total: 85.00 }] 
      });

      const result = await applyOrderDiscount('order123', { type: 'fixed', value: 15 });

      expect(result.discount).toBe(15.00);
      expect(result.total).toBe(85.00);
    });

    it('should not allow discount greater than order total', async () => {
      const mockOrder = {
        id: 'order123',
        subtotal: 50.00,
        discount: 0,
        total: 50.00
      };

      const mockQuery = require('../utils/database').query;
      mockQuery.mockResolvedValue({ rows: [mockOrder] });

      await expect(applyOrderDiscount('order123', { type: 'fixed', value: 60 }))
        .rejects.toThrow('Discount cannot exceed order total');
    });

    it('should not apply discount to completed orders', async () => {
      const mockOrder = {
        id: 'order123',
        status: OrderStatus.COMPLETED,
        subtotal: 100.00
      };

      const mockQuery = require('../utils/database').query;
      mockQuery.mockResolvedValue({ rows: [mockOrder] });

      await expect(applyOrderDiscount('order123', { type: 'percentage', value: 10 }))
        .rejects.toThrow('Cannot apply discount to completed order');
    });
  });

  describe('updateOrderStatus', () => {
    it('should update order status successfully', async () => {
      const mockQuery = require('../utils/database').query;
      mockQuery.mockResolvedValueOnce({ 
        rows: [{ id: 'order123', status: OrderStatus.PENDING }] 
      });
      mockQuery.mockResolvedValueOnce({ 
        rows: [{ id: 'order123', status: OrderStatus.PROCESSING }] 
      });

      const result = await updateOrderStatus('order123', OrderStatus.PROCESSING);

      expect(result.status).toBe(OrderStatus.PROCESSING);
    });

    it('should validate status transitions', async () => {
      const mockQuery = require('../utils/database').query;
      mockQuery.mockResolvedValue({ 
        rows: [{ id: 'order123', status: OrderStatus.COMPLETED }] 
      });

      await expect(updateOrderStatus('order123', OrderStatus.PENDING))
        .rejects.toThrow('Invalid status transition');
    });

    it('should log status changes', async () => {
      const mockQuery = require('../utils/database').query;
      mockQuery.mockResolvedValueOnce({ 
        rows: [{ id: 'order123', status: OrderStatus.PENDING }] 
      });
      mockQuery.mockResolvedValueOnce({ 
        rows: [{ id: 'order123', status: OrderStatus.PROCESSING }] 
      });

      const mockLogger = require('../utils/logger');

      await updateOrderStatus('order123', OrderStatus.PROCESSING);

      expect(mockLogger.log).toHaveBeenCalledWith(
        'Order status updated',
        { orderId: 'order123', from: OrderStatus.PENDING, to: OrderStatus.PROCESSING }
      );
    });
  });

  // Edge cases and error handling tests
  describe('Edge Cases and Error Handling', () => {
    it('should handle null/undefined inputs gracefully', async () => {
      await expect(createOrder(null)).rejects.toThrow();
      await expect(updateOrder(null, {})).rejects.toThrow();
      await expect(getOrder(null)).rejects.toThrow();
    });

    it('should handle extremely large order quantities', () => {
      const items = [{ productId: 'prod1', quantity: Number.MAX_SAFE_INTEGER, price: 0.01 }];
      
      expect(() => calculateOrderTotal(items)).not.toThrow();
    });

    it('should handle very small decimal prices', () => {
      const items = [{ productId: 'prod1', quantity: 1000, price: 0.001 }];
      const result = calculateOrderTotal(items);
      
      expect(result).toBe(1);
    });

    it('should handle concurrent order updates', async () => {
      const mockQuery = require('../utils/database').query;
      mockQuery.mockRejectedValue(new Error('Concurrent modification detected'));

      await expect(updateOrder('order123', { items: [] }))
        .rejects.toThrow('Failed to update order');
    });

    it('should handle database connection timeouts', async () => {
      const mockQuery = require('../utils/database').query;
      mockQuery.mockRejectedValue(new Error('Connection timeout'));

      await expect(getOrdersByUser('user123'))
        .rejects.toThrow('Database operation failed');
    });
  });

  // Performance and boundary tests
  describe('Performance and Boundary Tests', () => {
    it('should handle orders with maximum allowed items', async () => {
      const maxItems = Array(1000).fill(null).map((_, i) => ({
        productId: `prod${i}`,
        quantity: 1,
        price: 1.99
      }));

      const orderData = {
        userId: 'user123',
        items: maxItems,
        shippingAddress: {
          street: '123 Main St',
          city: 'Anytown',
          state: 'ST',
          zipCode: '12345'
        }
      };

      expect(() => validateOrderData(orderData)).not.toThrow();
    });

    it('should calculate totals efficiently for large orders', () => {
      const largeItemList = Array(10000).fill(null).map((_, i) => ({
        productId: `prod${i}`,
        quantity: Math.floor(Math.random() * 10) + 1,
        price: Math.random() * 100
      }));

      const startTime = Date.now();
      const result = calculateOrderTotal(largeItemList);
      const endTime = Date.now();

      expect(result).toBeGreaterThan(0);
      expect(endTime - startTime).toBeLessThan(100); // Should complete within 100ms
    });

    it('should handle orders with zero-priced items', () => {
      const items = [
        { productId: 'free-sample', quantity: 1, price: 0 },
        { productId: 'paid-item', quantity: 1, price: 29.99 }
      ];

      const result = calculateOrderTotal(items);
      expect(result).toBe(29.99);
    });
  });
});