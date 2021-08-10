const { subscribeToInvoice, pay } = require('lightning');
const { Order, User, PendingPayment } = require('../models');
const lnd = require('./connect');
const messages = require('../bot/messages');

const subscribeInvoice = async (ctx, bot, id) => {
  try {
    const sub = subscribeToInvoice({ id, lnd });
    sub.on('invoice_updated', async (invoice) => {
      if (invoice.is_held) {
        console.log(`invoice with hash: ${id} is being held!`);
        const order = await Order.findOne({ hash: invoice.id });
        if (order.type === 'sell') {
          // paso la orden a pending
          order.status = 'PENDING';
          order.save();
          const orderUser = await User.findOne({ _id: order.creator_id });

          messages.publishSellOrderMessage(ctx, bot, order);
          messages.pendingSellMessage(bot, orderUser, order);
        } else if (order.type === 'buy') {
          const orderUser = await User.findOne({ _id: order.creator_id });
          const sellerUser = await User.findOne({ _id: order.seller_id });

          await messages.onGoingTakeBuyMessage(bot, orderUser, sellerUser, order);
        }
      }
      if (invoice.is_confirmed) {
        const order = await Order.findOne({ hash: invoice.id });
        order.status = 'PAID_HOLD_INVOICE';
        await order.save();
        try {
          const payment = await pay({ lnd, request: order.buyer_invoice });
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
            // TODO: cronjob que haga estos pagos cada cierto tiempo y con cada intento incremente 'attempts'
            // si attemps > 3 el admin se debe comunicar directamente con el usuario para hacer el pago manualmente
            const buyerUser = await User.findOne({ _id: order.buyer_id });
            const message = 'No he podido pagar tu invoice, en unos minutos intentaré pagarla nuevamente, asegúrate que tu nodo/wallet esté online';
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
            const message = 'El vendedor ha liberado los satoshis pero no he podido pagar tu invoice, en unos minutos intentaré pagarla nuevamente, asegúrate que tu nodo/wallet esté online';
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
