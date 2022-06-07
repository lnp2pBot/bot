const { User, Order, Dispute } = require('../../../models');
const messages = require('./messages');

const takeDispute = async ctx => {
  ctx.deleteMessage();
  const tgId = ctx.update.callback_query.from.id;
  const orderId = ctx.match[1];
  const order = await Order.findOne({ _id: orderId });
  const solver = await User.findOne({ tg_id: tgId });
  const buyer = await User.findOne({ _id: order.buyer_id });
  const seller = await User.findOne({ _id: order.seller_id });
  const initiator = order.buyer_dispute ? 'buyer' : 'seller';
  const buyerDisputes = await Dispute.count({
    $or: [{ buyer_id: buyer._id }, { seller_id: buyer._id }],
  });
  const sellerDisputes = await Dispute.count({
    $or: [{ buyer_id: seller._id }, { seller_id: seller._id }],
  });
  await Dispute.findOneAndUpdate(
    { order_id: order._id },
    { solver_id: solver._id, status: 'IN_PROGRESS' }
  );
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

module.exports = { takeDispute };
