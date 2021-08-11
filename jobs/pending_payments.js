require("dotenv").config();
const { pay } = require('lightning');
const lnd = require('../ln/connect');
const mongoConnect = require("../db_connect");
const { PendingPayment, Order, User } = require('../models');

mongoConnect();

const attemptPendingPayments = async () => {
    const pendingPayments = await PendingPayment.find({
        paid: false,
        attempts: { $lt: 3 },
    });
    if (pendingPayments.length === 0) {
        process.exit();
    }
    for (const pending of pendingPayments) {
        pending.attempts++;
        const order = await Order.findOne({ _id: pending.order_id });
        if (order.status === 'SUCCESS') {
            pending.paid = true;
            await pending.save();
            console.log(`Order id: ${order._id} was already paid`);
            process.exit();
        }
        try {
            const payment = await pay({ lnd, request: order.buyer_invoice });
            if (payment.is_confirmed) {
                order.status = 'SUCCESS';
                pending.paid = true;
                await order.save();
                // We add a new completed trade for the buyer
                const buyerUser = await User.findOne({ _id: order.buyer_id });
                buyerUser.trades_completed++;
                await buyerUser.save();
                // We add a new completed trade for the seller
                const sellerUser = await User.findOne({ _id: order.seller_id });
                sellerUser.trades_completed++;
                sellerUser.save();
                console.log(`Invoice with hash: ${pending.hash} paid`)
              }
        } catch (error) {
            console.log(error);
        } finally {
            await pending.save();
            process.exit();
        }
    }
};

attemptPendingPayments();