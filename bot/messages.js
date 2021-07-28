const startMessage = async (ctx) => {
  try {
    await ctx.reply(`Este bot te ayudará a completar tus intercambios P2P usando Bitcoin vía Lightning Network.

Es fácil:

1. Únete al grupo @satoshienvenezuela.
2. Publica tu oferta de compra o venta en el grupo, usando SIEMPRE el hashtag #P2PLN.
3. Tu oferta o calificación estará visible en el canal @SEVLIGHTNING.

¡Intercambia seguro y rápido!

Support: @franklinzerocr`);
  } catch (error) {
    console.log(error);
  }
};

const initBotErrorMessage = async (ctx) => {
  try {
    await ctx.reply(`Debes primero inicializar este bot @p2plnbot para poder realizar operaciones`);
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

const pendingSellMessage = async (bot, user) => {
  try {
    await bot.telegram.sendMessage(user.tg_id, `Invoice pagado y publicada la oferta en el canal ${process.env.CHANNEL}\n\nEspera que alguien tome tu venta.`);
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

    await bot.telegram.editMessageText(process.env.CHANNEL, order.tg_channel_message2, null, `${order._id} procesada ✅`);
    if (order.tg_chat_id < 0) {
      await bot.telegram.editMessageText(order.tg_chat_id, order.tg_group_message2, null, `${order._id} procesada ✅`);
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

    await bot.telegram.editMessageText(process.env.CHANNEL, order.tg_channel_message2, null, `${order._id} procesada ✅`);
    if (order.tg_chat_id < 0) await bot.telegram.editMessageText(order.tg_chat_id, order.tg_group_message2, null, `${order._id} procesada ✅`);
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
    const publishMessage = `⚡️🍊⚡️\n${order.description}\n#P2PLN\n\nPara tomar esta orden, debes marcar al bot @p2plnbot el comando 👇`;
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
    const publishMessage = `⚡️🍊⚡️\n${order.description}\n#P2PLN\n\nPara tomar esta orden, debes enviarle a @p2plnbot una lightning invoice con monto = ${order.amount} con el comando 👇`;
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
    await bot.telegram.sendMessage(process.env.CHANNEL, `El usuario @${initiatorUser.username} ha iniciado una disputa con @${counterPartyUser.username} en la orden id: ${order._id}`);
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
};
