const { User, Dispute, Order } = require('../../../models');
const {
  validateParams,
  validateObjectId,
  validateDisputeOrder,
} = require('../../validations');
const messages = require('./messages');
const globalMessages = require('../../messages');
const { logger } = require('../../../logger');
const OrderEvents = require('../../modules/events/orders');
const { removeAtSymbol } = require('../../../util');

const dispute = async ctx => {
  try {
    const { user } = ctx;

    const [orderId] = await validateParams(ctx, 2, '\\<_order id_\\>');

    if (!orderId) return;
    if (!(await validateObjectId(ctx, orderId))) return;
    const order = await validateDisputeOrder(ctx, user, orderId);

    if (!order) return;
    // Users can't initiate a dispute before this time
    const secsUntilDispute = parseInt(process.env.DISPUTE_START_WINDOW);
    const time = new Date();
    time.setSeconds(time.getSeconds() - secsUntilDispute);
    if (order.taken_at > time) {
      return await messages.disputeTooSoonMessage(ctx);
    }

    const buyer = await User.findOne({ _id: order.buyer_id });
    const seller = await User.findOne({ _id: order.seller_id });
    let initiator = 'seller';
    if (user._id == order.buyer_id) initiator = 'buyer';

    order[`${initiator}_dispute`] = true;
    order.previous_dispute_status = order.status
    order.status = 'DISPUTE';
    const sellerToken = Math.floor(Math.random() * 899 + 100);
    const buyerToken = Math.floor(Math.random() * 899 + 100);
    order.buyer_dispute_token = buyerToken;
    order.seller_dispute_token = sellerToken;
    await order.save();
    OrderEvents.orderUpdated(order);

    // If this is a non community order, we may ban the user globally
    if (order.community_id) {
      // We increment the number of disputes on both users
      // If a user disputes is equal to MAX_DISPUTES, we ban the user
      const buyerDisputes =
        (await Dispute.count({
          $or: [{ buyer_id: buyer._id }, { seller_id: buyer._id }],
        })) + 1;
      const sellerDisputes =
        (await Dispute.count({
          $or: [{ buyer_id: seller._id }, { seller_id: seller._id }],
        })) + 1;
      if (buyerDisputes >= process.env.MAX_DISPUTES) {
        buyer.banned = true;
        await buyer.save();
      }
      if (sellerDisputes >= process.env.MAX_DISPUTES) {
        seller.banned = true;
        await seller.save();
      }
    }

    const dispute = new Dispute({
      initiator,
      seller_id: seller._id,
      buyer_id: buyer._id,
      community_id: order.community_id,
      status: 'WAITING_FOR_SOLVER',
      order_id: order._id,
    });
    await dispute.save();
    // Send message to both users
    await messages.beginDispute(ctx, initiator, order, buyer, seller);
    // Show the dispute button to solvers
    await messages.takeDisputeButton(ctx, order);
    logger.warning(`Order ${order.id}: User ${user.id} started a dispute!`);
  } catch (error) {
    logger.error(error);
  }
};

const deleteDispute = async ctx => {
  try {
    const { admin } = ctx;

    let [username, orderId] = await validateParams(
      ctx,
      3,
      '\\<_username_\\> \\<_order id_\\>'
    );

    if (!username) return;
    if (!orderId) return;

    if (!(await validateObjectId(ctx, orderId))) return;
    const order = await Order.findOne({ _id: orderId });

    if (!order) {
      return await globalMessages.notActiveOrderMessage(ctx);
    }
    username = removeAtSymbol(username);
    const user = await User.findOne({ username });
    if (!user) {
      return await globalMessages.notFoundUserMessage(ctx);
    }
    const dispute = await Dispute.findOne({
      order_id: orderId,
    });
    if (!dispute) {
      return await messages.notFoundDisputeMessage(ctx);
    }
    // We check if this is a solver, the order must be from the same community
    if (!admin.admin) {
      if (!order.community_id) {
        return await globalMessages.notAuthorized(ctx);
      }

      if (order.community_id != admin.default_community_id) {
        return await globalMessages.notAuthorized(ctx);
      }

      // We check if this dispute is from a community we validate that
      // the solver is running this command
      if (dispute && dispute.solver_id != admin._id) {
        return await globalMessages.notAuthorized(ctx);
      }
    }

    if (user._id == dispute.buyer_id) dispute.buyer_id = null;
    if (user._id == dispute.seller_id) dispute.seller_id = null;
    await dispute.save();

    await ctx.reply(ctx.i18n.t('operation_successful'));
  } catch (error) {
    logger.error(error);
  }
};

module.exports = { dispute, deleteDispute };
