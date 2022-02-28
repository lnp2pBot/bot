const { ObjectId } = require('mongoose').Types;
const { Order } = require('../models');
const messages = require('./messages');
const { getCurrency, getBtcExchangePrice, getEmojiRate, decimalRound } = require('../util');

const createOrder = async (ctx, bot, user, {
  type,
  amount,
  fiatAmount,
  fiatCode,
  paymentMethod,
  status,
  priceMargin,
  range_parent_id,
}) => {
  try {
    amount = parseInt(amount);
    const fee = amount * parseFloat(process.env.FEE);
    const currency = getCurrency(fiatCode);
    const priceFromAPI = !amount;

    if (priceFromAPI && !currency.price) {
      await messages.notRateForCurrency(bot, user);
      return;
    }

    const fiatAmountData = getFiatAmountData(fiatAmount);

    const baseOrderData = {
      ...fiatAmountData,
      amount,
      fee,
      creator_id: user._id,
      type,
      status,
      fiat_code: fiatCode,
      payment_method: paymentMethod,
      tg_chat_id: ctx.message.chat.id,
      tg_order_message: ctx.message.message_id,
      price_from_api: priceFromAPI,
      price_margin: priceMargin || 0,
      description: buildDescription({
        user,
        type,
        amount,
        fiatAmount,
        fiatCode,
        paymentMethod,
        priceMargin,
        priceFromAPI,
        currency
      }),
      range_parent_id,
    };

    let order;

    if (type === 'sell') {
      order = new Order({
        seller_id: user._id,
        ...baseOrderData,
      });
    } else {
      order = new Order({
        buyer_id: user._id,
        ...baseOrderData,
      });
    }
    await order.save();

    return order;
  } catch (e) {
    console.log(e);
  }
};

const getFiatAmountData = (fiatAmount) => {
  let response = {};
  if (fiatAmount.length == 2) {
    response.min_amount = fiatAmount[0];
    response.max_amount = fiatAmount[1];
  } else {
    response.fiat_amount = fiatAmount[0];
  }

  return response
};

const buildDescription = ({
  user,
  type,
  amount,
  fiatAmount,
  fiatCode,
  paymentMethod,
  priceMargin,
  priceFromAPI,
  currency,
}) => {
  try {
    const action = type == 'sell' ? 'Vendiendo' : 'Comprando';
    const hashtag = `#${type.toUpperCase()}${currency.code}\n`;
    const paymentAction = type == 'sell' ? 'Recibo pago' : 'Pago';
    const trades = user.trades_completed;
    const volume = user.volume_traded;
    const totalRating = user.total_rating;
    const totalReviews = user.reviews.length;
    const username = user.show_username ? `@${user.username} está ` : ``;
    const volumeTraded = user.show_volume_traded ? `Volumen de comercio: ${volume} sats\n` : ``;
    priceMargin = (!!priceMargin && priceMargin > 0) ? `+${priceMargin}` : priceMargin;
    const priceMarginText = !!priceMargin ? `${priceMargin}%\n` : ``;
    let fiatAmountString;
    
    if (fiatAmount.length == 2) { 
      fiatAmountString = `${fiatAmount[0]}-${fiatAmount[1]}`;
    } else {
      fiatAmountString = `${fiatAmount}`;
    }
    let currencyString = `${fiatCode} ${fiatAmountString}`;
  
    if (!!currency) {
      currencyString = `${fiatAmountString} ${currency.name_plural} ${currency.emoji}`;
    }
    
    let amountText = `${amount} `;
    let tasaText = '';
    if (priceFromAPI) {
      amountText = '';
      tasaText = `Tasa: ${process.env.FIAT_RATE_NAME} ${priceMarginText}\n`;
    } else {
      const exchangePrice = getBtcExchangePrice(fiatAmount[0], amount);
      tasaText = `Precio: ${exchangePrice.toFixed(2)}\n`
    }
  
    let rateText = '';
    if (!!totalRating) {
      const stars = getEmojiRate(totalRating);
      const roundedRating = decimalRound(totalRating, -1);
      rateText = `${roundedRating} ${stars} (${totalReviews})\n`;
    }
  
    let description = `${username}${action} ${amountText}sats\nPor ${currencyString}\n`;
    description += `${paymentAction} por ${paymentMethod}\n`;
    description += `Tiene ${trades} operaciones exitosas\n`;
    description += volumeTraded;
    description += hashtag;
    description += tasaText;
    description += rateText;
  
    return description
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

const getOrders = async (bot, user, status) => {
  try {
    const where = {
      $and: [
        {
          $or: [
            { buyer_id: user._id },
            { seller_id: user._id },
          ],
        },
      ],
    };

    if (!!status) {
      where.$and.push({ status });
    } else {
      const $or = [
        { status: 'WAITING_PAYMENT' },
        { status: 'WAITING_BUYER_INVOICE' },
        { status: 'PENDING' },
        { status: 'ACTIVE' },
        { status: 'FIAT_SENT' },
        { status: 'PAID_HOLD_INVOICE' },
      ];
      where.$and.push({ $or });
    }
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

const getNewRangeOrderPayload = async (order) => {
  try {
    let newOrderPayload = undefined;
    let newMaxAmount = 0;

    if (order.max_amount !== undefined) {
      newMaxAmount = order.max_amount - order.fiat_amount;
    }

    if (newMaxAmount >= order.min_amount) {
      const orderData = {
        type: order.type,
        amount: 0,
        // drop newMaxAmount if it is equal to min_amount and create a
        // not range order.
        // Set preserves insertion order, so min_amount will be always
        // before newMaxAmount
        fiatAmount: [...new Set([order.min_amount, newMaxAmount])],
        fiatCode: order.fiat_code,
        paymentMethod: order.payment_method,
        status: 'PENDING',
        priceMargin: order.price_margin,
        range_parent_id: order._id,
      };

      const orderCtx = {
        message: {
          chat: {
            id: order.tg_chat_id,
          },
          message_id: order.tg_order_message,
        }
      };

      newOrderPayload = { orderData, orderCtx };

      return newOrderPayload;
    }
  } catch (error) {
    console.log(error);
  }
};

module.exports = {
  createOrder,
  getOrder,
  getOrders,
  getNewRangeOrderPayload,
};
