const { ObjectId } = require('mongoose').Types;
const { Order } = require('../models');
const messages = require('./messages');
const { getCurrency } = require('../util');

const createOrder = async (ctx, bot, user, {
  type,
  amount,
  seller,
  buyer,
  fiatAmount,
  fiatCode,
  paymentMethod,
  status,
  priceMargin,
}) => {
  amount = parseInt(amount);
  const action = type == 'sell' ? 'Vendiendo' : 'Comprando';
  const trades = type == 'sell' ? seller.trades_completed : buyer.trades_completed;
  const volume = type == 'sell' ? seller.volume_traded : buyer.volume_traded;
  try {
    const username = user.show_username ? `@${user.username} está ` : ``;
    const volumeTraded = user.show_volume_traded ? `Volumen de comercio: ${volume} sats\n` : ``;
    const priceMarginText = !!priceMargin ? `Margen de precio: ${priceMargin}%\n` : ``;
    const currency = getCurrency(fiatCode);
    let currencyString = `${fiatCode} ${fiatAmount}`;
    if (!!currency) {
      currencyString = `${fiatAmount} ${currency.name_plural} ${currency.emoji}`;
    }
    let amountText = `${amount} `;
    let tasaText = '';
    let priceFromAPI = false;
    if (amount == 0) {
      priceFromAPI = true;
      if (!currency.price) {
        await messages.notRateForCurrency(bot, user);
        return;
      }
      amountText = '';
      tasaText = 'Tasa: yadio.io\n';
    }
    if (type === 'sell') {
      const fee = amount * parseFloat(process.env.FEE);
      let description = `${username}${action} ${amountText}sats\nPor ${currencyString}\n`;
      description += `Recibo pago por ${paymentMethod}\n`;
      description += `Tiene ${trades} operaciones exitosas\n`;
      description += volumeTraded;
      description += priceMarginText;
      description += tasaText;
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
        price_from_api: priceFromAPI,
        price_margin: priceMargin || 0,
      });
      await order.save();

      return order;
    } else {
      const fee = amount * parseFloat(process.env.FEE);
      let description = `${username}${action} ${amountText}sats\nPor ${currencyString}\n`;
      description += `Pago por ${paymentMethod}\n`;
      description += `Tiene ${trades} operaciones exitosas\n`;
      description += volumeTraded;
      description += priceMarginText;
      description += tasaText;
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
        price_from_api: priceFromAPI,
        price_margin: priceMargin || 0,
      });
      await order.save();

      return order;
    }
  } catch (e) {
    console.log(e);
  }
};

const getOrder = async (bot, user, orderId) => {
try {
  if (!ObjectId.isValid(orderId)) {
    await messages.notValidIdMessage(bot, user);
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
} catch (error) {
  console.log(error);
  return false;
}
};

const getOrders = async (bot, user) => {
  try {
    const where = {
      $and: [
        {
          $or: [
            { buyer_id: user._id },
            { seller_id: user._id },
          ],
        },
        {
          $or: [
            { status: 'WAITING_PAYMENT' },
            { status: 'WAITING_BUYER_INVOICE' },
            { status: 'PENDING' },
            { status: 'ACTIVE' },
            { status: 'FIAT_SENT' },
            { status: 'PAID_HOLD_INVOICE' },
          ],
        },
      ],
    };

    const orders = await Order.find(where);
    if (orders.length == 0) {
      await messages.notOrdersMessage(bot, user);
      return false;
    }

    return orders;
  } catch (error) {
    console.log(error)
  }
};

module.exports = {
  createOrder,
  getOrder,
  getOrders,
};
