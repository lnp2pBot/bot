const { User, Dispute } = require('../../../models');
const {
  validateUser,
  validateParams,
  validateObjectId,
  validateDisputeOrder,
  validateAdmin,
} = require('../../validations');
const messages = require('./messages');
const globalMessages = require('../../messages');
const logger = require('../../../logger');

const dispute = async (ctx, bot) => {
  try {
    const user = await validateUser(ctx, false);

    if (!user) return;

    const [orderId] = await validateParams(ctx, 2, '\\<_order id_\\>');

    if (!orderId) return;
    if (!(await validateObjectId(ctx, orderId))) return;
    const order = await validateDisputeOrder(ctx, user, orderId);

    if (!order) return;

    const buyer = await User.findOne({ _id: order.buyer_id });
    const seller = await User.findOne({ _id: order.seller_id });
    let initiator = 'seller';
    if (user._id == order.buyer_id) initiator = 'buyer';

    order[`${initiator}_dispute`] = true;
    order.status = 'DISPUTE';
    await order.save();
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
      // TODO: This also needs to be migrated to communities
      buyer.banned = true;
    }
    if (sellerDisputes >= process.env.MAX_DISPUTES) {
      // TODO: This also needs to be migrated to communities
      seller.banned = true;
    }
    await buyer.save();
    await seller.save();
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
    await messages.beginDispute(bot, initiator, order, buyer, seller, ctx.i18n);
    // Show the dispute button to solvers
    await messages.takeDisputeButton(ctx, bot, order);
  } catch (error) {
    logger.error(error);
  }
};

const deleteDispute = async (ctx, bot) => {
  try {
    const admin = await validateAdmin(ctx);

    if (!admin) return;

    let [username] = await validateParams(ctx, 2, '\\<_username_\\>');

    if (!username) return;

    username = username[0] == '@' ? username.slice(1) : username;
    const user = await User.findOne({ username });
    user.disputes = user.disputes - 1;
    await user.save();
    await globalMessages.operationSuccessfulMessage(ctx);
  } catch (error) {
    logger.error(error);
  }
};

module.exports = { dispute, deleteDispute };
