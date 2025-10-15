import { IOrder } from '../models/order';
import FinancialTransaction from '../models/financial_transaction';
import { logger } from '../logger';

/**
 * Calculate the bot fee earned from an order
 * @param order - Completed order
 * @returns Bot fee in satoshis
 */
export const calculateBotFeeEarned = (order: IOrder): number => {
  // If no community, bot receives 100% of the fee
  if (!order.community_id) {
    return order.fee;
  }

  // If Golden Honey Badger, bot receives nothing (0%)
  if (order.is_golden_honey_badger) {
    return 0;
  }

  // Bot receives: maxFee * FEE_PERCENT
  // maxFee = order.amount * order.bot_fee
  // botFeeEarned = maxFee * order.community_fee
  const maxFee = order.amount * order.bot_fee;
  const botFeeEarned = maxFee * order.community_fee;

  return Math.round(botFeeEarned);
};

/**
 * Calculate the fee allocated to the community
 * @param order - Completed order
 * @returns Community fee in satoshis
 */
export const calculateCommunityFeeAllocated = (order: IOrder): number => {
  // If no community, there's no community fee
  if (!order.community_id) {
    return 0;
  }

  const botFee = calculateBotFeeEarned(order);
  return order.fee - botFee;
};

/**
 * Record a financial transaction when an order is completed
 * @param order - Completed order with SUCCESS status
 */
export const recordFinancialTransaction = async (
  order: IOrder,
): Promise<void> => {
  try {
    // Verify the order is completed
    if (order.status !== 'SUCCESS') {
      logger.warning(
        `Attempted to record financial transaction for order ${order._id} with status ${order.status}`,
      );
      return;
    }

    // Check if a transaction already exists for this order
    const existingTransaction = await FinancialTransaction.findOne({
      order_id: order._id,
      transaction_type: 'order_completed',
    });

    if (existingTransaction) {
      logger.info(
        `Financial transaction already exists for order ${order._id}, skipping`,
      );
      return;
    }

    const botFeeEarned = calculateBotFeeEarned(order);
    const communityFeeAllocated = calculateCommunityFeeAllocated(order);
    const routingFeePaid = order.routing_fee || 0;
    const netProfit = botFeeEarned - routingFeePaid;

    const transaction = new FinancialTransaction({
      order_id: order._id,
      transaction_type: 'order_completed',
      timestamp: new Date(),

      // Fees collected
      total_fee: order.fee,
      bot_fee_earned: botFeeEarned,
      community_fee_allocated: communityFeeAllocated,
      community_id: order.community_id || null,

      // Operational costs
      routing_fee_paid: routingFeePaid,

      // Net balance
      net_profit: netProfit,

      // Metadata
      is_golden_honey_badger: order.is_golden_honey_badger || false,
      order_amount_sats: order.amount,
    });

    await transaction.save();

    logger.info(
      `Financial transaction recorded for order ${order._id}: bot_fee=${botFeeEarned} sats, community_fee=${communityFeeAllocated} sats, routing_fee=${routingFeePaid} sats, net_profit=${netProfit} sats`,
    );
  } catch (error) {
    logger.error(
      `Error recording financial transaction for order ${order._id}: ${error}`,
    );
  }
};

/**
 * Calculate financial statistics for a date range
 * @param startDate - Start date
 * @param endDate - End date
 * @returns Financial statistics
 */
export const calculateFinancialStats = async (
  startDate: Date,
  endDate: Date,
) => {
  try {
    const transactions = await FinancialTransaction.find({
      transaction_type: 'order_completed',
      timestamp: { $gte: startDate, $lte: endDate },
    });

    logger.info(
      `Found ${transactions.length} financial transactions between ${startDate.toISOString()} and ${endDate.toISOString()}`,
    );

    const stats = {
      totalOrders: transactions.length,
      totalFees: 0,
      botFeesEarned: 0,
      communityFeesAllocated: 0,
      routingFeesPaid: 0,
      netProfit: 0,
      ordersWithoutCommunity: 0,
      ordersWithCommunity: 0,
      goldenHoneyBadgerOrders: 0,
      averageFeePerOrder: 0,
      averageRoutingFee: 0,
      routingFeePercentage: 0,
      operationalEfficiency: 0,
    };

    transactions.forEach(tx => {
      stats.totalFees += tx.total_fee;
      stats.botFeesEarned += tx.bot_fee_earned;
      stats.communityFeesAllocated += tx.community_fee_allocated;
      stats.routingFeesPaid += tx.routing_fee_paid;
      stats.netProfit += tx.net_profit;

      if (!tx.community_id) {
        stats.ordersWithoutCommunity++;
      } else {
        stats.ordersWithCommunity++;
      }

      if (tx.is_golden_honey_badger) {
        stats.goldenHoneyBadgerOrders++;
      }
    });

    // Calculate averages and percentages
    if (stats.totalOrders > 0) {
      stats.averageFeePerOrder = Math.round(
        stats.totalFees / stats.totalOrders,
      );
      stats.averageRoutingFee = Math.round(
        stats.routingFeesPaid / stats.totalOrders,
      );
    }

    if (stats.totalFees > 0) {
      stats.routingFeePercentage =
        (stats.routingFeesPaid / stats.totalFees) * 100;
      stats.operationalEfficiency =
        ((stats.totalFees - stats.routingFeesPaid) / stats.totalFees) * 100;
    }

    return stats;
  } catch (error) {
    logger.error(`Error calculating financial stats: ${error}`);
    throw error;
  }
};

/**
 * Get fee breakdown by community
 * @param startDate - Start date
 * @param endDate - End date
 * @returns Array of fees per community
 */
export const getFeesByCommunity = async (startDate: Date, endDate: Date) => {
  try {
    const transactions = await FinancialTransaction.aggregate([
      {
        $match: {
          transaction_type: 'order_completed',
          timestamp: { $gte: startDate, $lte: endDate },
          community_id: { $ne: null },
        },
      },
      {
        $group: {
          _id: '$community_id',
          totalOrders: { $sum: 1 },
          communityFeesAllocated: { $sum: '$community_fee_allocated' },
          botFeesEarned: { $sum: '$bot_fee_earned' },
        },
      },
      {
        $sort: { communityFeesAllocated: -1 },
      },
    ]);

    return transactions;
  } catch (error) {
    logger.error(`Error getting fees by community: ${error}`);
    throw error;
  }
};
