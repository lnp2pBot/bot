const startMessage = async (ctx) => {
  try {
    await ctx.reply(`Este bot te ayudará a completar tus intercambios P2P usando Bitcoin vía Lightning Network.

Una vez incializado el Bot en privado es fácil:

1. Publica tu oferda de compra o venta por medio de los comandos /buy o /sell y sigue las instrucciones.
2. Espera que otro usuario tome la oferta por medio de /takesell o /takebuy. Tambien puedes tomar las ofertas de otros usuarios con estos comandos!
3. Tu oferta y calificación estará visible en el canal de @testeandoCosas.

/sell:
4. Si estas vendiendo el bot te pedira que pagues un invoice el cual estara retenido por 1 hora mientras alguien toma tu venta. Sin embargo puedes cancelarla antes de que otro usuario la tome con el comando /cancel.
5. Una vez alguien tome tu venta, le debes contactar y brindarle tus datos de pago para que te pague el monto FIAT correspondiente. Luego tu debes liberar los fondos para que le lleguen los sats al invoice del usuario por medio del comando /release

/buy:
6. Si estas comprando, solo debes publicar la oferta, crear un invoice para recibir los sats y esperar que otro usuario la tome. Sin embargo puedes cancelarla antes de que otro usuario la tome con el comando /cancel.
7. Una vez alguien tome tu compra, contacta al vendedor para que te de los datos de pago FIAT. El usuario luego debe liberar sus fondos usando el comando /release para que te lleguen los sats al invoice.

/takesell:
8. Si estas tomando una venta, debes crear un invoice para recibir los sats y pedirle al vendedor que te de sus datos de pago FIAT.
9. Una vez el otro usuario confirme su pago FIAT usara el comando /release para liberarte los sats a tu invoice. 

/takebuy:
9. Si estas tomando una compra, debes pagar el invoice el cual estara retenido por 1 mientras el otro usuario realiza tu pago FIAT. Debes contactarle y brindarle tus datos para ello.
10. Una vez confirmes su pago, debes liberar los fondos por medio del comando /release para que le lleguen sus sats a su invoice.

/dispute:
11. Si en algun punto los usuarios no pueden solucionar su transaccion, pueden usar este comando para llamar a los admin a que resuelvan la operacion como intermediarios.

/cancel:
12. Antes de que cualquier otro usuario tome tu oferta de compra o venta, puedes cancelarla con el este comando

¡Intercambia seguro y rápido! #P2PLN`);
  } catch (error) {
    console.log(error);
  }
};

const initBotErrorMessage = async (ctx) => {
  try {
    await ctx.reply(`Para usar este Bot primero debes inicializar en privado @${ctx.botInfo.username} el protocolo del bot`);
  } catch (error) {
    console.log(error);
  }
};

const nonHandleErrorMessage = async (ctx) => {
  try {
    await ctx.reply(`Para usar este bot debes activar tu username de telegram`);
  } catch (error) {
    console.log(error);
  }
};

const invoicePaymentRequestMessage = async (bot, user, request) => {
  try {
    await bot.telegram.sendMessage(user.tg_id, `Por favor paga esta invoice para comenzar la venta:`);
    await bot.telegram.sendMessage(user.tg_id, `${request}`);
  } catch (error) {
    console.log(error);
  }
};

const pendingSellMessage = async (bot, user, order) => {
  try {
    await bot.telegram.sendMessage(user.tg_id, `Invoice pagado y publicada la oferta en el canal ${process.env.CHANNEL}\n\nEspera que alguien tome tu venta.`);
    await bot.telegram.sendMessage(user.tg_id, `Puedes cancelar esta orden antes de que alguien la tome ejecutando:`);
    await bot.telegram.sendMessage(user.tg_id, `/cancel ${order._id}`);
  } catch (error) {
    console.log(error);
  }
};

const pendingBuyMessage = async (bot, user) => {
  try {
    await bot.telegram.sendMessage(user.tg_id, `Publicada la oferta en el canal ${process.env.CHANNEL}.\n\nEspera que alguien tome tu compra.`);
  } catch (error) {
    console.log(error);
  }
};

const mustBeIntMessage = async (bot, user, fieldName) => {
  try {
    await bot.telegram.sendMessage(user.tg_id, `${fieldName} debe ser entero positivo`);
  } catch (error) {
    console.log(error);
  }
};

const sellOrderCorrectFormatMessage = async (bot, user) => {
  try {
    await bot.telegram.sendMessage(user.tg_id, `/sell <monto_en_sats> <monto_en_fiat> <codigo_fiat> <método_de_pago>`);
  } catch (error) {
    console.log(error);
  }
};

const buyOrderCorrectFormatMessage = async (bot, user) => {
  try {
    await bot.telegram.sendMessage(user.tg_id, `/buy <monto_en_sats> <monto_en_fiat> <codigo_fiat> <método_de_pago> <lightning_invoice>`);
  } catch (error) {
    console.log(error);
  }
};

const minimunAmountInvoiceMessage = async (bot, user) => {
  try {
    await bot.telegram.sendMessage(user.tg_id, `La invoice debe ser mayor o igual a 100 satoshis`);
  } catch (error) {
    console.log(error);
  }
};

const amountMustTheSameInvoiceMessage = async (bot, user, amount) => {
  try {
    await bot.telegram.sendMessage(user.tg_id, `La invoice tener un monto igual a ${amount} sats`);
  } catch (error) {
    console.log(error);
  }
};

const minimunExpirationTimeInvoiceMessage = async (bot, user) => {
  try {
    const expirationTime = parseInt(INVOICE_EXPIRATION_WINDOW) / 60 / 1000;
    await bot.telegram.sendMessage(user.tg_id, `El tiempo de expiración de la invoice debe ser de al menos ${expirationTime} minutos`);
  } catch (error) {
    console.log(error);
  }
};

const expiredInvoiceMessage = async (bot, user) => {
  try {
    await bot.telegram.sendMessage(user.tg_id, `La invoice ha expirado`);
  } catch (error) {
    console.log(error);
  }
};

const requiredAddressInvoiceMessage = async (bot, user) => {
  try {
    await bot.telegram.sendMessage(user.tg_id, `La invoice necesita una dirección destino`);
  } catch (error) {
    console.log(error);
  }
};

const requiredHashInvoiceMessage = async (bot, user) => {
  try {
    await bot.telegram.sendMessage(user.tg_id, `La invoice necesita un hash`);
  } catch (error) {
    console.log(error);
  }
};

const invalidOrderMessage = async (bot, user) => {
  try {
    await bot.telegram.sendMessage(user.tg_id, `Código de orden incorrecto`);
  } catch (error) {
    console.log(error);
  }
};

const invalidTypeOrderMessage = async (bot, user, type) => {
  try {
    await bot.telegram.sendMessage(user.tg_id, `Esta orden es una ${type}`);
  } catch (error) {
    console.log(error);
  }
};

const alreadyTakenOrderMessage = async (bot, user) => {
  try {
    await bot.telegram.sendMessage(user.tg_id, `Esta orden ya ha sido tomada por otro usuario`);
  } catch (error) {
    console.log(error);
  }
};

const invalidDataMessage = async (bot, user) => {
  try {
    await bot.telegram.sendMessage(user.tg_id, `Haz enviado datos incorrectos, inténtalo nuevamente.`);
  } catch (error) {
    console.log(error);
  }
};

const takeSellCorrectFormatMessage = async (bot, user) => {
  try {
    await bot.telegram.sendMessage(user.tg_id, `/takesell <order_id> <lightning_invoice>`);
  } catch (error) {
    console.log(error);
  }
};

const takeBuyCorrectFormatMessage = async (bot, user) => {
  try {
    await bot.telegram.sendMessage(user.tg_id, `/takebuy <order_id>`);
  } catch (error) {
    console.log(error);
  }
};

const beginTakeBuyMessage = async (bot, orderUser, sellerUser, request, order) => {
  try {
    await bot.telegram.sendMessage(sellerUser.tg_id, `Por favor paga esta invoice al bot para comenzar tu venta con el comprador:`);
    await bot.telegram.sendMessage(sellerUser.tg_id, `${request}`);

    await bot.telegram.editMessageText(process.env.CHANNEL, order.tg_channel_message2, null, `${order._id} PROCESADA ✅`);
    if (order.tg_chat_id < 0) {
      await bot.telegram.editMessageText(order.tg_chat_id, order.tg_group_message2, null, `${order._id} PROCESADA ✅`);
    }
  } catch (error) {
    console.log(error);
  }
};

const onGoingTakeBuyMessage = async (bot, orderUser, sellerUser, order) => {
  try {
    await bot.telegram.sendMessage(sellerUser.tg_id, `Pago recibido!\n\nPonte en contacto con el usuario @${orderUser.username} para darle los detalles de metodo de pago FIAT que te hara. Una vez confirmes su pago FIAT debes liberar los fondos con el comando:`);
    await bot.telegram.sendMessage(sellerUser.tg_id, `/release ${order._id}`);
    await bot.telegram.sendMessage(orderUser.tg_id, `El usuario @${sellerUser.username} ha tomado tu compra y te quiere vender sats. Comunicate con el para que le hagas el pago por FIAT y te libere sus sats. `);
  } catch (error) {
    console.log(error);
  }
};

const doneTakeBuyMessage = async (bot, orderUser, sellerUser) => {
  try {
    await bot.telegram.sendMessage(sellerUser.tg_id, `Confirmaste el pago FIAT del comprador @${orderUser.username} y has vendido exitosamente tus sats\n⚡️🍊⚡️`);
    await bot.telegram.sendMessage(orderUser.tg_id, `Tu compra de sats ha sido completada exitosamente con @${sellerUser.username} tras confirmar tu pago FIAT y ya he pagado tu invoice,  que disfrutes tus sats\n⚡️🍊⚡️`);
  } catch (error) {
    console.log(error);
  }
};

const beginTakeSellMessage = async (bot, orderUser, buyerUser, order) => {
  try {
    await bot.telegram.sendMessage(buyerUser.tg_id, `Ponte en contacto con el usuario @${orderUser.username} para que te de detalle de como enviarle el dinero fiat.\n\nCuando el usuario @${orderUser.username} confirme que recibió tu pago FIAT, estaré liberando tus sats.`);
    await bot.telegram.sendMessage(orderUser.tg_id, `El usuario @${buyerUser.username} ha tomado tu venta y te quiere comprar sats. Comunicate con el usuario para que te haga el pago por FIAT.\n\nUna vez confirmes su pago FIAT debes liberar los fondos con el comando:`);
    await bot.telegram.sendMessage(orderUser.tg_id, `/release ${order._id}`);

    await bot.telegram.editMessageText(process.env.CHANNEL, order.tg_channel_message2, null, `${order._id} PROCESADA ✅`);
    if (order.tg_chat_id < 0) await bot.telegram.editMessageText(order.tg_chat_id, order.tg_group_message2, null, `${order._id} PROCESADA ✅`);
  } catch (error) {
    console.log(error);
  }
};

const doneTakeSellMessage = async (bot, orderUser, buyerUser) => {
  try {
    await bot.telegram.sendMessage(buyerUser.tg_id, `El vendedor @${orderUser.username} nos indicó que recibió tu pago FIAT y he pagado tu invoice, que disfrutes tus sats\n⚡️🍊⚡️`);
    await bot.telegram.sendMessage(orderUser.tg_id, `Tu venta de sats ha sido completada tras confirmar el pago FIAT de  @${buyerUser.username}\n⚡️🍊⚡️`);
  } catch (error) {
    console.log(error);
  }
};

const releaseCorrectFormatMessage = async (bot, user) => {
  try {
    await bot.telegram.sendMessage(user.tg_id, `/release <order_id>`);
  } catch (error) {
    console.log(error);
  }
};

const notActiveOrderMessage = async (bot, user) => {
  try {
    await bot.telegram.sendMessage(user.tg_id, `No tienes esa orden activa`);
  } catch (error) {
    console.log(error);
  }
};

const notOrderMessage = async (bot, user) => {
  try {
    await bot.telegram.sendMessage(user.tg_id, `No tienes ninguna orden asociada con ese Id`);
  } catch (error) {
    console.log(error);
  }
};

const repeatedInvoiceMessage = async (bot, user) => {
  try {
    await bot.telegram.sendMessage(user.tg_id, `Esa invoice ya se encuentra usada en el sistema`);
  } catch (error) {
    console.log(error);
  }
};

const publishBuyOrderMessage = async (ctx, bot, order) => {
  try {
    const publishMessage = `⚡️🍊⚡️\n${order.description}\n#P2PLN\n\nPara tomar esta orden, debes marcar al bot @${ctx.botInfo.username} el comando 👇`;
    const publishMessage2 = `/takebuy ${order._id}`;

    // Mensaje al canal
    order.tg_channel_message1 = (await bot.telegram.sendMessage(process.env.CHANNEL, publishMessage)).message_id;
    order.tg_channel_message2 = (await bot.telegram.sendMessage(process.env.CHANNEL, publishMessage2)).message_id;

    // Mensaje al grupo origen en caso de haber
    if (ctx.message.chat.type != 'private') {
      order.tg_group_message1 = (await ctx.reply(publishMessage, { reply_to_message_id: order.tg_order_message })).message_id;
      order.tg_group_message2 = (await ctx.reply(publishMessage2)).message_id;
    }

    order.save();
  } catch (error) {
    console.log(error);
  }
};

const publishSellOrderMessage = async (ctx, bot, order) => {
  try {
    const publishMessage = `⚡️🍊⚡️\n${order.description}\n#P2PLN\n\nPara tomar esta orden, debes enviarle a @${ctx.botInfo.username} una lightning invoice con monto = ${order.amount} con el comando 👇`;
    const publishMessage2 = `/takesell ${order._id} <lightning_invoice>`;

    // Mensaje al canal
    order.tg_channel_message1 = (await bot.telegram.sendMessage(process.env.CHANNEL, publishMessage)).message_id;
    order.tg_channel_message2 = (await bot.telegram.sendMessage(process.env.CHANNEL, publishMessage2)).message_id;

    // Mensaje al grupo origen en caso de haber
    if (ctx.message.chat.type != 'private') {
      order.tg_group_message1 = (await ctx.reply(publishMessage, { reply_to_message_id: order.tg_order_message })).message_id;
      order.tg_group_message2 = (await ctx.reply(publishMessage2)).message_id;
    }

    order.save();
  } catch (error) {
    console.log(error);
  }
};

const disputeCorrectFormatMessage = async (bot, user) => {
  try {
    await bot.telegram.sendMessage(user.tg_id, `/dispute <order_id>`);
  } catch (error) {
    console.log(error);
  }
};

const beginDisputeMessage = async (bot, initiatorUser, counterPartyUser, order, userType) => {
  try {

    const type = userType === 'seller' ? 'comprador' : 'vendedor';
    await bot.telegram.sendMessage(process.env.ADMINCHANNEL, `El ${type} @${initiatorUser.username} 
ha iniciado una disputa con @${counterPartyUser.username} en la orden id: ${order._id}:
Monto sats: ${order.amount}
Monto ${order.fiat_code}: ${order.fiat_amount}
Método de pago: ${order.payment_method}
seller invoice hash: ${order.hash}
seller invoice secret: ${order.secret}
buyer payment request: ${order.buyer_invoice}

@${initiatorUser.username} ya tiene ${initiatorUser.disputes} disputas
@${counterPartyUser.username} ya tiene ${counterPartyUser.disputes} disputas`);
    if (userType === 'buyer') {
      await bot.telegram.sendMessage(initiatorUser.tg_id, `Has iniciado una disputa por tu compra, nos comunicaremos contigo y tu contraparte para resolverla`);
      await bot.telegram.sendMessage(counterPartyUser.tg_id, `El comprador ha iniciado una disputa por tu compra con id: ${order._id}, nos comunicaremos contigo y tu contraparte para resolverla`);
    } else {
      await bot.telegram.sendMessage(initiatorUser.tg_id, `Has iniciado una disputa por tu venta, nos comunicaremos contigo y tu contraparte para resolverla`);
      await bot.telegram.sendMessage(counterPartyUser.tg_id, `El vendedor ha iniciado una disputa por tu venta con id: ${order._id}, nos comunicaremos contigo y tu contraparte para resolverla`);
    }
  } catch (error) {
    console.log(error);
  }
};

const cancelCorrectFormatMessage = async (bot, user) => {
  try {
    await bot.telegram.sendMessage(user.tg_id, `/cancel <order_id>`);
  } catch (error) {
    console.log(error);
  }
};

const customMessage = async (bot, user, message) => {
  try {
    await bot.telegram.sendMessage(user.tg_id, message);
  } catch (error) {
    console.log(error);
  }
};

const checkOrderMessage = async (ctx,order,creator,buyer,seller) => {
  try {
    await ctx.reply(`Orden id: ${order._id}:
      Creator: ${creator} 
      Buyer: ${buyer} 
      Seller: ${seller} 
      Monto sats: ${order.amount}
      Monto ${order.fiat_code}: ${order.fiat_amount}
      Método de pago: ${order.payment_method}
      seller invoice hash: ${order.hash}
      seller invoice secret: ${order.secret}
      buyer payment request: ${order.buyer_invoice}`);
  } catch (error) {
    console.log(error);
  }
};

const mustBeValidCurrency = async (bot, user, fieldName) => {
  try {
    await bot.telegram.sendMessage(user.tg_id, `${fieldName} debe ser un código de moneda válido, ejemplo: USD, EUR`);
  } catch (error) {
    console.log(error);
  }
};

const mustBeANumber = async (bot, user, fieldName) => {
  try {
    await bot.telegram.sendMessage(user.tg_id, `${fieldName} debe ser un número`);
  } catch (error) {
    console.log(error);
  }
};

module.exports = {
  startMessage,
  initBotErrorMessage,
  invoicePaymentRequestMessage,
  sellOrderCorrectFormatMessage,
  buyOrderCorrectFormatMessage,
  minimunAmountInvoiceMessage,
  amountMustTheSameInvoiceMessage,
  minimunExpirationTimeInvoiceMessage,
  expiredInvoiceMessage,
  requiredAddressInvoiceMessage,
  requiredHashInvoiceMessage,
  publishBuyOrderMessage,
  invalidOrderMessage,
  invalidTypeOrderMessage,
  alreadyTakenOrderMessage,
  beginTakeSellMessage,
  invalidDataMessage,
  takeBuyCorrectFormatMessage,
  takeSellCorrectFormatMessage,
  beginTakeBuyMessage,
  releaseCorrectFormatMessage,
  notActiveOrderMessage,
  publishSellOrderMessage,
  onGoingTakeBuyMessage,
  doneTakeBuyMessage,
  doneTakeSellMessage,
  pendingSellMessage,
  pendingBuyMessage,
  repeatedInvoiceMessage,
  mustBeIntMessage,
  disputeCorrectFormatMessage,
  beginDisputeMessage,
  cancelCorrectFormatMessage,
  notOrderMessage,
  customMessage,
  nonHandleErrorMessage,
  checkOrderMessage,
  mustBeValidCurrency,
  mustBeANumber,
};
