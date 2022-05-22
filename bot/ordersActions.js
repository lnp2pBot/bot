const { ObjectId } = require('mongoose').Types;
const { Order } = require('../models');
const messages = require('./messages');
const {
  getCurrency,
  getBtcExchangePrice,
  getEmojiRate,
  decimalRound,
  getFee,
} = require('../util');
const logger = require('../logger');

const createOrder = async (
  i18n,
  bot,
  user,
  {
    type,
    amount,
    fiatAmount,
    fiatCode,
    paymentMethod,
    status,
    priceMargin,
    range_parent_id,
    tgChatId,
    tgOrderMessage,
    community_id,
  }
) => {
  try {
    const pendingOrders = await Order.count({
      status: 'PENDING',
      creator_id: user._id,
    });
    // We don't let users create too PENDING many orders
    if (pendingOrders >= process.env.MAX_PENDING_ORDERS) {
      await messages.tooManyPendingOrdersMessage(bot, user, i18n);
      return false;
    }

    amount = parseInt(amount);
    const fee = await getFee(amount, community_id);
    const currency = getCurrency(fiatCode);
    const priceFromAPI = !amount;

    if (priceFromAPI && !currency.price) {
      await messages.notRateForCurrency(bot, user, i18n);
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
      tg_chat_id: tgChatId,
      tg_order_message: tgOrderMessage,
      price_from_api: priceFromAPI,
      price_margin: priceMargin || 0,
      description: buildDescription(i18n, {
        user,
        type,
        amount,
        fiatAmount,
        fiatCode,
        paymentMethod,
        priceMargin,
        priceFromAPI,
        currency,
      }),
      range_parent_id,
      community_id,
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
  } catch (error) {
    logger.error(error);
  }
};

const getFiatAmountData = fiatAmount => {
  const response = {};
  if (fiatAmount.length === 2) {
    response.min_amount = fiatAmount[0];
    response.max_amount = fiatAmount[1];
  } else {
    response.fiat_amount = fiatAmount[0];
  }

  return response;
};

const buildDescription = (
  i18n,
  {
    user,
    type,
    amount,
    fiatAmount,
    fiatCode,
    paymentMethod,
    priceMargin,
    priceFromAPI,
    currency,
  }
) => {
  try {
    const action = type === 'sell' ? i18n.t('selling') : i18n.t('buying');
    const hashtag = `#${type.toUpperCase()}${fiatCode}\n`;
    const paymentAction =
      type === 'sell' ? i18n.t('receive_payment') : i18n.t('pay');
    const trades = user.trades_completed;
    const volume = user.volume_traded;
    const totalRating = user.total_rating;
    const totalReviews = user.reviews.length;
    const username = user.show_username
      ? `@${user.username} ` + i18n.t('is') + ` `
      : ``;
    const volumeTraded = user.show_volume_traded
      ? i18n.t('trading_volume', { volume }) + `\n`
      : ``;
    priceMargin =
      !!priceMargin && priceMargin > 0 ? `+${priceMargin}` : priceMargin;
    const priceMarginText = priceMargin ? `${priceMargin}%` : ``;
    let fiatAmountString;

    if (fiatAmount.length === 2) {
      fiatAmountString = `${fiatAmount[0]}-${fiatAmount[1]}`;
    } else {
      fiatAmountString = `${fiatAmount}`;
    }
    let currencyString = `${fiatCode} ${fiatAmountString}`;

    if (currency) {
      currencyString = `${fiatAmountString} ${currency.name_plural} ${currency.emoji}`;
    }

    let amountText = `${amount} `;
    let tasaText = '';
    if (priceFromAPI) {
      amountText = '';
      tasaText =
        i18n.t('rate') + `: ${process.env.FIAT_RATE_NAME} ${priceMarginText}\n`;
    } else {
      const exchangePrice = getBtcExchangePrice(fiatAmount[0], amount);
      tasaText = i18n.t('price') + `: ${exchangePrice.toFixed(2)}\n`;
    }

    let rateText = '';
    if (totalRating) {
      const stars = getEmojiRate(totalRating);
      const roundedRating = decimalRound(totalRating, -1);
      rateText = `${roundedRating} ${stars} (${totalReviews})\n`;
    }

    let description =
      `${username}${action} ${amountText}` + i18n.t('sats') + `\n`;
    description += i18n.t('for') + ` ${currencyString}\n`;
    description += `${paymentAction} ` + i18n.t('by') + ` ${paymentMethod}\n`;
    description += i18n.t('has_successful_trades', { trades }) + `\n`;
    description += volumeTraded;
    description += hashtag;
    description += tasaText;
    description += rateText;

    return description;
  } catch (error) {
    logger.error(error);
  }
};

const getOrder = async (ctx, user, orderId) => {
  try {
    if (!ObjectId.isValid(orderId)) {
      await messages.notValidIdMessage(ctx);
      return false;
    }

    const where = {
      _id: orderId,
      $or: [{ seller_id: user._id }, { buyer_id: user._id }],
    };

    const order = await Order.findOne(where);
    if (!order) {
      await messages.notOrderMessage(ctx);
      return false;
    }

    return order;
  } catch (error) {
    logger.error(error);
    return false;
  }
};

const getOrders = async (ctx, user, status) => {
  try {
    const where = {
      $and: [
        {
          $or: [{ buyer_id: user._id }, { seller_id: user._id }],
        },
      ],
    };

    if (status) {
      where.$and.push({ status });
    } else {
      const $or = [
        { status: 'WAITING_PAYMENT' },
        { status: 'WAITING_BUYER_INVOICE' },
        { status: 'PENDING' },
        { status: 'ACTIVE' },
        { status: 'FIAT_SENT' },
        { status: 'PAID_HOLD_INVOICE' },
        { status: 'DISPUTE' },
      ];
      where.$and.push({ $or });
    }
    const orders = await Order.find(where);

    if (orders.length === 0) {
      await messages.notOrdersMessage(ctx);
      return false;
    }

    return orders;
  } catch (error) {
    logger.error(error);
  }
};

const getNewRangeOrderPayload = async order => {
  try {
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
        tgChatId: order.tg_chat_id,
        tgOrderMessage: order.tg_order_message,
        community_id: order.community_id,
      };

      return orderData;
    }
  } catch (error) {
    logger.error(error);
  }
};

module.exports = {
  createOrder,
  getOrder,
  getOrders,
  getNewRangeOrderPayload,
};
