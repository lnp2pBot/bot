const { cancelHoldInvoice } = require('../ln');
const { User, Order } = require('../models');
const { cancelShowHoldInvoice, cancelAddInvoice } = require('../bot/commands');
const messages = require('../bot/messages');

const cancelOrders = async (bot) => {
    const holdInvoiceTime = new Date();
    holdInvoiceTime.setSeconds(holdInvoiceTime.getSeconds() - parseInt(process.env.HOLD_INVOICE_EXPIRATION_WINDOW));
    // We get the orders where the seller didn't pay the hold invoice before expired
    // or where the buyer didn't add the invoice
    const waitingPaymentOrders = await Order.find({
        $or: [
            {status: 'WAITING_PAYMENT'},
            {status: 'WAITING_BUYER_INVOICE'},
        ],
        taken_at: { $lte: holdInvoiceTime },
    });
    for (const order of waitingPaymentOrders) {
        const buyerUser = await User.findOne({ _id: order.buyer_id });
        const sellerUser = await User.findOne({ _id: order.seller_id });
        await cancelHoldInvoice({ hash: order.hash });
        if (order.status == 'WAITING_PAYMENT') {
            await cancelShowHoldInvoice(null, bot, order);
        } else {
            await cancelAddInvoice(null, bot, order);
        }
    }
    // We get the expired order where the seller sent the sats but never released the order
    // In this case we use another time field, `invoice_held_at` is the time when the
    // seller sent the money to the hold invoice, this is an important moment cause
    // we don't want to have a CLTV timeout
    const orderTime = new Date();
    orderTime.setSeconds(orderTime.getSeconds() - parseInt(process.env.ORDER_EXPIRATION_WINDOW));
    const activeOrders = await Order.find({
        invoice_held_at: { $lte: orderTime },
        $or: [{
            status: 'ACTIVE',
            status: 'FIAT_SENT',
        }],
        admin_warned: false,
    });
    for (const order of activeOrders) {
        const buyerUser = await User.findOne({ _id: order.buyer_id });
        const sellerUser = await User.findOne({ _id: order.seller_id });

        // Instead of cancel this order we should send this to the admins 
        // and they decide what to do
        await messages.expiredOrderMessage(bot, order, buyerUser, sellerUser);
        order.admin_warned = true;
        await order.save();
    }
};

module.exports = cancelOrders;
