const { User, Order, Dispute } = require('../../../models');
const messages = require('./messages');
const { validateAdmin } = require('../../validations');
const globalMessages = require('../../messages');

exports.takeDispute = async ctx => {
  const tgId = ctx.update.callback_query.from.id;
  const admin = await validateAdmin(ctx, tgId);
  if (!admin) return;
  const orderId = ctx.match[1];
  // We check if this is a solver, the order must be from the same community
  const order = await Order.findOne({ _id: orderId });
  const dispute = await Dispute.findOne({ order_id: orderId });
  if (!admin.admin) {
    if (!order.community_id)
      return await globalMessages.notAuthorized(ctx, tgId);

    if (order.community_id != admin.default_community_id)
      return await globalMessages.notAuthorized(ctx, tgId);
  }
  ctx.deleteMessage();
  const solver = await User.findOne({ tg_id: tgId });
  if (dispute.status === 'RELEASED')
    return await messages.sellerReleased(ctx, solver);

  const buyer = await User.findOne({ _id: order.buyer_id });
  const seller = await User.findOne({ _id: order.seller_id });
  const initiator = order.buyer_dispute ? 'buyer' : 'seller';
  const buyerDisputes = await Dispute.count({
    $or: [{ buyer_id: buyer._id }, { seller_id: buyer._id }],
  });
  const sellerDisputes = await Dispute.count({
    $or: [{ buyer_id: seller._id }, { seller_id: seller._id }],
  });

  dispute.solver_id = solver.id;
  dispute.status = 'IN_PROGRESS';
  await dispute.save();
  await messages.disputeData(
    ctx,
    buyer,
    seller,
    order,
    initiator,
    solver,
    buyerDisputes,
    sellerDisputes
  );
};
