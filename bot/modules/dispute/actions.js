const { User, Order } = require('../../../models');
const messages = require('./messages');

const takeDispute = async (ctx, bot) => {
  ctx.deleteMessage();
  const tgId = ctx.update.callback_query.from.id;
  const orderId = ctx.match[1];
  const order = await Order.findOne({ _id: orderId });
  const solver = await User.findOne({ tg_id: tgId });
  const buyer = await User.findOne({ _id: order.buyer_id });
  const seller = await User.findOne({ _id: order.seller_id });
  const initiator = order.buyer_dispute ? 'buyer' : 'seller';
  await messages.disputeData(
    bot,
    buyer,
    seller,
    order,
    initiator,
    solver,
    ctx.i18n
  );
};

module.exports = { takeDispute };
