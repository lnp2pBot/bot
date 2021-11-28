const { Order, PendingPayment } = require('../models');
const {
    payToBuyer,
} = require('../ln');

// This runs after a seller release the payment but the buyer didn't get paid yet.
const pay2buyer = async (bot) => {
    try {
        const pendingOrders = await Order.find({
            status: 'PAID_HOLD_INVOICE',
            paid_hold_buyer_invoice_updated: true,
        });
        for (const order of pendingOrders) {
            // If the payment is already pending, don't try to pay again.
            const isPending = await PendingPayment.findOne({
                order_id: order._id,
                attempts: { $lt: 3 },
            });
              
            if (!!isPending) {
              return;
            }
            await payToBuyer(bot, order);
        }
    } catch (error) {
        console.log(error);
    }
};

module.exports = pay2buyer;