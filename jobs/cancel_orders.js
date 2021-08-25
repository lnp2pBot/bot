require("dotenv").config();
const { cancelHoldInvoice } = require('../ln');
const mongoConnect = require("../db_connect");
const { Order } = require('../models');

mongoConnect();

const cancelOrders = async () => {
    const time = new Date();
    time.setSeconds(time.getSeconds() - parseInt(process.env.ORDER_EXPIRATION_WINDOW));
    // We get the expired orders where the seller never sent sats
    const waitingPaymentOrders = await Order.find({
        status: 'WAITING_PAYMENT',
        taken_at: { $lte: time },
    });
    for (const order of waitingPaymentOrders) {
        order.status = 'EXPIRED';
        console.log(`Order Id: ${order._id} expired!`);
        await order.save();
        await cancelHoldInvoice({ hash: order.hash });
        // TODO: We should send a message to both parties to indicate that this order expired
    }
    // We get the expired order where the seller sent the sats but never release the order
    // In this case we use another time field, `invoice_held_at` is the time when the
    // seller sent the money to the hold invoice, this is an important moment cause
    // we don't want to have a CLTV timeout
    const activeOrders = await Order.find({
        invoice_held_at: { $lte: time },
        $or: [{
            status: 'ACTIVE',
            status: 'FIAT_SENT',
        }],
    });
    for (const order of activeOrders) {
        // TODO: We should send a message to admin with all information
        // to manually cancel or complete the order
    }
};

cancelOrders();