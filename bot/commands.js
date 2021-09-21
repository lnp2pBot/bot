const {
    validateUser,
    validateTakeBuyOrder,
    validateSeller,
    validateParams,
    validateObjectId,
} = require('./validations');
const { Order, User } = require('../models');
const { createHoldInvoice, subscribeInvoice } = require('../ln');
const messages = require('./messages');

const takebuy = async (ctx, bot, { orderId, tgUser }) => {
    try {
        if (!tgUser) {
            tgUser = ctx.update.message.from;
        }
        let user = await User.findOne({ tg_id: tgUser.id });
      
        if (!user) {
            user = await validateUser(ctx, false);
        }
  
        if (!user) return;
  
        // Sellers with orders in status = FIAT_SENT, have to solve the order
        const isOnFiatSentStatus = await validateSeller(bot, user);
  
        if (!isOnFiatSentStatus) return;
        if (!orderId) {
            [orderId] = await validateParams(ctx, bot, user, 2, '<order_id>');
        }
  
        if (!orderId) return;
        if (!(await validateObjectId(bot, user, orderId))) return;
        const order = await Order.findOne({ _id: orderId });
        if (!(await validateTakeBuyOrder(bot, user, order))) return;
  
        const description = `Venta por @${ctx.botInfo.username}`;
        const amount = Math.floor(order.amount + order.fee);
        const { request, hash, secret } = await createHoldInvoice({
          description,
          amount,
        });
        order.hash = hash;
        order.secret = secret;
        order.status = 'WAITING_PAYMENT';
        order.seller_id = user._id;
        order.taken_at = Date.now();
        await order.save();
  
        // We monitor the invoice to know when the seller makes the payment
        await subscribeInvoice(bot, hash);
  
        await messages.beginTakeBuyMessage(bot, user, request, order);
      } catch (error) {
        console.log(error);
        await messages.invalidDataMessage(bot, user);
      }
};

module.exports = { takebuy };