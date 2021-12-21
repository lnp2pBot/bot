const { payRequest, isPendingPayment } = require('../ln');
const { PendingPayment, Order, User } = require('../models');

const attemptPendingPayments = async (bot) => {
    const pendingPayments = await PendingPayment.find({
        paid: false,
        attempts: { $lt: 3 },
    });
    for (const pending of pendingPayments) {
        const order = await Order.findOne({ _id: pending.order_id });
        try {
            pending.attempts++;
            if (order.status == 'SUCCESS') {
                pending.paid = true;
                await pending.save();
                console.log(`Order id: ${order._id} was already paid`);
                return;
            }
            // We check if the payment is on flight we don't do anything
            const isPending = await isPendingPayment(order.buyer_invoice);
            if (isPending) {
                return;
            }
            const payment = await payRequest({
                amount: pending.amount,
                request: pending.payment_request,
            });
            const buyerUser = await User.findOne({ _id: order.buyer_id });
            if (!!payment && !!payment.confirmed_at) {
                order.status = 'SUCCESS';
                order.routing_fee = payment.fee;
                pending.paid = true;
                // We add a new completed trade for the buyer
                buyerUser.trades_completed++;
                await buyerUser.save();
                // We add a new completed trade for the seller
                const sellerUser = await User.findOne({ _id: order.seller_id });
                sellerUser.trades_completed++;
                sellerUser.save();
                console.log(`Invoice with hash: ${pending.hash} paid`);
                await bot.telegram.sendMessage(process.env.ADMIN_CHANNEL, `El usuario @${buyerUser.username} tenía un pago pendiente en su compra Id: #${order._id} de ${order.amount} satoshis, el pago se realizó luego de ${pending.attempts} intentos.\n\nPrueba de pago: ${payment.secret}`);
                await bot.telegram.sendMessage(buyerUser.tg_id, `He pagado la factura lightning por tu compra Id: #${order._id}!\n\nPrueba de pago: ${payment.secret}`);
            } else {
                if (pending.attempts == 3) {
                    order.paid_hold_buyer_invoice_updated = false;
                    await bot.telegram.sendMessage(buyerUser.tg_id, `He intentado pagar tu factura un total de 4 veces y todas han fallado, algunas veces los usuarios de lightning network no pueden recibir pagos porque no hay suficiente capacidad de entrada en su wallet/nodo, una solución puede ser generar una nueva factura desde otra wallet que sí tenga capacidad\n\nSi lo deseas puedes enviarme una nueva factura para recibir los satoshis con el comando 👇`);
                    await bot.telegram.sendMessage(buyerUser.tg_id, `/setinvoice ${order._id} <lightning_invoice>`);
                }
                await bot.telegram.sendMessage(process.env.ADMIN_CHANNEL, `El pago a la invoice de la compra Id: #${order._id} del usuario @${buyerUser.username} ha fallado!\n\nIntento de pago ${pending.attempts}`);
            }
        } catch (error) {
            console.log('attemptPendingPayments catch error:', error);
        } finally {
            await order.save();
            await pending.save();
        }
    }
};

module.exports = attemptPendingPayments;
