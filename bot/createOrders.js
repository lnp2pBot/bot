const { Order } = require('../models');
const { createHoldInvoice, subscribeInvoice } = require('../ln');

const createOrder = async (ctx, bot, { type, amount, seller, buyer, fiatAmount, fiatCode, paymentMethod, buyerInvoice, status }) => {
  const action = type == 'sell' ? 'Vendiendo' : 'Comprando';
  const trades = type == 'sell' ? seller.trades_completed : buyer.trades_completed;
  try {
    if (type === 'sell') {
      const description = `${action} ${amount} sats\nPor ${fiatCode} ${fiatAmount}\nPago por ${paymentMethod}\nTiene ${trades} operaciones exitosas`;
      const invoiceDescription = `Venta por @P2PLNBot`;
      const { request, hash, secret } = await createHoldInvoice({
        amount: amount + amount * process.env.FEE,
        description: invoiceDescription,
      });
      if (!!hash) {
        const order = new Order({
          description,
          amount,
          hash,
          secret,
          creator_id: seller._id,
          seller_id: seller._id,
          type,
          fiat_amountrice: fiatAmount,
          fiat_code: fiatCode,
          payment_method: paymentMethod,
          buyer_invoice: buyerInvoice,
          tg_chat_id: ctx.message.chat.id,
          tg_order_message: ctx.message.message_id,
        });
        await order.save();
        // monitoreamos esa invoice para saber cuando el usuario realice el pago
        await subscribeInvoice(ctx, bot, hash);

        return { request, order };
      }
    } else {
      const description = `${action} ${amount} sats\nPor ${fiatCode} ${fiatAmount}\nRecibo pago por ${paymentMethod}\nTiene ${trades} operaciones exitosas`;
      const order = new Order({
        description,
        amount,
        creator_id: buyer._id,
        buyer_id: buyer._id,
        type,
        fiat_amountrice: fiatAmount,
        fiat_code: fiatCode,
        payment_method: paymentMethod,
        buyer_invoice: buyerInvoice,
        status,
        tg_chat_id: ctx.message.chat.id,
        tg_order_message: ctx.message.message_id,
      });
      await order.save();

      return { order };
    }
  } catch (e) {
    console.log(e);
  }
};

module.exports = {
  createOrder,
};
