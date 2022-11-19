const { Order, User } = require('../models');
const logger = require('../logger');

const timeStringToTimestamp = (timeString) => {
    const date = new Date(timeString);
    const timestamp = date.getTime();

    return timestamp;
};

const calculateResponse = async (id) => {
    const ordersByTimeToTake = [];
  try {
    const orders = await Order.find({
      status: 'SUCCESS',
      seller_id: id,
    });

    for (const order of orders) {
        const createdAt = timeStringToTimestamp(order.created_at);
        const takenAt = timeStringToTimestamp(order.taken_at);
        const timeToTake = (takenAt - createdAt) / 1000;
        ordersByTimeToTake.push(timeToTake);
        logger.info(`Time to take ${order._id}: ${timeToTake} seconds`);

    }
    

    return ordersByTimeToTake;
  } catch (error) {
    const message = error.toString();
    logger.error(`calculateResponse catch error: ${message}`);
  }
};

module.exports = calculateResponse;
