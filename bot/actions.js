const { Order, User } = require('../models');
const { createHoldInvoice, subscribeInvoice } = require('../ln');

// busca en base de datos si el usuario de telegram existe,
// si no lo encuentra lo crea
const getUser = async tgUser => {
  let user = await User.findOne({ tg_id: tgUser.id });
  if (!user) {
    user = new User({
      tg_id: tgUser.id,
      username: tgUser.username,
      first_name: tgUser.first_name,
      last_name: tgUser.last_name,
    });
    await user.save();
  }
  return user;
};

const createOrder = async ({
  type,
  amount,
  seller,
  buyer,
  fiatAmount,
  fiatCode,
  paymentMethod,
  buyerInvoice,
  status,
}) => {
  const action = type == 'sell' ? 'Vendo' : 'Compro';
  const description = `${action} ${amount} sats
por ${fiatCode} ${fiatAmount}
Pago por ${paymentMethod}`;
  try {
    if (type === 'sell') {
      const invoiceDescription = `Venta por @P2PLNBot`;
      const {
        request,
        hash,
        secret,
      } = await createHoldInvoice({
        amount: amount + (amount * process.env.FEE),
        description: invoiceDescription,
      });
      if (!!hash) {
        const order = new Order({
          description,
          amount,
          hash,
          secret,
          creatorId: seller._id,
          sellerId: seller._id,
          type,
          fiat_amountrice: fiatAmount,
          fiat_code: fiatCode,
          payment_method: paymentMethod,
          buyerInvoice,
        });
        await order.save();
        // monitoreamos esa invoice para saber cuando el usuario realice el pago
        await subscribeInvoice(hash);

        return { request, order };
      }
    } else {
      const description = `${action} ${amount} sats
por ${fiatCode} ${fiatAmount}
Recibo pago por ${paymentMethod}`;
      const order = new Order({
        description,
        amount,
        creatorId: buyer._id,
        buyerId: buyer._id,
        type,
        fiat_amountrice: fiatAmount,
        fiat_code: fiatCode,
        payment_method: paymentMethod,
        buyerInvoice,
        status,
      });
      await order.save();

      return { order };
    }

  } catch (e) {
    console.log(e);
  }
};

module.exports = {
  getUser,
  createOrder,
};
