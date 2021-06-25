const { subscribeToInvoice, pay } = require('lightning');
const { Order, User } = require('../models');
const lnd = require('./connect');

const subscribeInvoice = async id => {
  try {
    const sub = subscribeToInvoice({ id, lnd });
    sub.on('invoice_updated', async invoice => {
      if (invoice.is_held) {
        const order = await Order.findOne({ hash: invoice.id });
        if (order.type === 'sell') {
          // paso la orden a pending
          order.status = 'PENDING';
          order.save();
          // TODO: esto debe enviarse como un mensaje al canal del bot
          const messageToBotChannel = `${order.description}
Si quieres tomar esta orden escríbele en privado al bot
y envíale una lightning invoice con monto ${order.amount}

/takesell ${order._id} <lightning_invoice>

#P2PLN ⚡️🍊⚡️`;
          console.log(messageToBotChannel);
        } else if (order.type === 'buy') {
          const buyerUser = await User.findOne({ _id: order.creatorId });
          const sellerUser = await User.findOne({ _id: order.sellerId });
          // TODO: esto debe enviarse como un mensaje al vendedor
          const messageToUser = `Mensaje a ${sellerUser.username} => Ponte en contacto con el usuario @${orderUser.username} para
darle el detalle de cómo puede enviarte el dinero fiat.

Una vez te haya llegado el dinero por favor libera los satoshis con el comando release

/release ${order._id}`;
          // TODO: probablemente sea mejor mostrar el comando /release cuando
          // el comprador haya dicho que envió, para evitar que vendedores liberen
          // los satoshis por error y viendo esto el comprador no envíe el fiat
          console.log(messageToUser);
        }
      }
      if (invoice.is_confirmed) {
        const order = await Order.findOne({ hash: invoice.id });
        order.status = 'CLOSED';
        order.save();
        const payment = await pay({ lnd, request: order.buyerInvoice });
        if (payment.is_confirmed) {
          // el bot envia un mensaje al comprador
          const messageToBuyer = `El vendedor nos indicó que recibió tu pago y
he pagado tu invoice, que disfrutes tus sats.`;
          console.log(messageToBuyer);
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
