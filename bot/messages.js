const { TelegramError } = require('telegraf');
const { plural, getCurrency } = require('../util');

const startMessage = async (ctx) => {
  try {
    const orderExpiration = parseInt(process.env.ORDER_EXPIRATION_WINDOW) / 60;
    let message = ctx.i18n.t('start', { orderExpiration, channel: process.env.CHANNEL });
    await ctx.reply(message);
  } catch (error) {
    console.log(error);
  }
};

const initBotErrorMessage = async (ctx) => {
  try {
    await ctx.reply(ctx.i18n.t('init_bot_error'));
  } catch (error) {
    // Ignore TelegramError - Forbidden request
    if (!(error instanceof TelegramError && error.response.error_code == 403)) {
      console.log(error);
    }
  }
};

const nonHandleErrorMessage = async (ctx) => {
  try {
    await ctx.reply(ctx.i18n.t('non_handle_error'));
  } catch (error) {
    console.log(error);
  }
};

const invoicePaymentRequestMessage = async (ctx, bot, user, request, order) => {
  try {
    const currency = getCurrency(order.fiat_code);
    const expirationTime = parseInt(process.env.HOLD_INVOICE_EXPIRATION_WINDOW) / 60;
    let message = ctx.i18n.t('invoice_payment_request', {
      currency,
      order,
      expirationTime,
    });
    await bot.telegram.sendMessage(user.tg_id, message);
    await bot.telegram.sendMessage(user.tg_id, request);
  } catch (error) {
    console.log(error);
  }
};

const pendingSellMessage = async (ctx, bot, user, order) => {
  try {
    let orderExpirationWindow = process.env.ORDER_PUBLISHED_EXPIRATION_WINDOW / 60 / 60;
    await bot.telegram.sendMessage(user.tg_id, ctx.i18n.t('pending_sell', {
      channel: process.env.CHANNEL,
      orderExpirationWindow: Math.round(orderExpirationWindow),
    }));
    await bot.telegram.sendMessage(user.tg_id, ctx.i18n.t('cancel_order_cmd', { order }));
  } catch (error) {
    console.log(error);
  }
};

const pendingBuyMessage = async (ctx, bot, user, order) => {
  try {
    let orderExpirationWindow = process.env.ORDER_PUBLISHED_EXPIRATION_WINDOW / 60 / 60;
    await bot.telegram.sendMessage(user.tg_id, ctx.i18n.t('pending_buy', {
      channel: process.env.CHANNEL,
      orderExpirationWindow: Math.round(orderExpirationWindow),
    }));
    await bot.telegram.sendMessage(user.tg_id, `/cancel ${order._id}`);
  } catch (error) {
    console.log(error);
  }
};

const mustBeIntMessage = async (ctx, fieldName) => {
  try {
    await ctx.reply(ctx.i18n.t('must_be_int', { fieldName }));
  } catch (error) {
    console.log(error);
  }
};

const sellOrderCorrectFormatMessage = async (ctx) => {
  try {
    await ctx.reply(ctx.i18n.t('sell_correct_format'), { parse_mode: "MarkdownV2" });
  } catch (error) {
    console.log(error);
  }
};

const buyOrderCorrectFormatMessage = async (ctx) => {
  try {
    await ctx.reply(ctx.i18n.t('buy_correct_format'), { parse_mode: "MarkdownV2" });
  } catch (error) {
    console.log(error);
  }
};

const minimunAmountInvoiceMessage = async (ctx) => {
  try {
    await ctx.reply(ctx.i18n.t('min_invoice_amount', { minPaymentAmount: process.env.MIN_PAYMENT_AMT}));
  } catch (error) {
    console.log(error);
  }
};

const minimunExpirationTimeInvoiceMessage = async (ctx) => {
  try {
    const expirationTime = parseInt(INVOICE_EXPIRATION_WINDOW) / 60 / 1000;
    await ctx.reply(ctx.i18n.t('min_expiration_time', { expirationTime }));
  } catch (error) {
    console.log(error);
  }
};

const expiredInvoiceMessage = async (ctx) => {
  try {
    await ctx.reply(ctx.i18n.t('invoice_expired'));
  } catch (error) {
    console.log(error);
  }
};

// FIXME: We need to pass the context to the function to use the i18n
const expiredInvoiceOnPendingMessage = async (bot, user, order) => {
  try {
    let message = `La factura ha expirado.\n\n`;
    message += `Si deseas puedes enviarme una nueva factura para recibir los satoshis con el comando 👇`;
    await bot.telegram.sendMessage(user.tg_id, message);
    await bot.telegram.sendMessage(user.tg_id, `/setinvoice ${order._id} <_factura lightning_>`, { parse_mode: "MarkdownV2" });
  } catch (error) {
    console.log(error);
  }
};

const requiredAddressInvoiceMessage = async (ctx) => {
  try {
    await ctx.reply(ctx.i18n.t('invoice_require_destination'));
  } catch (error) {
    console.log(error);
  }
};

const requiredHashInvoiceMessage = async (ctx) => {
  try {
    await ctx.reply(ctx.i18n.t('invoice_require_hash'));
  } catch (error) {
    console.log(error);
  }
};

const invalidOrderMessage = async (ctx, bot, user) => {
  try {
    await bot.telegram.sendMessage(user.tg_id, ctx.i18n.t('order_id_invalid'));
  } catch (error) {
    console.log(error);
  }
};

const invalidTypeOrderMessage = async (ctx, bot, user, type) => {
  try {
    await bot.telegram.sendMessage(user.tg_id, ctx.i18n.t('order_invalid_type', { type }));
  } catch (error) {
    console.log(error);
  }
};

const alreadyTakenOrderMessage = async (ctx, bot, user) => {
  try {
    await bot.telegram.sendMessage(user.tg_id, ctx.i18n.t('order_already_taken'));
  } catch (error) {
    console.log(error);
  }
};

const invalidDataMessage = async (bot, user) => {
  try {
    await bot.telegram.sendMessage(user.tg_id, `Has enviado datos incorrectos, inténtalo nuevamente.`);
  } catch (error) {
    console.log(error);
  }
};

const beginTakeBuyMessage = async (bot, seller, order) => {
  try {
    const expirationTime = parseInt(process.env.HOLD_INVOICE_EXPIRATION_WINDOW) / 60;
    let message = `🤖 Presiona continuar para tomar la oferta, si presionas cancelar te desvincularé `;
    message += `de la orden y será publicada nuevamente, tienes ${expirationTime} minutos o la orden expirará 👇`
    await bot.telegram.sendMessage(seller.tg_id, message);
    await bot.telegram.sendMessage(seller.tg_id, order._id, {
      reply_markup: {
        inline_keyboard: [
          [
            {text: 'Continuar', callback_data: 'showHoldInvoiceBtn'},
            {text: 'Cancelar', callback_data: 'cancelShowHoldInvoiceBtn'},
          ],
        ],
      },
    });
  } catch (error) {
    console.log(error);
  }
};

const showHoldInvoiceMessage = async (bot, seller, request) => {
  try {
    await bot.telegram.sendMessage(seller.tg_id, `Por favor paga esta factura para comenzar tu venta`);
    await bot.telegram.sendMessage(seller.tg_id, `${request}`);
  } catch (error) {
    console.log(error);
  }
};

const onGoingTakeBuyMessage = async (bot, seller, buyer, order) => {
  try {
    const currency = getCurrency(order.fiat_code);
    let messageSeller = `🤖 ¡Pago recibido!\n\n`;
    messageSeller += `Ahora necesitamos que el comprador me envíe una factura para enviarle los satoshis, `
    messageSeller += `luego de que el comprador me indique su factura los pondré en contacto`;
    await bot.telegram.sendMessage(seller.tg_id, messageSeller);
    let messageBuyer = `🤖 Alguien ha tomado tu compra y ya me envió tus sats, presiona el botón para continuar 👇`;
    await bot.telegram.sendMessage(buyer.tg_id, messageBuyer);
    await bot.telegram.sendMessage(buyer.tg_id, order._id, {
      reply_markup: {
        inline_keyboard: [
          [{text: 'Continuar', callback_data: 'addInvoiceBtn'}],
        ],
      },
    });
  } catch (error) {
    console.log(error);
  }
};


const beginTakeSellMessage = async (bot, buyer, order) => {
  try {
    await bot.telegram.sendMessage(buyer.tg_id, `Has tomado esta venta, presiona el botón para continuar 👇`);
    await bot.telegram.sendMessage(buyer.tg_id, order._id, {
      reply_markup: {
        inline_keyboard: [
          [
            {text: 'Continuar', callback_data: 'addInvoiceBtn'},
            {text: 'Cancelar', callback_data: 'cancelAddInvoiceBtn'},
          ],
        ],
      },
    });
  } catch (error) {
    console.log(error);
  }
};

const onGoingTakeSellMessage = async (bot, sellerUser, buyerUser, order) => {
  try {
    const currency = getCurrency(order.fiat_code);
    let message = `Ponte en contacto con el usuario @${sellerUser.username} para que te de detalle de como `;
    message += `enviarle el dinero, debes enviarle ${currency.symbol_native} ${order.fiat_amount} por `
    message += `${order.payment_method}.\n\n`;
    message += `Una vez hayas enviado el dinero fiat hazmelo saber con el comando 👇`;
    await bot.telegram.sendMessage(buyerUser.tg_id, message);
    await bot.telegram.sendMessage(buyerUser.tg_id, `/fiatsent ${order._id}`);
    await bot.telegram.sendMessage(sellerUser.tg_id, `@${buyerUser.username} ha tomado tu venta y te quiere comprar sats. Escríbele para que te envíe ${currency.symbol_native} ${order.fiat_amount} por ${order.payment_method}.\n\nUna vez confirmes la recepción del dinero debes liberar los fondos`);
  } catch (error) {
    console.log(error);
  }
};

const takeSellWaitingSellerToPayMessage = async (bot, buyerUser, order) => {
  try {
    await bot.telegram.sendMessage(buyerUser.tg_id, `Le he enviado una solicitud de pago al vendedor para que nos envíe tus sats por la orden #${order._id}, en cuanto realice el pago los pondremos en contacto`);
  } catch (error) {
    console.log(error);
  }
};

const releasedSatsMessage = async (bot, sellerUser, buyerUser) => {
  try {
    await bot.telegram.sendMessage(sellerUser.tg_id, `Tu venta de sats ha sido completada tras confirmar el pago de @${buyerUser.username}\n⚡️🍊⚡️`);
    await bot.telegram.sendMessage(buyerUser.tg_id, `🕐 @${sellerUser.username} ya liberó los satoshis, debes esperar por el pago de tu factura, recuerda que para recibir en lightning tu wallet debe estar online`);
  } catch (error) {
    console.log(error);
  }
};

const rateUserMessage = async (bot, caller, order) => {
  try {
    const starButtons = []
    for (let num = 5; num > 0; num--) {
      starButtons.push([{text: '⭐'.repeat(num), callback_data: `showStarBtn(${num},${order._id})`}])
    }
    await bot.telegram.sendMessage(caller.tg_id, `Califica a tu contraparte:`, {
      reply_markup: {
        inline_keyboard: starButtons,
      },
    });
  } catch (error) {
    console.log(error);
  }
};

const notActiveOrderMessage = async (bot, user) => {
  try {
    await bot.telegram.sendMessage(user.tg_id, `Esta orden no puede ser procesada, asegúrate de que el Id es correcto`);
  } catch (error) {
    console.log(error);
  }
};

const waitingForBuyerOrderMessage = async (bot, user) => {
  try {
    await bot.telegram.sendMessage(user.tg_id, `Esta orden no puede ser liberada, el comprador no me ha indicado la factura para recibir los sats`);
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
    await bot.telegram.sendMessage(user.tg_id, `Esa factura ya se encuentra usada en el sistema`);
  } catch (error) {
    console.log(error);
  }
};

const publishBuyOrderMessage = async (bot, order) => {
  try {
    let publishMessage = `⚡️🍊⚡️\n${order.description}\n`;
    publishMessage += `Para tomar esta orden 👇`;

    // Mensaje al canal
    const message1 = await bot.telegram.sendMessage(process.env.CHANNEL, publishMessage);
    const message2 = await bot.telegram.sendMessage(process.env.CHANNEL, order._id, {
      reply_markup: {
        inline_keyboard: [
          [{text: 'Vender satoshis', callback_data: 'takebuy'}],
        ],
      },
    });
    // Mensaje al canal
    order.tg_channel_message1 = message1 && message1.message_id ? message1.message_id : null;
    order.tg_channel_message2 = message2 && message2.message_id ? message2.message_id : null;

    await order.save();
  } catch (error) {
    console.log(error);
  }
};

const publishSellOrderMessage = async (bot, order) => {
  try {
    let publishMessage = `⚡️🍊⚡️\n${order.description}\n`;
    publishMessage += `Para tomar esta orden 👇`;
    const message1 = await bot.telegram.sendMessage(process.env.CHANNEL, publishMessage);
    const message2 = await bot.telegram.sendMessage(process.env.CHANNEL, order._id, {
      reply_markup: {
        inline_keyboard: [
          [{text: 'Comprar satoshis', callback_data: 'takesell'}],
        ],
      },
    });
    // Mensaje al canal
    order.tg_channel_message1 = message1 && message1.message_id ? message1.message_id : null;
    order.tg_channel_message2 = message2 && message2.message_id ? message2.message_id : null;

    await order.save();
  } catch (error) {
    console.log(error);
  }
};

const getDetailedOrder = (ctx, order, buyer, seller) => {
  try {
    const buyerUsername = buyer ? buyer.username : '';
    const sellerUsername = seller ? seller.username : '';
    const buyerId = buyer ? buyer._id : '';
    const creator = order.creator_id == buyerId ? buyerUsername : sellerUsername;
    let message = ctx.i18n.t('order_detail', {
      order,
      creator,
      buyerUsername,
      sellerUsername,
    });

    return message;
  } catch (error) {
    console.log(error);
  }
};

const beginDisputeMessage = async (bot, buyer, seller, order, initiator) => {
  try {

    const type = initiator === 'seller' ? 'vendedor' : 'comprador';
    let initiatorUser = buyer;
    let counterPartyUser = seller;
    if (initiator === 'seller') {
      initiatorUser = seller;
      counterPartyUser = buyer;
    }
    let message = `El ${type} @${initiatorUser.username} `;
    message += `ha iniciado una disputa con @${counterPartyUser.username} en la orden:\n\n`;
    message += `${getDetailedOrder(ctx, order, buyer, seller)}\n\n`;
    message += `@${initiatorUser.username} ya tiene ${initiatorUser.disputes} disputa${plural(initiatorUser.disputes)}\n`;
    message += `@${counterPartyUser.username} ya tiene ${counterPartyUser.disputes} disputa${plural(counterPartyUser.disputes)}`;
    await bot.telegram.sendMessage(process.env.ADMIN_CHANNEL, message);

    if (initiator === 'buyer') {
      await bot.telegram.sendMessage(initiatorUser.tg_id, `Has iniciado una disputa por tu compra, nos comunicaremos contigo y tu contraparte para resolverla`);
      await bot.telegram.sendMessage(counterPartyUser.tg_id, `El comprador ha iniciado una disputa por tu orden con id: #${order._id}, nos comunicaremos contigo y tu contraparte para resolverla`);
    } else {
      await bot.telegram.sendMessage(initiatorUser.tg_id, `Has iniciado una disputa por tu venta, nos comunicaremos contigo y tu contraparte para resolverla`);
      await bot.telegram.sendMessage(counterPartyUser.tg_id, `El vendedor ha iniciado una disputa por tu orden con id: #${order._id}, nos comunicaremos contigo y tu contraparte para resolverla`);
    }
  } catch (error) {
    console.log(error);
  }
};

const customMessage = async (bot, user, message) => {
  try {
    await bot.telegram.sendMessage(user.tg_id, message, { parse_mode: "MarkdownV2"});
  } catch (error) {
    console.log(error);
  }
};

const checkOrderMessage = async (ctx, order, buyer, seller) => {
  try {
    let message = getDetailedOrder(ctx, order, buyer, seller);
    message += `\n\n`;
    await ctx.reply(message);
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

const mustBeANumberOrRange = async (bot, user, fieldName) => {
  try {
    const invalidFiatAmountMessage = (
      `${fieldName} debe ser un número o un rango numerico de la forma: <mínimo>-<máximo>.`
    );
    await bot.telegram.sendMessage(user.tg_id, invalidFiatAmountMessage);
  } catch (error) {
    console.log(error);
  }
};

const invalidLightningAddress = async (bot, user) => {
  try {
    await bot.telegram.sendMessage(user.tg_id, `Dirección lightning no válida`);
  } catch (error) {
    console.log(error);
  }
};

const unavailableLightningAddress = async (bot, user,la) => {
  try {
    await bot.telegram.sendMessage(user.tg_id, `Dirección lightning ${la} no disponible`);
  } catch (error) {
    console.log(error);
  }
};

const invalidInvoice = async (bot, user) => {
  try {
    await bot.telegram.sendMessage(user.tg_id, `Factura lightning no válida`);
  } catch (error) {
    console.log(error);
  }
};

const helpMessage = async (ctx) => {
  try {
    let message = `/sell <_monto en sats_> <_monto en fiat_> <_código fiat_> <_método de pago_> [prima/descuento] - Crea una orden de venta\n`;
    message += `/buy <_monto en sats_> <_monto en fiat_> <_código fiat_> <_método de pago_> [prima/descuento] - Crea una orden de compra\n`;
    message += `/info - Muestra información sobre el bot\n`;
    message += `/showusername - Permite mostrar u ocultar el username en cada nueva orden creada, el valor predeterminado es no (falso)\n`;
    message += `/showvolume - Permite mostrar el volumen de comercio en cada nueva orden creada, el valor predeterminado es no (falso)\n`;
    message += `/setinvoice <_order id_> <_factura lightning_> - Le permite al comprador actualizar la factura lightning en la que recibirá sats\n`;
    message += `/setaddress <_lightning address / off_> - Permite al comprador indicar una dirección de pago estática (lightning address), _off_ para desactivarla\n`;
    message += `/listorders - El usuario puede listar sus órdenes no finalizadas\n`;
    message += `/listcurrencies - Lista las monedas que podemos utilizar sin indicar el monto en satoshis\n`;
    message += `/fiatsent <_order id_> - El comprador indica que ya ha enviado el dinero Fiat al vendedor\n`;
    message += `/release <_order id_> - El vendedor libera los satoshis\n`;
    message += `/dispute <_order id_> - Abre una disputa entre los participantes\n`;
    message += `/cancel <_order id_> - Cancela una orden que no ha sido tomada\n`;
    message += `/cooperativecancel <_order id_> - Inicia una cancelación cooperativa, ambas partes deben ejecutar este comando para cancelar una orden activa\n`;
    message += `/help - Mensaje de ayuda`;
    await ctx.reply(message, { parse_mode: 'Markdown' });
  } catch (error) {
    console.log(error);
  }
};

const mustBeGreatherEqThan = async (bot, user, fieldName, qty) => {
  try {
    await bot.telegram.sendMessage(user.tg_id, `${fieldName} debe ser mayor o igual que ${qty}`);
  } catch (error) {
    console.log(error);
  }
};

const bannedUserErrorMessage = async (ctx) => {
  try {
    await ctx.reply(`¡Has sido baneado!`);
  } catch (error) {
    console.log(error);
  }
};

const fiatSentMessages = async (bot, buyer, seller, order) => {
  try {
    await bot.telegram.sendMessage(buyer.tg_id, `🤖 Le avisé a @${seller.username} que has enviado el dinero fiat, cuando el vendedor confirme que recibió tu dinero deberá liberar los fondos`);
    await bot.telegram.sendMessage(seller.tg_id, `🤖 @${buyer.username} me ha indicado que ya te envió el dinero fiat, una vez confirmes la recepción del dinero por favor libera los fondos, debes saber que hasta que no liberes los fondos no podrás crear o tomar otra orden`);
    await bot.telegram.sendMessage(seller.tg_id, `/release ${order._id}`);
  } catch (error) {
    console.log(error);
  }
};


const orderOnfiatSentStatusMessages = async (bot, user) => {
  try {
    await bot.telegram.sendMessage(user.tg_id, `🤖 Tienes una o más ordenes en las que el comprador indicó que te envió el dinero fiat pero no has liberado los fondos, no puedes seguir operando hasta completar esa(s) orden(es)`);
  } catch (error) {
    console.log(error);
  }
};

const userBannedMessage = async (bot, user) => {
  try {
    await bot.telegram.sendMessage(user.tg_id, `¡Usuario baneado!`);
  } catch (error) {
    console.log(error);
  }
};

const notFoundUserMessage = async (bot, user) => {
  try {
    await bot.telegram.sendMessage(user.tg_id, `¡Usuario no encontrado en base de datos!`);
  } catch (error) {
    console.log(error);
  }
};

const errorParsingInvoiceMessage = async (ctx) => {
  try {
    ctx.reply(ctx.i18n.t('parse_invoice_error'));
  } catch (error) {
    console.log(error);
  }
};

const notValidIdMessage = async (bot, user) => {
  try {
    await bot.telegram.sendMessage(user.tg_id, `Id no válida`);
  } catch (error) {
    console.log(error);
  }
};

const addInvoiceMessage = async (bot, buyer, seller, order) => {
  try {
    const currency = getCurrency(order.fiat_code);
    const symbol = (!!currency && !!currency.symbol_native) ? currency.symbol_native : order.fiat_code;
    let message = `🤖 He recibido tu factura, ponte en contacto con @${seller.username} para que te indique `;
    message += `como enviarle ${symbol} ${order.fiat_amount}\n\n`;
    message += `En cuanto hayas enviado el dinero fiat hazmelo saber con el comando 👇`;
    await bot.telegram.sendMessage(buyer.tg_id, message);
    await bot.telegram.sendMessage(buyer.tg_id, `/fiatsent ${order._id}`);
  } catch (error) {
    console.log(error);
  }
};

const sendBuyerInfo2SellerMessage = async (bot, buyer, seller, order) => {
  try {
    const currency = getCurrency(order.fiat_code);
    await bot.telegram.sendMessage(seller.tg_id, `🤖 Ponte en contacto con @${buyer.username} para darle la información sobre cómo enviarte ${currency.symbol_native} ${order.fiat_amount} por ${order.payment_method}. NO liberes los fondos hasta que no verifiques que @${buyer.username} te envió el dinero fiat`);
  } catch (error) {
    console.log(error);
  }
};

const genericErrorMessage = async (bot, user) => {
  try {
    await bot.telegram.sendMessage(user.tg_id, `¡Ha ocurrido un error, intenta nuevamente!`);
  } catch (error) {
    console.log(error);
  }
};

const cantTakeOwnOrderMessage = async (bot, user) => {
  try {
    await bot.telegram.sendMessage(user.tg_id, `No puedes tomar tu propia orden`);
  } catch (error) {
    console.log(error);
  }
};

const notLightningInvoiceMessage = async (bot, user, order) => {
  try {
    await bot.telegram.sendMessage(user.tg_id, `Por favor envíame una factura lightning por ${order.amount} sats`);
    await bot.telegram.sendMessage(user.tg_id, `/setinvoice ${order._id} <_lightning_invoice_>`);
  } catch (error) {
    console.log(error);
  }
};

const notOrdersMessage = async (bot, user) => {
  try {
    await bot.telegram.sendMessage(user.tg_id, `No tienes ninguna orden en este momento`);
  } catch (error) {
    console.log(error);
  }
};

const listOrdersResponse = async (bot, user, orders) => {
  try {
    let response = `.             Id          |     Status    |   amount (sats)  |  fiat amt  |  fiat\n`;
    orders.forEach(order => {
      let fiatAmount = '-';
      let amount = '-';
      if (typeof order.fiat_amount != 'undefined') fiatAmount = order.fiat_amount;
      if (typeof order.amount != 'undefined') amount = order.amount;
      response += `${order._id} | ${order.status} | ${amount} | ${fiatAmount} | ${order.fiat_code}\n`;
    });
    await bot.telegram.sendMessage(user.tg_id, response);
  } catch (error) {
    console.log(error);
  }
};

const notRateForCurrency = async (bot, user) => {
  try {
    let message = `${process.env.FIAT_RATE_NAME} no tiene tasa de cambio para esta moneda fiat\n\n`;
    message += `Para utilizar esta moneda debes indicar la cantidad de satoshis\n\n`;
    message += `Si quieres que esta moneda sea incluida en la lista /listcurrencies puedes hacerles una solicitud aquí 👇\n\n`;
    message += `🌐 https://yadio.io/api.html`;
    await bot.telegram.sendMessage(user.tg_id, message);
  } catch (error) {
    console.log(error);
  }
};

const incorrectAmountInvoiceMessage = async (ctx) => {
  try {
    await ctx.reply(`La factura tiene un monto incorrecto`);
  } catch (error) {
    console.log(error);
  }
};

const invoiceUpdatedMessage = async (bot, user) => {
  try {
    await bot.telegram.sendMessage(user.tg_id, `¡La factura ha sido actualizada correctamente!`);
  } catch (error) {
    console.log(error);
  }
};

const invoiceUpdatedPaymentWillBeSendMessage = async (bot, user) => {
  try {
    await bot.telegram.sendMessage(user.tg_id, `¡La factura ha sido actualizada correctamente y será pagada en los próximos segundos!`);
  } catch (error) {
    console.log(error);
  }
};

const invoiceAlreadyUpdatedMessage = async (bot, user) => {
  try {
    await bot.telegram.sendMessage(user.tg_id, `Ya has enviado una factura para esta orden y estoy intentando pagarla en este momento`);
  } catch (error) {
    console.log(error);
  }
};
const successSetAddress = async (bot, user) => {
  try {
    await bot.telegram.sendMessage(user.tg_id, `Dirección lightning guardada con éxito`);
  } catch (error) {
    console.log(error);
  }
};

const badStatusOnCancelOrderMessage = async (bot, user) => {
  try {
    let message = `Esta opción solo permite cancelar las ordenes que no han sido tomadas, `;
    message += `si lo deseas puedes intentar una cancelación cooperativa con /cooperativecancel`;
    await bot.telegram.sendMessage(user.tg_id, message);
  } catch (error) {
    console.log(error);
  }
};

const successCancelOrderMessage = async (bot, user, order, sendRefundMessage) => {
  try {
    await bot.telegram.sendMessage(user.tg_id, `¡Has cancelado la orden Id: #${order._id}!`);
    if (order.seller_id == user._id && !!sendRefundMessage) {
      await refundCooperativeCancelMessage(bot, user);
    }
  } catch (error) {
    console.log(error);
  }
};

const successCancelAllOrdersMessage = async (bot, user) => {
  try {
    await bot.telegram.sendMessage(user.tg_id, `¡Has cancelado todas tus órdenes publicadas!`);
  } catch (error) {
    console.log(error);
  }
};

const successCancelOrderByAdminMessage = async (bot, user, order) => {
  try {
    await bot.telegram.sendMessage(user.tg_id, `¡El admin ha cancelado la orden Id: #${order._id}!`);
  } catch (error) {
    console.log(error);
  }
};

const successCompleteOrderMessage = async (bot, user, order) => {
  try {
    await bot.telegram.sendMessage(user.tg_id, `¡Has completado la orden Id: #${order._id}!`);
  } catch (error) {
    console.log(error);
  }
};

const successCompleteOrderByAdminMessage = async (bot, user, order) => {
  try {
    await bot.telegram.sendMessage(user.tg_id, `¡El admin ha completado la orden Id: #${order._id}!`);
  } catch (error) {
    console.log(error);
  }
};

const cantCooperativeCancelMessage = async (bot, user) => {
  try {
    await bot.telegram.sendMessage(user.tg_id, `Esta orden no puede ser cancelada cooperativamente`);
  } catch (error) {
    console.log(error);
  }
};

const shouldWaitCooperativeCancelMessage = async (bot, user) => {
  try {
    await bot.telegram.sendMessage(user.tg_id, `Ya has realizado esta operación, debes esperar por tu contraparte`);
  } catch (error) {
    console.log(error);
  }
};

const okCooperativeCancelMessage = async (bot, user, order) => {
  try {
    await bot.telegram.sendMessage(user.tg_id, `Tu contraparte ha estado de acuerdo y ha sido cancelada la orden Id: #${order._id}`);
    if (order.seller_id == user._id) {
      await refundCooperativeCancelMessage(bot, user);
    }
  } catch (error) {
    console.log(error);
  }
};

const refundCooperativeCancelMessage = async (bot, user) => {
  try {
    await bot.telegram.sendMessage(user.tg_id, `Has recibido un reembolso por tu pago lightning, no es necesario hacer nada mas`);
  } catch (error) {
    console.log(error);
  }
};

const initCooperativeCancelMessage = async (bot, user, order) => {
  try {
    await bot.telegram.sendMessage(user.tg_id, `Has iniciado la cancelación de la orden Id: #${order._id}, tu contraparte también debe indicarme que desea cancelar la orden`);
  } catch (error) {
    console.log(error);
  }
};

const counterPartyWantsCooperativeCancelMessage = async (bot, user, order) => {
  try {
    await bot.telegram.sendMessage(user.tg_id, `Tu contraparte quiere cancelar la orden Id: #${order._id}, si estás de acuerdo utiliza el comando 👇`);
    await bot.telegram.sendMessage(user.tg_id, `/cooperativecancel ${order._id}`);
  } catch (error) {
    console.log(error);
  }
};

const invoicePaymentFailedMessage = async (bot, user) => {
  try {
    await bot.telegram.sendMessage(user.tg_id, `⛔ Intenté enviarte el dinero pero el pago a tu factura ha fallado, intentaré pagarla 3 veces más en intervalos de ${process.env.PENDING_PAYMENT_WINDOW} minutos, asegúrate que tu nodo/wallet esté online`);
  } catch (error) {
    console.log(error);
  }
};

const showUsernameErrorMessage = async (bot, user) => {
  try {
    await bot.telegram.sendMessage(user.tg_id, `Si quieres que tu username sea mostrado en la publicación debes colocar 'y' como último argumento`);
  } catch (error) {
    console.log(error);
  }
};

const successMessage = async (ctx) => {
  try {
    await ctx.reply(`¡Operación realizada exitósamente!`);
  } catch (error) {
    console.log(error);
  }
};

const userCantTakeMoreThanOneWaitingOrderMessage = async (bot, user) => {
  try {
    await bot.telegram.sendMessage(user.tg_id, `¡Lo siento! No puedes tomar otra orden mientras tengas otras esperando por ti`);
  } catch (error) {
    console.log(error);
  }
};

const sellerPaidHoldMessage = async (bot, user) => {
  try {
    await bot.telegram.sendMessage(user.tg_id, `El vendedor ya liberó los satoshis, debes esperar por el pago de tu factura`);
  } catch (error) {
    console.log(error);
  }
};

const showInfoMessage = async (bot, user, info) => {
  try {
    const status = !!info.public_key;
    const statusEmoji = status ? '🟢' : '🔴';
    let fee = (process.env.FEE * 100).toString();
    fee = fee.replace('.', '\\.');
    await bot.telegram.sendMessage(user.tg_id, `*Node status*: ${statusEmoji}\n*Bot fee*: ${fee}%`, { parse_mode: "MarkdownV2" });
    if (status) {
      await bot.telegram.sendMessage(user.tg_id, `*Node pubkey*: ${info.public_key}\n`, { parse_mode: "MarkdownV2" });
    }
  } catch (error) {
    console.log(error);
  }
};

const buyerReceivedSatsMessage = async (bot, buyerUser, sellerUser) => {
  try {
    await bot.telegram.sendMessage(buyerUser.tg_id, `Tu compra de sats ha sido completada exitosamente, @${sellerUser.username} ha confirmado tu pago fiat y ya he pagado tu factura, que disfrutes tus sats\n⚡️🍊⚡️`);
  } catch (error) {
    console.log(error);
  }
};

const listCurrenciesResponse = async (bot, user, currencies) => {
  try {
    let response = `Code |   Name   |\n`;
    currencies.forEach(currency => {
      response += `${currency.code} | ${currency.name} | ${currency.emoji}\n`;
    });
    await bot.telegram.sendMessage(user.tg_id, response);
  } catch (error) {
    console.log(error);
  }
};

const priceApiFailedMessage = async (bot, user) => {
  try {
    await bot.telegram.sendMessage(user.tg_id, `Ha ocurrido un problema obteniendo el precio de esta moneda, por favor intenta más tarde, si el problema persiste contacta a algún administrador`);
  } catch (error) {
    console.log(error);
  }
};

const updateUserSettingsMessage = async (bot, user, field, newState) => {
  try {
    await bot.telegram.sendMessage(user.tg_id, `He modificado el campo ${field} a ${newState}`);
  } catch (error) {
    console.log(error);
  }
};

const disableLightningAddress = async (bot, user) => {
  try {
    await bot.telegram.sendMessage(user.tg_id, `Lightning address desactivada`);
  } catch (error) {
    console.log(error);
  }
};

const invalidRangeWithAmount = async (bot, user) => {
  try {
    let rangeWithAmountMessage = `Los rangos solo estan habilitados para tasas flotantes.\n`
    rangeWithAmountMessage += `Utilice rangos o bien especifique la cantidad de sats, pero no ambas.`;
    await bot.telegram.sendMessage(user.tg_id, rangeWithAmountMessage);
  } catch (error) {
    console.log(error);
  }
};

const tooManyPendingOrdersMessage = async (bot, user) => {
  try {
    let message = `Has llegado al máximo de órdenes publicadas simultáneamente`;
    await bot.telegram.sendMessage(user.tg_id, message);
  } catch (error) {
    console.log(error);
  }
};

const listCommunitiesMessage = async (ctx, communities) => {
  try {
    let message = '';
    communities.forEach(community => {
      message += `ID: ${community.id}\n`;
      message += `Nombre: ${community.name}\n`;
      message += `Grupo: ${community.group}\n`;
      community.order_channels.forEach(channel => {
        message += `Canal ${channel.type}: ${channel.name}\n`;
      });
      community.solvers.forEach(solver => {
        message += `solver: ${solver.username}\n`;
      });
      message += `Pública: ${community.public ? 'Sí' : 'No'}\n`;
      message += `Creada: ${community.created_at}\n\n`;
    });
    await ctx.reply(message);
  } catch (error) {
    console.log(error);
  }
};

const wizardAddInvoiceInitMessage = async (bot, user, order, symbol, expirationTime) => {
  try {
    let message = `Para poder enviarte los satoshis necesito que me envíes una factura con monto ${order.amount} satoshis equivalente a ${symbol} ${order.fiat_amount}\n\n`;
    message += `Si no la envías en ${expirationTime} minutos la orden será cancelada`;

    await bot.telegram.sendMessage(user.tg_id, message);
  } catch (error) {
    console.log(error);
  }
};

const wizardAddInvoiceExitMessage = async (ctx, order) => {
  try {
    let message = `Has salido del modo wizard, ahora puedes escribir comandos, aún puedes `;
    message += `ingresar una factura a la orden con el comando /setinvoice indicando Id `;
    message += `de orden y factura, puedes enviarme una factura con un monto de `;
    message += `${order.amount} satoshis, pero tambien acepto facturas sin monto:\n\n`;
    message += `/setinvoice ${order._id} <factura lightning con o sin monto>`;

    await ctx.reply(message);
  } catch (error) {
    console.log(error);
  }
};

const wizardCommunityEnterNameMessage = async (ctx) => {
  try {
    await ctx.reply('Ingresa el nombre de tu comunidad:');
  } catch (error) {
    console.log(error);
  }
};

const wizardExitMessage = async (ctx) => {
  try {
    await ctx.reply('Has salido del modo wizard, ahora puedes escribir comandos.');
  } catch (error) {
    console.log(error);
  }
};

const orderExpiredMessage = async (ctx) => {
  try {
    await ctx.reply(`¡Esta orden ya expiró!`);
  } catch (error) {
    console.log(error);
  }
};

const cantAddInvoiceMessage = async (ctx) => {
  try {
    await ctx.reply(`¡Ya no puedes agregar una factura para esta orden!`);
  } catch (error) {
    console.log(error);
  }
};

const wizardCommunityTooLongNameMessage = async (ctx, length) => {
  try {
    await ctx.reply(`El nombre debe tener un máximo de ${length} caracteres.`);
  } catch (error) {
    console.log(error);
  }
};

const wizardCommunityEnterGroupMessage = async (ctx) => {
  try {
    let message = `Ingresa el id o el nombre del grupo de la comunidad, tanto el bot como `;
    message += `tú deben ser administradores del grupo:\n\n`;
    message += `P. ej: @MiComunidad`;
    await ctx.reply(message);
  } catch (error) {
    console.log(error);
  }
};

const wizardCommunityEnterOrderChannelsMessage = async (ctx) => {
  try {
    let message = `Las ofertas en tu comunidad deben publicarse en un canal de telegram, `;
    message += `si me indicas un canal tanto las compras como las ventas se publicarán en ese canal, `;
    message += `si me indicas dos canales se publicaran las compras en uno y las ventas en el otro, `;
    message += `tanto el bot como tú deben ser administradores de ambos canales.\n\n`;
    message += `Puedes ingresar el nombre de un canal o si deseas utilizar dos canales ingresa `;
    message += `dos nombres separados por un espacio.\n\n`;
    message += `P. ej: @MiComunidadCompras @MiComunidadVentas`;
    await ctx.reply(message);
  } catch (error) {
    console.log(error);
  }
};

const wizardCommunityOneOrTwoChannelsMessage = async (ctx) => {
  try {
    await ctx.reply(`Debes ingresar uno o dos canales`);
  } catch (error) {
    console.log(error);
  }
};

const wizardCommunityEnterSolversMessage = async (ctx) => {
  try {
    let message = `Ahora ingresa los username de los usuarios que se encargan de resolver disputas, `;
    message += `cada username separado por un espacio en blanco`;
    await ctx.reply(message);
  } catch (error) {
    console.log(error);
  }
};

const wizardCommunityMustEnterNamesSeparatedMessage = async (ctx) => {
  try {
    await ctx.reply(`Debes ingresar uno o dos nombres separados por un espacio`);
  } catch (error) {
    console.log(error);
  }
};

const wizardCommunityEnterSolversChannelMessage = async (ctx) => {
  try {
    let message = `Para finalizar indícame el id o nombre del canal que utilizará el bot para avisar `;
    message += `cuando haya una disputa, por favor incluye un @ al inicio del nombre del canal`;
    await ctx.reply(message);
  } catch (error) {
    console.log(error);
  }
};

const wizardCommunityCreatedMessage = async (ctx) => {
  try {
    await ctx.reply(`¡Felicidades has creado tu comunidad!`);
  } catch (error) {
    console.log(error);
  }
};

const wizardCommunityWrongPermission = () => {
  return `No tienes permisos de administrador en este grupo o canal`;
};

const wizardAddFiatAmountMessage = async (ctx, currencyName, action, order) => {
  try {
    let message = `Ingresa la cantidad de ${currencyName} que desea ${action}.\n`;
    message += `Recuerde que debe estar entre ${order.min_amount} y ${order.max_amount}:`;

    await ctx.reply(message);
  } catch (error) {
    console.log(error);
  }
};

const wizardAddFiatAmountWrongAmountMessage = async (ctx, order) => {
  try {
    await ctx.reply(`Monto incorrecto, ingrese un número entre ${order.min_amount} y ${order.max_amount}`);
  } catch (error) {
    console.log(error);
  }
};

const wizardAddFiatAmountCorrectMessage = async (ctx, currency, fiatAmount) => {
  try {
    await ctx.reply(`Cantidad elegida: ${currency.symbol_native} ${fiatAmount}.`);
  } catch (error) {
    console.log(error);
  }
};

const expiredOrderMessage = async (bot, order, buyerUser, sellerUser) => {
  try {
    let message = `Esta orden ha expirado sin haberse completado\n\n`;
    message += getDetailedOrder(order, buyerUser, sellerUser);
    message += `\n\n`;
    message += `@${sellerUser.username} tiene ${sellerUser.disputes} disputa${plural(sellerUser.disputes)}\n`;
    message += `@${buyerUser.username} tiene ${buyerUser.disputes} disputa${plural(buyerUser.disputes)}\n`;

    await bot.telegram.sendMessage(process.env.ADMIN_CHANNEL, message);
  } catch (error) {
    console.log(error);
  }
};

const toBuyerDidntAddInvoiceMessage = async (bot, user, order) => {
  try {
    await bot.telegram.sendMessage(user.tg_id, `🤨 No has enviado la factura para recibir sats por la orden Id: #${order._id}`);
  } catch (error) {
    console.log(error);
  }
};

const toSellerBuyerDidntAddInvoiceMessage = async (bot, user, order) => {
  try {
    await bot.telegram.sendMessage(user.tg_id, `😔 El comprador no me envió la factura para recibir sats por tu venta Id: #${order._id}, tus sats han sido devueltos`);
  } catch (error) {
    console.log(error);
  }
};

const toAdminChannelBuyerDidntAddInvoiceMessage = async (bot, user, order) => {
  try {
    let message = `El comprador @${user.username} tomó la orden Id: #${order._id} pero no ha ingresado `;
    message += `la factura para recibir el pago, el tiempo ha expirado, la orden ha sido publicada nuevamente`;
    await bot.telegram.sendMessage(process.env.ADMIN_CHANNEL, message);
  } catch (error) {
    console.log(error);
  }
};

const toSellerDidntPayInvoiceMessage = async (bot, user, order) => {
  try {
    await bot.telegram.sendMessage(user.tg_id, `🤨 No has pagado la factura para vender sats por la orden Id: #${order._id}`);
  } catch (error) {
    console.log(error);
  }
};

const toBuyerSellerDidntPayInvoiceMessage = async (bot, user, order) => {
  try {
    await bot.telegram.sendMessage(user.tg_id, `😔 El vendedor no pagó la factura por tu compra Id: #${order._id}, la operación ha sido cancelada`);
  } catch (error) {
    console.log(error);
  }
};

const toAdminChannelSellerDidntPayInvoiceMessage = async (bot, user, order) => {
  try {
    let message = `El vendedor @${user.username} no ha pagado la factura correspondiente a la orden Id: #${order._id} `;
    message += `y el tiempo ha expirado, la orden ha sido publicada nuevamente`;
    await bot.telegram.sendMessage(process.env.ADMIN_CHANNEL, message);
  } catch (error) {
    console.log(error);
  }
};

const userCantDoMessage = async (bot, user) => {
  try {
    await bot.telegram.sendMessage(user.tg_id, `🤨 Este usuario no puede realizar esta operación`);
  } catch (error) {
    console.log(error);
  }
};

const toAdminChannelPendingPaymentSuccessMessage = async (bot, user, order, pending, payment) => {
  try {
    let message = `El usuario @${user.username} tenía un pago pendiente en su compra Id: #${order._id} `;
    message += `de ${order.amount} satoshis, el pago se realizó luego de ${pending.attempts} intentos.\n\n`;
    message += `Prueba de pago: ${payment.secret}`;
    await bot.telegram.sendMessage(process.env.ADMIN_CHANNEL, message);
  } catch (error) {
    console.log(error);
  }
};

const toBuyerPendingPaymentSuccessMessage = async (bot, user, order, payment) => {
  try {
    let message = `¡He pagado la factura lightning por tu compra Id: #${order._id}!\n\n`;
    message += `Prueba de pago: ${payment.secret}`;
    await bot.telegram.sendMessage(user.tg_id, message);
  } catch (error) {
    console.log(error);
  }
};

const toBuyerPendingPaymentFailedMessage = async (bot, user, order) => {
  try {
    let message = `He intentado pagar tu factura un total de 4 veces y todas han fallado, `;
    message += `algunas veces los usuarios de lightning network no pueden recibir pagos `;
    message += `porque no hay suficiente capacidad de entrada en su wallet/nodo, una `;
    message += `solución puede ser generar una nueva factura desde otra wallet que sí tenga capacidad\n\n`;
    message += `Si lo deseas puedes enviarme una nueva factura para recibir los satoshis con el comando 👇\n\n`;
    message += `/setinvoice ${order._id} <lightning_invoice>`;

    await bot.telegram.sendMessage(user.tg_id, message);
  } catch (error) {
    console.log(error);
  }
};

const toAdminChannelPendingPaymentFailedMessage = async (bot, user, order) => {
  try {
    let message = `El pago a la invoice de la compra Id: #${order._id} del usuario `;
    message += `@${user.username} ha fallado!\n\n`;
    message += `Intento de pago: ${pending.attempts}`;
    await bot.telegram.sendMessage(process.env.ADMIN_CHANNEL, message);
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
  minimunExpirationTimeInvoiceMessage,
  expiredInvoiceMessage,
  requiredAddressInvoiceMessage,
  requiredHashInvoiceMessage,
  publishBuyOrderMessage,
  invalidOrderMessage,
  invalidTypeOrderMessage,
  alreadyTakenOrderMessage,
  onGoingTakeSellMessage,
  invalidDataMessage,
  beginTakeBuyMessage,
  notActiveOrderMessage,
  publishSellOrderMessage,
  onGoingTakeBuyMessage,
  pendingSellMessage,
  pendingBuyMessage,
  repeatedInvoiceMessage,
  mustBeIntMessage,
  beginDisputeMessage,
  notOrderMessage,
  customMessage,
  nonHandleErrorMessage,
  checkOrderMessage,
  mustBeValidCurrency,
  mustBeANumberOrRange,
  unavailableLightningAddress,
  invalidLightningAddress,
  invalidInvoice,
  helpMessage,
  mustBeGreatherEqThan,
  bannedUserErrorMessage,
  fiatSentMessages,
  orderOnfiatSentStatusMessages,
  takeSellWaitingSellerToPayMessage,
  userBannedMessage,
  notFoundUserMessage,
  errorParsingInvoiceMessage,
  notValidIdMessage,
  addInvoiceMessage,
  genericErrorMessage,
  cantTakeOwnOrderMessage,
  notLightningInvoiceMessage,
  notOrdersMessage,
  listOrdersResponse,
  notRateForCurrency,
  incorrectAmountInvoiceMessage,
  beginTakeSellMessage,
  invoiceUpdatedMessage,
  counterPartyWantsCooperativeCancelMessage,
  initCooperativeCancelMessage,
  okCooperativeCancelMessage,
  shouldWaitCooperativeCancelMessage,
  cantCooperativeCancelMessage,
  successCompleteOrderByAdminMessage,
  successCompleteOrderMessage,
  successCancelOrderByAdminMessage,
  successCancelOrderMessage,
  badStatusOnCancelOrderMessage,
  invoicePaymentFailedMessage,
  showUsernameErrorMessage,
  successMessage,
  userCantTakeMoreThanOneWaitingOrderMessage,
  buyerReceivedSatsMessage,
  releasedSatsMessage,
  rateUserMessage,
  listCurrenciesResponse,
  priceApiFailedMessage,
  showHoldInvoiceMessage,
  waitingForBuyerOrderMessage,
  invoiceUpdatedPaymentWillBeSendMessage,
  invoiceAlreadyUpdatedMessage,
  successSetAddress,
  sellerPaidHoldMessage,
  showInfoMessage,
  sendBuyerInfo2SellerMessage,
  updateUserSettingsMessage,
  expiredInvoiceOnPendingMessage,
  successCancelAllOrdersMessage,
  disableLightningAddress,
  invalidRangeWithAmount,
  tooManyPendingOrdersMessage,
  listCommunitiesMessage,
  wizardAddInvoiceInitMessage,
  wizardAddInvoiceExitMessage,
  orderExpiredMessage,
  cantAddInvoiceMessage,
  wizardCommunityEnterNameMessage,
  wizardExitMessage,
  wizardCommunityTooLongNameMessage,
  wizardCommunityEnterGroupMessage,
  wizardCommunityEnterOrderChannelsMessage,
  wizardCommunityOneOrTwoChannelsMessage,
  wizardCommunityEnterSolversMessage,
  wizardCommunityMustEnterNamesSeparatedMessage,
  wizardCommunityEnterSolversChannelMessage,
  wizardCommunityCreatedMessage,
  wizardCommunityWrongPermission,
  wizardAddFiatAmountMessage,
  wizardAddFiatAmountWrongAmountMessage,
  wizardAddFiatAmountCorrectMessage,
  expiredOrderMessage,
  toBuyerDidntAddInvoiceMessage,
  toSellerBuyerDidntAddInvoiceMessage,
  toAdminChannelBuyerDidntAddInvoiceMessage,
  toSellerDidntPayInvoiceMessage,
  toBuyerSellerDidntPayInvoiceMessage,
  toAdminChannelSellerDidntPayInvoiceMessage,
  userCantDoMessage,
  toAdminChannelPendingPaymentSuccessMessage,
  toBuyerPendingPaymentSuccessMessage,
  toBuyerPendingPaymentFailedMessage,
  toAdminChannelPendingPaymentFailedMessage,
};
