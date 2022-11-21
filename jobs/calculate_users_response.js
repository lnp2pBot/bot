const { Order } = require('../models');
const logger = require('../logger');

const timeStringToTimestamp = timeString => {
  const date = new Date(timeString);
  const timestamp = date.getTime();

  return timestamp;
};

const calculateSellerResponse = async id => {
  const ordersByTimeToRelease = [];
  try {
    const orders = await Order.find({
      status: 'SUCCESS',
      seller_id: id,
      release_funds_at: { $ne: null },
      fiat_sent_at: { $ne: null },
    }).limit(10);

    for (const order of orders) {
      const releaseFundsAt = timeStringToTimestamp(order.release_funds_at);
      const fiatSentAt = timeStringToTimestamp(order.fiat_sent_at);
      const timeToRelease = (releaseFundsAt - fiatSentAt) / 1000 / 60;
      ordersByTimeToRelease.push(timeToRelease);
      logger.info(`Time To Release: ${timeToRelease}`);    
    }

    if (ordersByTimeToRelease.length >= 1) {
      const average =
        ordersByTimeToRelease.reduce((a, b) => a + b, 0) / orders.length;

      return Math.ceil(parseFloat(average));
    } else {
      return false;
    }
  } catch (error) {
    const message = error.toString();
    logger.error(`calculateSellerResponse catch error: ${message}`);
  }
};

const calculateBuyerResponse = async id => {
  const ordersByTimeToSent = [];
  try {
    const orders = await Order.find({
      status: 'SUCCESS',
      buyer_id: id,
      fiat_sent_at: { $ne: null },
      release_funds_at: { $ne: null },
    }).limit(10);

    for (const order of orders) {
      const fiatSentAt = timeStringToTimestamp(order.fiat_sent_at);
      const takenAt = timeStringToTimestamp(order.taken_at);
      const timeToSent = (fiatSentAt - takenAt) / 1000 / 60;
      ordersByTimeToSent.push(timeToSent);
      logger.info(`Time to Sent: ${timeToSent}`);
    }

    if (ordersByTimeToSent.length >= 1) {
      const average =
        ordersByTimeToSent.reduce((a, b) => a + b, 0) / orders.length;

      return Math.ceil(parseFloat(average));
    } else {
      return false;
    }
  } catch (error) {
    const message = error.toString();
    logger.error(`calculateBuyerrResponse catch error: ${message}`);
  }
};

module.exports = { calculateSellerResponse, calculateBuyerResponse };
