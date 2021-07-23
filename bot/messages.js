const startMessage = async (ctx) => {
  await ctx.reply(`Este bot te ayudará a completar tus intercambios P2P usando Bitcoin vía Lightning Network.\n\n
    Es fácil:\n\n
    1. Únete al grupo @satoshienvenezuela.\n
    2. Publica tu oferta de compra o venta en el grupo, usando SIEMPRE el hashtag #P2PLN.\n
    3. Tu oferta o calificación estará visible en el canal @SEVLIGHTNING.\n\n
    ¡Intercambia seguro y rápido!\n\n
    Support: @franklinzerocr`);
};

const initBotErrorMessage = async (ctx) => {
  await ctx.reply(`Debes primero inicializar este bot @p2plnbot para poder realizar operaciones`);
};

const invoicePaymentRequestMessage = async (bot, user, request) => {
  await bot.telegram.sendMessage(user.tg_id, `Por favor paga esta invoice para comenzar la venta:`);
  await bot.telegram.sendMessage(user.tg_id, `${request}`);
};

const pendingSellMessage = async (bot, user) => {
  await bot.telegram.sendMessage(user.tg_id, `Invoice pagado y publicada la oferta en el canal ${process.env.CHANNEL}\n\nEspera que alguien tome tu venta.`);
};

const pendingBuyMessage = async (bot, user) => {
  await bot.telegram.sendMessage(user.tg_id, `Publicada la oferta en el canal ${process.env.CHANNEL}.\n\nEspera que alguien tome tu compra.`);
};

const sellOrderCorrectFormatMessage = async (bot, user) => {
  await bot.telegram.sendMessage(user.tg_id, `/sell <monto_en_sats> <monto_en_fiat> <codigo_fiat> <método_de_pago>`);
};

const buyOrderCorrectFormatMessage = async (bot, user) => {
  await bot.telegram.sendMessage(user.tg_id, `/buy <monto_en_sats> <monto_en_fiat> <codigo_fiat> <método_de_pago> <lightning_invoice>`);
};

const minimunAmountInvoiceMessage = async (bot, user) => {
  await bot.telegram.sendMessage(user.tg_id, `La invoice debe ser mayor o igual a 100 satoshis`);
};

const amountMustTheSameInvoiceMessage = async (bot, user, amount) => {
  await bot.telegram.sendMessage(user.tg_id, `La invoice tener un monto igual a ${amount} sats`);
};

const minimunExpirationTimeInvoiceMessage = async (bot, user) => {
  await bot.telegram.sendMessage(user.tg_id, `El tiempo de expiración de la invoice debe ser de al menos 1 hora`);
};

const expiredInvoiceMessage = async (bot, user) => {
  await bot.telegram.sendMessage(user.tg_id, `La invoice ha expirado`);
};

const requiredAddressInvoiceMessage = async (bot, user) => {
  await bot.telegram.sendMessage(user.tg_id, `La invoice necesita una dirección destino`);
};

const requiredHashInvoiceMessage = async (bot, user) => {
  await bot.telegram.sendMessage(user.tg_id, `La invoice necesita un hash`);
};

const invalidOrderMessage = async (bot, user) => {
  await bot.telegram.sendMessage(user.tg_id, `Código de orden incorrecto`);
};

const invalidTypeOrderMessage = async (bot, user, type) => {
  await bot.telegram.sendMessage(user.tg_id, `Esta orden es una ${type}`);
};

const alreadyTakenOrderMessage = async (bot, user) => {
  await bot.telegram.sendMessage(user.tg_id, `Esta orden ya ha sido tomada por otro usuario`);
};

const invalidDataMessage = async (bot, user) => {
  await bot.telegram.sendMessage(user.tg_id, `Haz enviado datos incorrectos, inténtalo nuevamente.`);
};

const takeSellCorrectFormatMessage = async (bot, user) => {
  await bot.telegram.sendMessage(user.tg_id, `/takesell <order_id> <lightning_invoice>`);
};

const takeBuyCorrectFormatMessage = async (bot, user) => {
  await bot.telegram.sendMessage(user.tg_id, `/takebuy <order_id>`);
};

const beginTakeBuyMessage = async (bot, orderUser, sellerUser, request, order) => {
  await bot.telegram.sendMessage(sellerUser.tg_id, `Por favor paga esta invoice al bot para comenzar tu venta con el comprador:`);
  await bot.telegram.sendMessage(sellerUser.tg_id, `${request}`);

  await bot.telegram.editMessageText(process.env.CHANNEL, order.tg_channel_message2, null, `${order._id} procesada ✅`);
  if (order.tg_chat_id < 0) await bot.telegram.editMessageText(order.tg_chat_id, order.tg_group_message2, null, `${order._id} procesada ✅`);
};

const onGoingTakeBuyMessage = async (bot, orderUser, sellerUser, order) => {
  await bot.telegram.sendMessage(sellerUser.tg_id, `Pago recibido!\n\nPonte en contacto con el usuario @${orderUser.username} para darle los detalles de metodo de pago FIAT que te hara. Una vez confirmes su pago FIAT debes liberar los fondos con el comando:`);
  await bot.telegram.sendMessage(sellerUser.tg_id, `/release ${order._id}`);
  await bot.telegram.sendMessage(orderUser.tg_id, `El usuario @${sellerUser.username} ha tomado tu compra y te quiere vender sats. Comunicate con el para que le hagas el pago por FIAT y te libere sus sats. `);
};

const doneTakeBuyMessage = async (bot, orderUser, sellerUser) => {
  await bot.telegram.sendMessage(sellerUser.tg_id, `Confirmaste el pago FIAT del comprador @${orderUser.username} y has vendido exitosamente tus sats\n⚡️🍊⚡️`);
  await bot.telegram.sendMessage(orderUser.tg_id, `Tu compra de sats ha sido completada exitosamente con @${sellerUser.username} tras confirmar tu pago FIAT y ya he pagado tu invoice,  que disfrutes tus sats\n⚡️🍊⚡️`);
};

const beginTakeSellMessage = async (bot, orderUser, buyerUser, order) => {
  await bot.telegram.sendMessage(buyerUser.tg_id, `Ponte en contacto con el usuario @${orderUser.username} para que te de detalle de como enviarle el dinero fiat.\n\nCuando el usuario @${orderUser.username} confirme que recibió tu pago FIAT, estaré liberando tus sats.`);
  await bot.telegram.sendMessage(orderUser.tg_id, `El usuario @${buyerUser.username} ha tomado tu venta y te quiere comprar sats. Comunicate con el usuario para que te haga el pago por FIAT.\n\nUna vez confirmes su pago FIAT debes liberar los fondos con el comando:`);
  await bot.telegram.sendMessage(orderUser.tg_id, `/release ${order._id}`);

  await bot.telegram.editMessageText(process.env.CHANNEL, order.tg_channel_message2, null, `${order._id} procesada ✅`);
  if (order.tg_chat_id < 0) await bot.telegram.editMessageText(order.tg_chat_id, order.tg_group_message2, null, `${order._id} procesada ✅`);
};

const doneTakeSellMessage = async (bot, orderUser, buyerUser) => {
  await bot.telegram.sendMessage(buyerUser.tg_id, `El vendedor @${orderUser.username} nos indicó que recibió tu pago FIAT y he pagado tu invoice, que disfrutes tus sats\n⚡️🍊⚡️`);
  await bot.telegram.sendMessage(orderUser.tg_id, `Tu venta de sats ha sido completada tras confirmar el pago FIAT de  @${buyerUser.username}\n⚡️🍊⚡️`);
};

const releaseCorrectFormatMessage = async (bot, user) => {
  await bot.telegram.sendMessage(user.tg_id, `/release [order_id]>`);
};

const notActiveOrderMessage = async (bot, user) => {
  await bot.telegram.sendMessage(user.tg_id, `No tienes esa orden activa`);
};

const repeatedInvoiceMessage = async (bot, user) => {
  await bot.telegram.sendMessage(user.tg_id, `Esa invoice ya se encuentra usada en el sistema`);
};

const publishBuyOrderMessage = async (ctx, bot, order) => {
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
};

const publishSellOrderMessage = async (ctx, bot, order) => {
  const publishMessage = `⚡️🍊⚡️\n${order.description}\n#P2PLN\n\nPara tomar esta orden, debes marcar al bot @p2plnbot el comando 👇`;
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
};
