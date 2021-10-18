const { cancelHoldInvoice } = require('../ln');
const { User, Order } = require('../models');
const { plural } = require('../util');

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
        const status = order.status;
        order.status = 'EXPIRED';
        await order.save();
        console.log(`Order Id: ${order._id} expired!`);
        const buyerUser = await User.findOne({ _id: order.buyer_id });
        const sellerUser = await User.findOne({ _id: order.seller_id });
        await cancelHoldInvoice({ hash: order.hash });
        if (status == 'WAITING_PAYMENT') {
            await bot.telegram.sendMessage(process.env.ADMIN_CHANNEL, `El vendedor @${sellerUser.username} no ha pagado la factura correspondiente a la orden Id: ${order._id} y el tiempo ha expirado, la orden ha sido cancelada`);
            await bot.telegram.sendMessage(buyerUser.tg_id, `El vendedor no ha pagado la factura por tu compra Id: ${order._id} y el tiempo ha expirado, la orden ha sido cancelada`);
            await bot.telegram.sendMessage(sellerUser.tg_id, `No has pagado la factura para vender sats por la orden Id: ${order._id} y el tiempo ha expirado, la orden ha sido cancelada`);
        } else {
            await bot.telegram.sendMessage(process.env.ADMIN_CHANNEL, `El comprador @${buyerUser.username} tomó la orden Id: ${order._id} pero no ha ingresado la factura para recibir el pago, el tiempo ha expirado, la orden ha sido cancelada`);
            await bot.telegram.sendMessage(sellerUser.tg_id, `El comprador no me envió la factura para recibir por tu venta Id: ${order._id} y el tiempo ha expirado, la orden ha sido cancelada`);
            await bot.telegram.sendMessage(buyerUser.tg_id, `No has enviado la factura para recibir sats por la orden Id: ${order._id} y el tiempo ha expirado, la orden ha sido cancelada`);
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
    });
    for (const order of activeOrders) {
        const buyerUser = await User.findOne({ _id: order.buyer_id });
        const sellerUser = await User.findOne({ _id: order.seller_id });

        // Instead of cancel this order we should send this to the admins 
        // and they decide what to do
        await bot.telegram.sendMessage(process.env.ADMIN_CHANNEL, `Esta orden ha expirado sin haberse completado
Id: ${order._id}
Tipo de orden: ${order.type}
Status: ${order.status}
Vendedor: @${sellerUser.username}
Comprador: @${buyerUser.username}
Monto sats: ${order.amount}
Monto fiat: ${order.fiat_code} ${order.fiat_amount}
Método de pago: ${order.payment_method}
seller invoice hash: ${order.hash}
seller invoice secret: ${order.secret}
buyer payment request: ${order.buyer_invoice}

@${sellerUser.username} tiene ${sellerUser.disputes} disputa${plural(sellerUser.disputes)}
@${buyerUser.username} tiene ${buyerUser.disputes} disputa${plural(buyerUser.disputes)}`);
    }
};

module.exports = cancelOrders;
