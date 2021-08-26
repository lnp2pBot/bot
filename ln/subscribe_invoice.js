const { subscribeToInvoice, pay } = require('lightning');
const { Order, User, PendingPayment } = require('../models');
const payRequest = require('./pay_request');
const lnd = require('./connect');
const messages = require('../bot/messages');

const subscribeInvoice = async (bot, id) => {
  try {
    const sub = subscribeToInvoice({ id, lnd });
    sub.on('invoice_updated', async (invoice) => {
      if (invoice.is_held) {
        console.log(`invoice with hash: ${id} is being held!`);
        const order = await Order.findOne({ hash: invoice.id });
        const buyerUser = await User.findOne({ _id: order.buyer_id });
        const sellerUser = await User.findOne({ _id: order.seller_id });
        order.status = 'ACTIVE';
        await order.save();
        if (order.type === 'sell') {
          await messages.onGoingTakeSellMessage(bot, sellerUser, buyerUser, order);
        } else if (order.type === 'buy') {
          await messages.onGoingTakeBuyMessage(bot, sellerUser, buyerUser, order);
        }
        order.invoice_held_at = Date.now();
        order.save();
      }
      if (invoice.is_confirmed) {
        console.log(`Invoice with hash: ${id} is being paid!`);
        const order = await Order.findOne({ hash: invoice.id });
        order.status = 'PAID_HOLD_INVOICE';
        await order.save();
        try {
          const payment = await payRequest({
            request: order.buyer_invoice,
            amount: order.amount,
          });
          if (payment.is_confirmed) {
            order.status = 'SUCCESS';
            await order.save();
            const orderUser = await User.findOne({ _id: order.creator_id });
            if (order.type === 'sell') {
              const buyerUser = await User.findOne({ _id: order.buyer_id });
              await messages.doneTakeSellMessage(bot, orderUser, buyerUser);
              buyerUser.trades_completed++;
              await buyerUser.save();
            } else if (order.type === 'buy') {
              const sellerUser = await User.findOne({ _id: order.seller_id });
              await messages.doneTakeBuyMessage(bot, orderUser, sellerUser);
              sellerUser.trades_completed++;
              sellerUser.save();
            }
            orderUser.trades_completed++;
            await orderUser.save();
          } else {
            const buyerUser = await User.findOne({ _id: order.buyer_id });
            const message = `El vendedor ha liberado los satoshis pero el pago a tu invoice ha fallado, intentaré pagarla nuevamente dentro de ${process.env.PENDING_PAYMENT_WINDOW} minutos, asegúrate que tu nodo/wallet esté online`;
            await messages.customMessage(bot, buyerUser, message);
            const pp = new PendingPayment({
              amount: order.amount,
              payment_request: order.buyer_invoice,
              user_id: buyerUser._id,
              description: order.description,
              hash: order.hash,
              order_id: order._id,
            });
            await pp.save();
          }
        } catch (error) {
          if (order.status === 'PAID_HOLD_INVOICE') {
            const buyerUser = await User.findOne({ _id: order.buyer_id });
            const message = `El vendedor ha liberado los satoshis pero no he podido pagar tu invoice, intentaré pagarla nuevamente dentro de ${process.env.PENDING_PAYMENT_WINDOW} minutos, asegúrate que tu nodo/wallet esté online`;
            await messages.customMessage(bot, buyerUser, message);
            const pp = new PendingPayment({
              amount: order.amount,
              payment_request: order.buyer_invoice,
              user_id: buyerUser._id,
              description: order.description,
              hash: order.hash,
              order_id: order._id,
            });
            await pp.save();
          }
          console.log(error)
        }
      }
    });
  } catch (e) {
    console.log(e);
    return e;
  }
};

module.exports = subscribeInvoice;
