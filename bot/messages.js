const { plural, getCurrency } = require('../util');

const startMessage = async (ctx) => {
  try {
    const orderExpiration = parseInt(process.env.ORDER_EXPIRATION_WINDOW) / 60;
    await ctx.reply(`Este bot te ayudará a completar tus intercambios P2P usando Bitcoin vía Lightning Network.

Una vez incializado el Bot en privado es fácil:

1. Publica tu oferda de compra o venta por medio de los comandos /buy o /sell y sigue las instrucciones.
2. Espera que otro usuario tome la oferta por medio de los botones "Comprar" ó "Vender". Tambien puedes tomar las ofertas de otros usuarios con estos botones!
3. Tu oferta y calificación estará visible en el canal ${process.env.CHANNEL}.

/sell:
4. Si estas vendiendo el bot publicará la orden en el canal ${process.env.CHANNEL} esperando a que alguien tome tu venta. Sin embargo puedes cancelarla antes de que otro usuario la tome con el comando /cancel.
5. Una vez alguien tome tu venta el bot te pedira que pagues un invoice el cual estará retenido por ${orderExpiration} minutos, el bot te dirá quién es el comprador para que le brindes tus datos de pago y te envíe el dinero fiat. Luego tu debes liberar los fondos para que le lleguen los sats al invoice del usuario por medio del comando /release

/buy:
6. Si estas comprando, solo debes publicar la oferta y esperar que otro usuario la tome. Sin embargo puedes cancelarla antes de que otro usuario la tome con el comando /cancel.
7. Una vez alguien tome tu compra debes crear un invoice para recibir los sats y enviarsela al bot, luego contacta al vendedor para que te de los datos del pago fiat. El usuario luego debe liberar sus fondos usando el comando /release para que te lleguen los sats al invoice.

Botón Comprar:
8. Si estas tomando una venta, debes crear un invoice para recibir los sats y pedirle al vendedor que te de sus datos de pago fiat.
9. Una vez el otro usuario confirme su pago fiat usará el comando /release para liberarte los sats a tu invoice.

Botón Vender:
9. Si estas tomando una compra, debes pagar el invoice el cual estara retenido mientras el otro usuario realiza tu pago fiat. Debes contactarle y brindarle tus datos para ello.
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

const initBotErrorMessage = async (bot, tgId) => {
  try {
    await bot.telegram.sendMessage(tgId, `Para usar este Bot primero debes inicializar el bot con el comando /start`);
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
    const expirationTime = parseInt(process.env.HOLD_INVOICE_EXPIRATION_WINDOW) / 60;
    await bot.telegram.sendMessage(user.tg_id, `Por favor paga esta factura para comenzar la venta, esta factura expira en ${expirationTime} minutos`);
    await bot.telegram.sendMessage(user.tg_id, `${request}`);
  } catch (error) {
    console.log(error);
  }
};

const pendingSellMessage = async (bot, user, order) => {
  try {
    await bot.telegram.sendMessage(user.tg_id, `Publicada la oferta en el canal ${process.env.CHANNEL}\n\nEspera que alguien tome tu venta.`);
    await bot.telegram.sendMessage(user.tg_id, `Puedes cancelar esta orden antes de que alguien la tome ejecutando:`);
    await bot.telegram.sendMessage(user.tg_id, `/cancel ${order._id}`);
  } catch (error) {
    console.log(error);
  }
};

const pendingBuyMessage = async (bot, user, order) => {
  try {
    await bot.telegram.sendMessage(user.tg_id, `Publicada la oferta en el canal ${process.env.CHANNEL}.\n\nEspera que alguien tome tu compra.`);
    await bot.telegram.sendMessage(user.tg_id, `Puedes cancelar esta orden antes de que alguien la tome ejecutando:`);
    await bot.telegram.sendMessage(user.tg_id, `/cancel ${order._id}`);
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
    await bot.telegram.sendMessage(user.tg_id, `/sell <monto_en_sats> <monto_en_fiat> <codigo_fiat> <método_de_pago> [mostrar_username]`);
  } catch (error) {
    console.log(error);
  }
};

const buyOrderCorrectFormatMessage = async (bot, user) => {
  try {
    await bot.telegram.sendMessage(user.tg_id, `/buy <monto_en_sats> <monto_en_fiat> <codigo_fiat> <método_de_pago> [mostrar_username]`);
  } catch (error) {
    console.log(error);
  }
};

const minimunAmountInvoiceMessage = async (bot, user) => {
  try {
    await bot.telegram.sendMessage(user.tg_id, `La factura debe ser mayor o igual a 100 satoshis`);
  } catch (error) {
    console.log(error);
  }
};

const amountMustTheSameInvoiceMessage = async (bot, user, amount) => {
  try {
    await bot.telegram.sendMessage(user.tg_id, `La factura tener un monto igual a ${amount} sats`);
  } catch (error) {
    console.log(error);
  }
};

const minimunExpirationTimeInvoiceMessage = async (bot, user) => {
  try {
    const expirationTime = parseInt(INVOICE_EXPIRATION_WINDOW) / 60 / 1000;
    await bot.telegram.sendMessage(user.tg_id, `El tiempo de expiración de la factura debe ser de al menos ${expirationTime} minutos`);
  } catch (error) {
    console.log(error);
  }
};

const expiredInvoiceMessage = async (bot, user) => {
  try {
    await bot.telegram.sendMessage(user.tg_id, `La factura ha expirado`);
  } catch (error) {
    console.log(error);
  }
};

const requiredAddressInvoiceMessage = async (bot, user) => {
  try {
    await bot.telegram.sendMessage(user.tg_id, `La factura necesita una dirección destino`);
  } catch (error) {
    console.log(error);
  }
};

const requiredHashInvoiceMessage = async (bot, user) => {
  try {
    await bot.telegram.sendMessage(user.tg_id, `La factura necesita un hash`);
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

const invalidDataMessage = async (ctx) => {
  try {
    await ctx.reply(`Has enviado datos incorrectos, inténtalo nuevamente.`);
  } catch (error) {
    console.log(error);
  }
};

const beginTakeBuyMessage = async (bot, sellerUser, request, order) => {
  try {
    const expirationTime = parseInt(process.env.HOLD_INVOICE_EXPIRATION_WINDOW) / 60;
    await bot.telegram.sendMessage(sellerUser.tg_id, `Por favor paga esta factura al bot para comenzar tu venta con el comprador, esta factura expira en ${expirationTime} minutos`);
    await bot.telegram.sendMessage(sellerUser.tg_id, `${request}`);
  } catch (error) {
    console.log(error);
  }
};

const onGoingTakeBuyMessage = async (bot, seller, buyer, order) => {
  try {
    await bot.telegram.sendMessage(seller.tg_id, `¡Pago recibido!\n\nPonte en contacto con @${buyer.username} para darle los detalles de metodo de pago fiat que te hará. Una vez confirmes su pago debes liberar los fondos`);
    await bot.telegram.sendMessage(buyer.tg_id, `Alguien ha tomado tu compra, presiona el botón para continuar 👇`);
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
          [{text: 'Continuar', callback_data: 'addInvoiceBtn'}],
        ],
      },
    });
  } catch (error) {
    console.log(error);
  }
};

const doneTakeBuyMessage = async (bot, orderUser, sellerUser) => {
  try {
    await bot.telegram.sendMessage(sellerUser.tg_id, `Confirmaste el pago fiat del comprador @${orderUser.username} y has vendido exitosamente tus sats\n⚡️🍊⚡️`);
    await bot.telegram.sendMessage(orderUser.tg_id, `Tu compra de sats ha sido completada exitosamente con @${sellerUser.username} tras confirmar tu pago fiat y ya he pagado tu factura,  que disfrutes tus sats\n⚡️🍊⚡️`);
  } catch (error) {
    console.log(error);
  }
};

const onGoingTakeSellMessage = async (bot, sellerUser, buyerUser, order) => {
  try {
    const currency = getCurrency(order.fiat_code);
    await bot.telegram.sendMessage(buyerUser.tg_id, `Ponte en contacto con el usuario @${sellerUser.username} para que te de detalle de como enviarle el dinero, debes enviarle ${currency.symbol_native} ${order.fiat_amount}.`);
    await bot.telegram.sendMessage(buyerUser.tg_id, `Una vez me hayas enviado el dinero fiat hazmelo saber con el comando 👇`);
    await bot.telegram.sendMessage(buyerUser.tg_id, `/fiatsent ${order._id}`);
    await bot.telegram.sendMessage(sellerUser.tg_id, `@${buyerUser.username} ha tomado tu venta y te quiere comprar sats. Escríbele para que te envíe el dinero fiat.\n\nUna vez confirmes su pago debes liberar los fondos con el comando:`);
    await bot.telegram.sendMessage(sellerUser.tg_id, `/release ${order._id}`);
  } catch (error) {
    console.log(error);
  }
};

const takeSellWaitingSellerToPayMessage = async (bot, buyerUser, order) => {
  try {
    await bot.telegram.sendMessage(buyerUser.tg_id, `Le he enviado una solicitud de pago al vendedor para que nos envíe tus sats, en cuanto realice el pago los pondremos en contacto`);
  } catch (error) {
    console.log(error);
  }
};

const doneTakeSellMessage = async (bot, orderUser, buyerUser) => {
  try {
    await bot.telegram.sendMessage(buyerUser.tg_id, `El vendedor @${orderUser.username} nos indicó que recibió tu pago y he pagado tu factura, que disfrutes tus sats\n⚡️🍊⚡️`);
    await bot.telegram.sendMessage(orderUser.tg_id, `Tu venta de sats ha sido completada tras confirmar el pago de  @${buyerUser.username}\n⚡️🍊⚡️`);
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
    await bot.telegram.sendMessage(user.tg_id, `Esa factura ya se encuentra usada en el sistema`);
  } catch (error) {
    console.log(error);
  }
};

const publishBuyOrderMessage = async (ctx, bot, order) => {
  try {
    let publishMessage = `⚡️🍊⚡️\n${order.description}\n\n`;
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

    // Mensaje al grupo origen en caso de haber
    if (ctx.message.chat.type != 'private') {
      order.tg_group_message1 = (await ctx.reply(publishMessage, { reply_to_message_id: order.tg_order_message })).message_id;
      order.tg_group_message2 = (await ctx.reply(order._id, {
        reply_markup: {
          inline_keyboard: [
            [{text: 'Vender satoshis', callback_data: 'takebuy'}],
          ],
        },
      })).message_id;
    }

    order.save();
  } catch (error) {
    console.log(error);
  }
};

const publishSellOrderMessage = async (ctx, bot, order) => {
  try {
    let publishMessage = `⚡️🍊⚡️\n${order.description}\n\n`;
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

    // Mensaje al grupo origen en caso de haber
    if (ctx.message.chat.type != 'private') {
      order.tg_group_message1 = (await ctx.reply(publishMessage, { reply_to_message_id: order.tg_order_message })).message_id;
      order.tg_group_message2 = (await ctx.reply(order._id, {
        reply_markup: {
          inline_keyboard: [
            [{text: 'Comprar satoshis', callback_data: 'takesell'}],
          ],
        },
      })).message_id;
    }

    order.save();
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
    await bot.telegram.sendMessage(process.env.ADMIN_CHANNEL, `El ${type} @${initiatorUser.username}
ha iniciado una disputa con @${counterPartyUser.username} en la orden id: ${order._id}:
Status: ${order.status}
Monto sats: ${order.amount}
Monto ${order.fiat_code}: ${order.fiat_amount}
Método de pago: ${order.payment_method}
seller invoice hash: ${order.hash}
seller invoice secret: ${order.secret}
buyer payment request: ${order.buyer_invoice}

@${initiatorUser.username} ya tiene ${initiatorUser.disputes} disputa${plural(initiatorUser.disputes)}
@${counterPartyUser.username} ya tiene ${counterPartyUser.disputes} disputa${counterPartyUser.disputes}`);
    if (initiator === 'buyer') {
      await bot.telegram.sendMessage(initiatorUser.tg_id, `Has iniciado una disputa por tu compra, nos comunicaremos contigo y tu contraparte para resolverla`);
      await bot.telegram.sendMessage(counterPartyUser.tg_id, `El comprador ha iniciado una disputa por tu orden con id: ${order._id}, nos comunicaremos contigo y tu contraparte para resolverla`);
    } else {
      await bot.telegram.sendMessage(initiatorUser.tg_id, `Has iniciado una disputa por tu venta, nos comunicaremos contigo y tu contraparte para resolverla`);
      await bot.telegram.sendMessage(counterPartyUser.tg_id, `El vendedor ha iniciado una disputa por tu orden con id: ${order._id}, nos comunicaremos contigo y tu contraparte para resolverla`);
    }
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

const checkOrderMessage = async (ctx, order, creator, buyer, seller) => {
  try {
    await ctx.reply(`Orden id: ${order._id}:
Status: ${order.status}
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

const invalidInvoice = async (bot, user) => {
  try {
    await bot.telegram.sendMessage(user.tg_id, `Factura lightning no válida`);
  } catch (error) {
    console.log(error);
  }
};

const helpMessage = async (ctx) => {
  try {
    await ctx.reply(`/sell <monto_en_sats> <monto_en_fiat> <codigo_fiat> <método_de_pago> [mostrar_username] - Crea una orden de venta
/buy <monto_en_sats> <monto_en_fiat> <codigo_fiat> <método_de_pago> [mostrar_username] - Crea una orden de compra
/fiatsent <order_id> - El comprador indica que ya ha enviado el dinero Fiat al vendedor
/setinvoice <order_id> <lightning_invoice> - Le permite al comprador actualizar la factura lightning en la que recibirá sats
/listorders - El usuario puede listar sus órdenes no finalizadas
/release <order_id> - El vendedor libera los satoshis
/dispute <order_id> - Abre una disputa entre los participantes
/cancel <order_id> - Cancela una orden que no ha sido tomada
/cooperativecancel <order_id> - Inicia una cancelación cooperativa, ambas partes deben ejecutar este comando para cancelar una orden activa`);
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
    await bot.telegram.sendMessage(buyer.tg_id, `Le hemos avisado al vendedor que has enviado el dinero fiat, en lo que el vendedor confirme que recibió tu dinero deberá liberar los fondos`);
    await bot.telegram.sendMessage(seller.tg_id, `El comprador me ha indicado que ya te envió el dinero fiat, esperamos que una vez confirmes la recepción del dinero liberes los fondos, debes saber que hasta que no liberes los fondos no podrás crear o tomar otra orden`);
    await bot.telegram.sendMessage(seller.tg_id, `/release ${order._id}`);
  } catch (error) {
    console.log(error);
  }
};


const orderOnfiatSentStatusMessages = async (bot, user) => {
  try {
    await bot.telegram.sendMessage(user.tg_id, `Tienes una o más ordenes en las que el comprador indicó que te envió el dinero fiat pero no has liberado los fondos, no puedes seguir operando hasta completar esa(s) orden(es)`);
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

const errorParsingInvoiceMessage = async (bot, user) => {
  try {
    await bot.telegram.sendMessage(user.tg_id, `Error parseando la factura`);
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

const addInvoiceMessage = async (bot, user, order) => {
  try {
    const currency = getCurrency(order.fiat_code);
    await bot.telegram.sendMessage(user.tg_id, `🤖 He recibido tu factura, ahora debes enviarle al vendedor ${currency.symbol_native} ${order.fiat_amount}`);
    await bot.telegram.sendMessage(user.tg_id, `🤖 En cuanto hayas enviado el dinero fiat hazmelo saber con el comando 👇`);
    await bot.telegram.sendMessage(user.tg_id, `/fiatsent ${order._id}`);
  } catch (error) {
    console.log(error);
  }
};

const genericErrorMessage = async (bot, user) => {
  try {
    await bot.telegram.sendMessage(user.tg_id, `Ha ocurrido un error, intenta nuevamente!`);
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
    await bot.telegram.sendMessage(user.tg_id, `/setinvoice ${order._id} <lightning_invoice>`);
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
      response += `${order._id} | ${order.status} | ${order.amount} | ${order.fiat_amount} | ${order.fiat_code}\n`;
    });
    await bot.telegram.sendMessage(user.tg_id, response);
  } catch (error) {
    console.log(error);
  }
};

const notRateForCurrency = async (bot, user) => {
  try {
    await bot.telegram.sendMessage(user.tg_id, `Yadio.io no tiener tasa de cambio para esta moneda fiat`);
  } catch (error) {
    console.log(error);
  }
};

const incorrectAmountInvoiceMessage = async (bot, user) => {
  try {
    await bot.telegram.sendMessage(user.tg_id, `La factura tiene un monto incorrecto`);
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

const badStatusOnCancelOrderMessage = async (bot, user) => {
  try {
    await bot.telegram.sendMessage(user.tg_id, `Esta opción solo permite cancelar las ordenes que no han sido tomadas o en las cuales el vendedor ha tardado mucho para pagar la factura`);
  } catch (error) {
    console.log(error);
  }
};

const successCancelOrderMessage = async (bot, user, order) => {
  try {
    await bot.telegram.sendMessage(user.tg_id, `¡Has cancelado la orden Id: ${order._id}!`);
  } catch (error) {
    console.log(error);
  }
};

const successCancelOrderByAdminMessage = async (bot, user, order) => {
  try {
    await bot.telegram.sendMessage(user.tg_id, `¡El admin ha cancelado la orden Id: ${order._id}!`);
  } catch (error) {
    console.log(error);
  }
};

const successCompleteOrderMessage = async (bot, user, order) => {
  try {
    await bot.telegram.sendMessage(user.tg_id, `¡Has completado la orden Id: ${order._id}!`);
  } catch (error) {
    console.log(error);
  }
};

const successCompleteOrderByAdminMessage = async (bot, user, order) => {
  try {
    await bot.telegram.sendMessage(user.tg_id, `¡El admin ha completado la orden Id: ${order._id}!`);
  } catch (error) {
    console.log(error);
  }
};

const onlyActiveCooperativeCancelMessage = async (bot, user) => {
  try {
    await bot.telegram.sendMessage(user.tg_id, `Esta opción solo permite cancelar cooperativamente las ordenes activas`);
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
    await bot.telegram.sendMessage(user.tg_id, `Tu contraparte ha estado de acuerdo y ha sido cancelada la orden Id: ${order._id}!`);
  } catch (error) {
    console.log(error);
  }
};

const initCooperativeCancelMessage = async (bot, user, order) => {
  try {
    await bot.telegram.sendMessage(user.tg_id, `Has iniciado la cancelación de la orden Id: ${order._id}, tu contraparte también debe indicarme que desea cancelar la orden`);
  } catch (error) {
    console.log(error);
  }
};

const counterPartyWantsCooperativeCancelMessage = async (bot, user, order) => {
  try {
    await bot.telegram.sendMessage(user.tg_id, `Tu contraparte quiere cancelar la orden Id: ${order._id}, si estás de acuerdo utiliza el comando 👇`);
    await bot.telegram.sendMessage(user.tg_id, `/cooperativecancel ${order._id}`);
  } catch (error) {
    console.log(error);
  }
};

const invoicePaymentFailedMessage = async (bot, user) => {
  try {
    await bot.telegram.sendMessage(user.tg_id, `El vendedor ha liberado los satoshis pero el pago a tu factura ha fallado, intentaré pagarla nuevamente dentro de ${process.env.PENDING_PAYMENT_WINDOW} minutos, asegúrate que tu nodo/wallet esté online`);
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
  onGoingTakeSellMessage,
  invalidDataMessage,
  beginTakeBuyMessage,
  notActiveOrderMessage,
  publishSellOrderMessage,
  onGoingTakeBuyMessage,
  doneTakeBuyMessage,
  doneTakeSellMessage,
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
  mustBeANumber,
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
  onlyActiveCooperativeCancelMessage,
  successCompleteOrderByAdminMessage,
  successCompleteOrderMessage,
  successCancelOrderByAdminMessage,
  successCancelOrderMessage,
  badStatusOnCancelOrderMessage,
  invoicePaymentFailedMessage,
  showUsernameErrorMessage,
  successMessage,
  userCantTakeMoreThanOneWaitingOrderMessage,
};
