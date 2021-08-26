const { payRequest } = require('../ln');
const { PendingPayment, Order, User } = require('../models');

const attemptPendingPayments = async (bot) => {
    const pendingPayments = await PendingPayment.find({
        paid: false,
        attempts: { $lt: 3 },
    });
    if (pendingPayments.length === 0) {
        return;
    }
    for (const pending of pendingPayments) {
        pending.attempts++;
        const order = await Order.findOne({ _id: pending.order_id });
        if (order.status === 'SUCCESS') {
            pending.paid = true;
            console.log(`Order id: ${order._id} was already paid`);
            return;
        }
        try {
            const payment = await payRequest({
                amount: order.amount,
                request: order.buyer_invoice,
            });
            if (!!payment && payment.is_confirmed) {
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
                console.log(`Invoice with hash: ${pending.hash} paid`);
                await bot.telegram.sendMessage(process.env.ADMIN_CHANNEL, `El usuario @${buyerUser.username} tenía un pago pendiente en su compra de ${order.amount} satoshis, el pago se realizó luego de ${pending.attempts} intentos`);
                await bot.telegram.sendMessage(buyerUser.tg_id, `He pagado tu factura lightning por tu compra Id: ${order._id}!\n\nPrueba de pago: ${payment.secret}`);
            } else {
                const buyerUser = await User.findOne({ _id: order.buyer_id });
                await bot.telegram.sendMessage(process.env.ADMIN_CHANNEL, `El pago a la invoice de la compra Id: ${order._id} del usuario @${buyerUser.username} ha fallado!\n\nIntento de pago ${pending.attempts}`);
            }
        } catch (error) {
            console.log(error);
        } finally {
            await pending.save();
        }
    }
};

module.exports = attemptPendingPayments;