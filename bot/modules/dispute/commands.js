const { User } = require('../../../models');
const {
  validateUser,
  validateParams,
  validateObjectId,
  validateDisputeOrder,
} = require('../../validations');
const messages = require('./messages');
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
    const buyerDisputes = buyer.disputes + 1;
    const sellerDisputes = seller.disputes + 1;
    buyer.disputes = buyerDisputes;
    seller.disputes = sellerDisputes;
    if (buyerDisputes >= process.env.MAX_DISPUTES) {
      buyer.banned = true;
    }
    if (sellerDisputes >= process.env.MAX_DISPUTES) {
      seller.banned = true;
    }
    await buyer.save();
    await seller.save();
    // Send message to both users
    await messages.beginDispute(bot, initiator, order, buyer, seller, ctx.i18n);
    // Show the dispute button to solvers
    await messages.takeDisputeButton(ctx, bot, order);
  } catch (error) {
    logger.error(error);
  }
};

module.exports = { dispute };
