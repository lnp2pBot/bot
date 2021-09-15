const { ObjectId } = require('mongoose').Types;
const { Order } = require('../models');
const messages = require('./messages');
const { getCurrency } = require('../util');

const createOrder = async (ctx, { type, amount, seller, buyer, fiatAmount, fiatCode, paymentMethod, status }) => {
  amount = parseInt(amount);
  const action = type == 'sell' ? 'Vendiendo' : 'Comprando';
  const trades = type == 'sell' ? seller.trades_completed : buyer.trades_completed;
  try {
    const currency = getCurrency(fiatCode);
    let currencyString = `${fiatCode} ${fiatAmount}`;
    if (!!currency) {
      currencyString = `${fiatAmount} ${currency.name_plural} ${currency.emoji}`;
    }
    if (type === 'sell') {
      const description = `${action} ${amount} sats\nPor ${currencyString}\nPago por ${paymentMethod}\nTiene ${trades} operaciones exitosas`;
      const fee = amount * parseFloat(process.env.FEE);
      const order = new Order({
        description,
        amount,
        fee,
        creator_id: seller._id,
        seller_id: seller._id,
        type,
        status,
        fiat_amount: fiatAmount,
        fiat_code: fiatCode,
        payment_method: paymentMethod,
        tg_chat_id: ctx.message.chat.id,
        tg_order_message: ctx.message.message_id,
      });
      await order.save();

      return order;
    } else {
      const description = `${action} ${amount} sats\nPor ${currencyString}\nRecibo pago por ${paymentMethod}\nTiene ${trades} operaciones exitosas`;
      const fee = amount * parseFloat(process.env.FEE);
      const order = new Order({
        description,
        amount,
        fee,
        creator_id: buyer._id,
        buyer_id: buyer._id,
        type,
        fiat_amount: fiatAmount,
        fiat_code: fiatCode,
        payment_method: paymentMethod,
        status,
        tg_chat_id: ctx.message.chat.id,
        tg_order_message: ctx.message.message_id,
      });
      await order.save();

      return order;
    }
  } catch (e) {
    console.log(e);
  }
};

const getOrder = async (bot, user, orderId) => {
  if (!ObjectId.isValid(orderId)) {
    await messages.customMessage(bot, user, 'Order Id no válido!');
    return false;
  }

  const where = {
    _id: orderId,
    $or: [{ seller_id: user._id }, { buyer_id: user._id }],
  };

  const order = await Order.findOne(where);
  if (!order) {
    await messages.notOrderMessage(bot, user);
    return false;
  }

  return order;
};

module.exports = {
  createOrder,
  getOrder,
};
