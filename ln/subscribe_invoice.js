const { subscribeToInvoice, pay } = require('lightning');
const { Order, User } = require('../models');
const lnd = require('./connect');
const messages = require('../bot/messages');

const subscribeInvoice = async (ctx, bot, id) => {
  try {
    const sub = subscribeToInvoice({ id, lnd });
    sub.on('invoice_updated', async (invoice) => {
      if (invoice.is_held) {
        console.log(`invoice with hash: id is being held!`);
        const order = await Order.findOne({ hash: invoice.id });
        if (order.type === 'sell') {
          // paso la orden a pending
          order.status = 'PENDING';
          order.save();
          const orderUser = await User.findOne({ _id: order.creator_id });

          messages.publishSellOrderMessage(ctx, bot, order);
          messages.pendingSellMessage(bot, orderUser);
        } else if (order.type === 'buy') {
          const orderUser = await User.findOne({ _id: order.creator_id });
          const sellerUser = await User.findOne({ _id: order.seller_id });

          await messages.onGoingTakeBuyMessage(bot, orderUser, sellerUser, order);
        }
      }
      if (invoice.is_confirmed) {
        const order = await Order.findOne({ hash: invoice.id });
        order.status = 'CLOSED';
        order.save();
        const payment = await pay({ lnd, request: order.buyer_invoice });
        if (payment.is_confirmed) {
          // el bot envia un mensaj
          const orderUser = await User.findOne({ _id: order.creator_id });
          if (order.type === 'sell') {
            const buyerUser = await User.findOne({ _id: order.buyer_id });
            await messages.doneTakeSellMessage(bot, orderUser, buyerUser);
            buyerUser.trades_completed++;
            buyerUser.save();
          } else if (order.type === 'buy') {
            const sellerUser = await User.findOne({ _id: order.seller_id });
            await messages.doneTakeBuyMessage(bot, orderUser, sellerUser);
            sellerUser.trades_completed++;
            sellerUser.save();
          }
          orderUser.trades_completed++;
          orderUser.save();
        } else {
          // TODO: guardo esto en una tabla de pagos pendientes,
          // puedo correr luego un cronjob que haga estos pagos cada cierto tiempo
          console.log('el pago a bob fallo pero guardo esto en una tabla para intentarlo mas tarde');
        }
      }
    });
  } catch (e) {
    console.log(e);
    return e;
  }
};

module.exports = subscribeInvoice;
