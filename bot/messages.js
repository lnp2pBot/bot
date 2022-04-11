const { TelegramError } = require('telegraf');
const { getCurrency } = require('../util');

const startMessage = async (ctx) => {
  try {
    const orderExpiration = parseInt(process.env.ORDER_EXPIRATION_WINDOW) / 60;
    let message = ctx.i18n.t('start', { orderExpiration, channel: process.env.CHANNEL });
    await ctx.reply(message);
  } catch (error) {
    console.log(error);
  }
};

const initBotErrorMessage = async (ctx, bot, user) => {
  try {
    await bot.telegram.sendMessage(user.tg_id, ctx.i18n.t('init_bot_error'));
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

const invoicePaymentRequestMessage = async (bot, user, request, order, i18n) => {
  try {
    let currency = getCurrency(order.fiat_code);
    currency = (!!currency && !!currency.symbol_native) ? currency.symbol_native : order.fiat_code;
    const expirationTime = parseInt(process.env.HOLD_INVOICE_EXPIRATION_WINDOW) / 60;
    let message = i18n.t('invoice_payment_request', {
      currency,
      order,
      expirationTime,
    });
    await bot.telegram.sendMessage(user.tg_id, message);
    await bot.telegram.sendMessage(user.tg_id, "`" + request + "`", { parse_mode: "MarkdownV2" });
  } catch (error) {
    console.log(error);
  }
};

const pendingSellMessage = async (bot, user, order, i18n) => {
  try {
    let orderExpirationWindow = process.env.ORDER_PUBLISHED_EXPIRATION_WINDOW / 60 / 60;
    await bot.telegram.sendMessage(user.tg_id, i18n.t('pending_sell', {
      channel: process.env.CHANNEL,
      orderExpirationWindow: Math.round(orderExpirationWindow),
    }));
    await bot.telegram.sendMessage(user.tg_id, i18n.t('cancel_order_cmd', { orderId: order._id }), { parse_mode: "MarkdownV2" });
  } catch (error) {
    console.log(error);
  }
};

const pendingBuyMessage = async (bot, user, order, i18n) => {
  try {
    let orderExpirationWindow = process.env.ORDER_PUBLISHED_EXPIRATION_WINDOW / 60 / 60;
    await bot.telegram.sendMessage(user.tg_id, i18n.t('pending_buy', {
      channel: process.env.CHANNEL,
      orderExpirationWindow: Math.round(orderExpirationWindow),
    }));
    await bot.telegram.sendMessage(user.tg_id, i18n.t('cancel_order_cmd', { orderId: order._id }), { parse_mode: "MarkdownV2" });
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

const expiredInvoiceOnPendingMessage = async (bot, user, order, i18n) => {
  try {
    await bot.telegram.sendMessage(user.tg_id, i18n.t('invoice_expired_long'));
    await bot.telegram.sendMessage(user.tg_id, i18n.t('setinvoice_cmd_order', { orderId: order._id }), { parse_mode: "MarkdownV2" });
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

const invalidDataMessage = async (ctx, bot, user) => {
  try {
    await bot.telegram.sendMessage(user.tg_id, ctx.i18n.t('invalid_data'));
  } catch (error) {
    console.log(error);
  }
};

const genericErrorMessage = async (bot, user, i18n) => {
  try {
    await bot.telegram.sendMessage(user.tg_id, i18n.t('generic_error'));
  } catch (error) {
    console.log(error);
  }
};

const beginTakeBuyMessage = async (ctx, bot, seller, order) => {
  try {
    const expirationTime = parseInt(process.env.HOLD_INVOICE_EXPIRATION_WINDOW) / 60;
    await bot.telegram.sendMessage(seller.tg_id, ctx.i18n.t('begin_take_buy', { expirationTime }));
    await bot.telegram.sendMessage(seller.tg_id, order._id, {
      reply_markup: {
        inline_keyboard: [
          [
            {text: ctx.i18n.t('continue'), callback_data: 'showHoldInvoiceBtn'},
            {text: ctx.i18n.t('cancel'), callback_data: 'cancelShowHoldInvoiceBtn'},
          ],
        ],
      },
    });
  } catch (error) {
    console.log(error);
  }
};

const showHoldInvoiceMessage = async (ctx, request, amount, fiatCode, fiatAmount) => {
  try {
    let currency = getCurrency(fiatCode);
    currency = (!!currency && !!currency.symbol_native) ? currency.symbol_native : fiatCode;
    await ctx.reply(ctx.i18n.t('pay_invoice', {
      amount,
      fiatAmount,
      currency,
    }));
    await ctx.reply("`" + request + "`", { parse_mode: "MarkdownV2" });
  } catch (error) {
    console.log(error);
  }
};

const onGoingTakeBuyMessage = async (bot, seller, buyer, order, i18nBuyer, i18nSeller) => {
  try {
    await bot.telegram.sendMessage(seller.tg_id, i18nSeller.t('payment_received'));
    await bot.telegram.sendMessage(buyer.tg_id, i18nBuyer.t('someone_took_your_order'), { parse_mode: "MarkdownV2" });
    await bot.telegram.sendMessage(buyer.tg_id, order._id, {
      reply_markup: {
        inline_keyboard: [
          [{text: i18nBuyer.t('continue'), callback_data: 'addInvoiceBtn'}],
        ],
      },
    });
  } catch (error) {
    console.log(error);
  }
};


const beginTakeSellMessage = async (ctx, bot, buyer, order) => {
  try {
    await bot.telegram.sendMessage(buyer.tg_id,  ctx.i18n.t('you_took_someone_order'), { parse_mode: "MarkdownV2" });
    await bot.telegram.sendMessage(buyer.tg_id, order._id, {
      reply_markup: {
        inline_keyboard: [
          [
            {text: ctx.i18n.t('continue'), callback_data: 'addInvoiceBtn'},
            {text: ctx.i18n.t('cancel'), callback_data: 'cancelAddInvoiceBtn'},
          ],
        ],
      },
    });
  } catch (error) {
    console.log(error);
  }
};

const onGoingTakeSellMessage = async (bot, sellerUser, buyerUser, order, i18nBuyer, i18nSeller) => {
  try {
    let currency = getCurrency(order.fiat_code);
    currency = (!!currency && !!currency.symbol_native) ? currency.symbol_native : order.fiat_code;
    await bot.telegram.sendMessage(
      buyerUser.tg_id,
      i18nBuyer.t('get_in_touch_with_seller', {
        currency,
        sellerUsername: sellerUser.username,
        fiatAmount: order.fiat_amount,
        paymentMethod: order.payment_method,
      }),
    );
    await bot.telegram.sendMessage(buyerUser.tg_id, i18nBuyer.t('fiatsent_order_cmd', { orderId: order._id }), { parse_mode: "MarkdownV2" });
    await bot.telegram.sendMessage(sellerUser.tg_id, i18nSeller.t('buyer_took_your_order', {
      fiatAmount: order.fiat_amount,
      paymentMethod: order.payment_method,
      currency,
      buyerUsername: buyerUser.username,
    }));
  } catch (error) {
    console.log(error);
  }
};

const takeSellWaitingSellerToPayMessage = async (ctx, bot, buyerUser, order) => {
  try {
    await bot.telegram.sendMessage(buyerUser.tg_id, ctx.i18n.t('waiting_seller_to_pay', { orderId: order._id }));
  } catch (error) {
    console.log(error);
  }
};

const releasedSatsMessage = async (bot, sellerUser, buyerUser, i18nBuyer, i18nSeller) => {
  try {
    await bot.telegram.sendMessage(sellerUser.tg_id, i18nSeller.t('sell_success', { buyerUsername: buyerUser.username }));
    await bot.telegram.sendMessage(buyerUser.tg_id, i18nBuyer.t('funds_released', { sellerUsername: sellerUser.username }));
  } catch (error) {
    console.log(error);
  }
};

const rateUserMessage = async (bot, caller, order, i18n) => {
  try {
    const starButtons = []
    for (let num = 5; num > 0; num--) {
      starButtons.push([{text: '⭐'.repeat(num), callback_data: `showStarBtn(${num},${order._id})`}])
    }
    await bot.telegram.sendMessage(caller.tg_id, i18n.t('rate_counterpart'), {
      reply_markup: {
        inline_keyboard: starButtons,
      },
    });
  } catch (error) {
    console.log(error);
  }
};

const notActiveOrderMessage = async (ctx) => {
  try {
    await ctx.reply(ctx.i18n.t('cant_process_order'));
  } catch (error) {
    console.log(error);
  }
};

const waitingForBuyerOrderMessage = async (ctx) => {
  try {
    await ctx.reply(ctx.i18n.t('cant_release_order'));
  } catch (error) {
    console.log(error);
  }
};

const notOrderMessage = async (ctx) => {
  try {
    await ctx.reply(ctx.i18n.t('no_id_related'));
  } catch (error) {
    console.log(error);
  }
};

const publishBuyOrderMessage = async (bot, order, i18n) => {
  try {
    let publishMessage = `⚡️🍊⚡️\n${order.description}\n`;
    publishMessage += `:${order._id}:`;

    // Mensaje al canal
    const message1 = await bot.telegram.sendMessage(process.env.CHANNEL, publishMessage, {
      reply_markup: {
        inline_keyboard: [
          [{text: i18n.t('sell_sats'), callback_data: 'takebuy'}],
        ],
      },
    });
    // Mensaje al canal
    order.tg_channel_message1 = message1 && message1.message_id ? message1.message_id : null;

    await order.save();
  } catch (error) {
    console.log(error);
  }
};

const publishSellOrderMessage = async (bot, order, i18n) => {
  try {
    let publishMessage = `⚡️🍊⚡️\n${order.description}\n`;
    publishMessage += `:${order._id}:`;

    const message1 = await bot.telegram.sendMessage(process.env.CHANNEL, publishMessage, {
      reply_markup: {
        inline_keyboard: [
          [{text: i18n.t('buy_sats'), callback_data: 'takesell'}],
        ],
      },
    });
    // Mensaje al canal
    order.tg_channel_message1 = message1 && message1.message_id ? message1.message_id : null;

    await order.save();
  } catch (error) {
    console.log(error);
  }
};

const getDetailedOrder = (i18n, order, buyer, seller) => {
  try {
    const buyerUsername = buyer ? buyer.username.replace(/_/g, '\\_') : '';
    const sellerUsername = seller ? seller.username.replace(/_/g, '\\_') : '';
    const buyerId = buyer ? buyer._id : '';
    let createdAt = order.created_at.toISOString();
    let takenAt = !!order.taken_at ? order.taken_at.toISOString() : '';
    createdAt = createdAt.replace(/(?=[.-])/g, '\\');
    takenAt = takenAt.replace(/(?=[.-])/g, '\\');
    const status = order.status.replace(/_/g, '\\_');
    const fee = !!order.fee ? parseInt(order.fee) : '';
    const creator = order.creator_id == buyerId ? buyerUsername : sellerUsername;
    let message = i18n.t('order_detail', {
      order,
      creator,
      buyerUsername,
      sellerUsername,
      createdAt,
      takenAt,
      status,
      fee,
      },
    );

    return message;
  } catch (error) {
    console.log(error);
  }
};

const beginDisputeMessage = async (bot, buyer, seller, order, initiator, i18n) => {
  try {
    const type = initiator === 'seller' ? i18n.t('seller') : i18n.t('buyer');
    let initiatorUser = buyer;
    let counterPartyUser = seller;
    if (initiator === 'seller') {
      initiatorUser = seller;
      counterPartyUser = buyer;
    }
    let detailedOrder = getDetailedOrder(i18n, order, buyer, seller);
    await bot.telegram.sendMessage(
      process.env.ADMIN_CHANNEL,
      i18n.t('dispute_started_channel', {
        order,
        initiator,
        initiatorUser,
        counterPartyUser,
        detailedOrder,
        type,
      }),
      { parse_mode: 'MarkdownV2' },
    );

    if (initiator === 'buyer') {
      await bot.telegram.sendMessage(initiatorUser.tg_id, i18n.t('you_started_dispute_to_buyer'));
      await bot.telegram.sendMessage(counterPartyUser.tg_id, i18n.t('buyer_started_dispute_to_seller', { orderId: order._id }));
    } else {
      await bot.telegram.sendMessage(initiatorUser.tg_id, i18n.t('you_started_dispute_to_seller'));
      await bot.telegram.sendMessage(counterPartyUser.tg_id, i18n.t('seller_started_dispute_to_buyer', { orderId: order._id }));
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
    let message = getDetailedOrder(ctx.i18n, order, buyer, seller);
    message += `\n\n`;
    await ctx.reply(message, { parse_mode: 'MarkdownV2' });
  } catch (error) {
    console.log(error);
  }
};

const mustBeValidCurrency = async (ctx) => {
  try {
    await ctx.reply(ctx.i18n.t('must_be_valid_currency'));
  } catch (error) {
    console.log(error);
  }
};

const mustBeANumberOrRange = async (ctx) => {
  try {
    await ctx.reply(ctx.i18n.t('must_be_number_or_range'));
  } catch (error) {
    console.log(error);
  }
};

const invalidLightningAddress = async (ctx) => {
  try {
    await ctx.reply(ctx.i18n.t('invalid_lightning_address'));
  } catch (error) {
    console.log(error);
  }
};

const unavailableLightningAddress = async (ctx, bot, user,la) => {
  try {
    await bot.telegram.sendMessage(user.tg_id, ctx.i18n.t('unavailable_lightning_address', { la }));
  } catch (error) {
    console.log(error);
  }
};

const helpMessage = async (ctx) => {
  try {
    await ctx.reply(ctx.i18n.t('help'), { parse_mode: 'Markdown' });
  } catch (error) {
    console.log(error);
  }
};

const mustBeGreatherEqThan = async (ctx, fieldName, qty) => {
  try {
    await ctx.reply(ctx.i18n.t('must_be_gt_or_eq', {
      fieldName,
      qty,
    }));
  } catch (error) {
    console.log(error);
  }
};

const bannedUserErrorMessage = async (ctx) => {
  try {
    await ctx.reply(ctx.i18n.t('you_have_been_banned'));
  } catch (error) {
    console.log(error);
  }
};

const fiatSentMessages = async (bot, buyer, seller, order, i18nBuyer, i18nSeller) => {
  try {
    await bot.telegram.sendMessage(buyer.tg_id, i18nBuyer.t('I_told_seller_you_sent_fiat', { sellerUsername: seller.username }));
    await bot.telegram.sendMessage(seller.tg_id, i18nSeller.t('buyer_told_me_that_sent_fiat', { buyerUsername: buyer.username }));
    await bot.telegram.sendMessage(seller.tg_id, i18nSeller.t('release_order_cmd', { orderId: order._id }), { parse_mode: 'Markdown' });
  } catch (error) {
    console.log(error);
  }
};


const orderOnfiatSentStatusMessages = async (ctx, bot, user) => {
  try {
    await bot.telegram.sendMessage(user.tg_id, ctx.i18n.t('you_have_orders_waiting'));
  } catch (error) {
    console.log(error);
  }
};

const userBannedMessage = async (ctx) => {
  try {
    await ctx.reply(ctx.i18n.t('user_banned'));
  } catch (error) {
    console.log(error);
  }
};

const notFoundUserMessage = async (ctx) => {
  try {
    await ctx.reply(ctx.i18n.t('user_not_found'));
  } catch (error) {
    console.log(error);
  }
};

const errorParsingInvoiceMessage = async (ctx) => {
  try {
    await ctx.reply(ctx.i18n.t('parse_invoice_error'));
  } catch (error) {
    console.log(error);
  }
};

const notValidIdMessage = async (ctx, bot, user) => {
  try {
    await bot.telegram.sendMessage(user.tg_id, ctx.i18n.t('invalid_id'));
  } catch (error) {
    console.log(error);
  }
};

const addInvoiceMessage = async (ctx, bot, buyer, seller, order) => {
  try {
    let currency = getCurrency(order.fiat_code);
    currency = (!!currency && !!currency.symbol_native) ? currency.symbol_native : order.fiat_code;
    await bot.telegram.sendMessage(
      buyer.tg_id,
      ctx.i18n.t('get_in_touch_with_seller', {
        currency,
        sellerUsername: seller.username,
        fiatAmount: order.fiat_amount,
        paymentMethod: order.payment_method,
      }),
    );
    await bot.telegram.sendMessage(buyer.tg_id, ctx.i18n.t('fiatsent_order_cmd', { orderId: order._id }), { parse_mode: "MarkdownV2" });
  } catch (error) {
    console.log(error);
  }
};

const sendBuyerInfo2SellerMessage = async (bot, buyer, seller, order, i18n) => {
  try {
    let currency = getCurrency(order.fiat_code);
    currency = (!!currency && !!currency.symbol_native) ? currency.symbol_native : order.fiat_code;
    await bot.telegram.sendMessage(
      seller.tg_id,
      i18n.t('get_in_touch_with_buyer', {
        currency,
        buyerUsername: buyer.username,
        fiatAmount: order.fiat_amount,
        paymentMethod: order.payment_method,
      }),
    );
  } catch (error) {
    console.log(error);
  }
};

const cantTakeOwnOrderMessage = async (ctx, bot, user) => {
  try {
    await bot.telegram.sendMessage(user.tg_id, ctx.i18n.t('cant_take_own_order'));
  } catch (error) {
    console.log(error);
  }
};

const notLightningInvoiceMessage = async (ctx, order) => {
  try {
    await ctx.reply(ctx.i18n.t('send_me_a_ln_invoice', { amount: order.amount }));
    await ctx.reply(ctx.i18n.t('setinvoice_cmd_order', { orderId: order._id }), { parse_mode: "MarkdownV2" });
  } catch (error) {
    console.log(error);
  }
};

const notOrdersMessage = async (ctx) => {
  try {
    await ctx.reply(ctx.i18n.t('you_have_no_orders'));
  } catch (error) {
    console.log(error);
  }
};

const listOrdersResponse = async (bot, user, orders) => {
  try {
    let response = "             Id          \\|     Status    \\|   sats amount  \\|  fiat amt  \\|  fiat\n";
    orders.forEach(order => {
      let fiatAmount = '\\-';
      let amount = '\\-';
      const status = order.status.replace(/_/g, '\\_');
      if (typeof order.fiat_amount != 'undefined') fiatAmount = order.fiat_amount;
      if (typeof order.amount != 'undefined') amount = order.amount;
      response += "`" + order._id + "` \\| " + status + " \\| " + amount + " \\| " + fiatAmount + " \\| " + order.fiat_code + "\n";
    });
    await bot.telegram.sendMessage(user.tg_id, response, { parse_mode: "MarkdownV2" });
  } catch (error) {
    console.log(error);
  }
};

const notRateForCurrency = async (bot, user, i18n) => {
  try {
    await bot.telegram.sendMessage(user.tg_id, i18n.t('not_rate_for_currency', { fiatRateProvider: process.env.FIAT_RATE_NAME }));
  } catch (error) {
    console.log(error);
  }
};

const incorrectAmountInvoiceMessage = async (ctx) => {
  try {
    await ctx.reply(ctx.i18n.t('invoice_with_incorrect_amount'));
  } catch (error) {
    console.log(error);
  }
};

const invoiceUpdatedMessage = async (ctx) => {
  try {
    await ctx.reply(ctx.i18n.t('invoice_updated'));
  } catch (error) {
    console.log(error);
  }
};

const invoiceUpdatedPaymentWillBeSendMessage = async (ctx) => {
  try {
    await ctx.reply(ctx.i18n.t('invoice_updated_and_will_be_paid'));
  } catch (error) {
    console.log(error);
  }
};

const invoiceAlreadyUpdatedMessage = async (ctx) => {
  try {
    await ctx.reply(ctx.i18n.t('invoice_already_being_paid'));
  } catch (error) {
    console.log(error);
  }
};
const successSetAddress = async (ctx) => {
  try {
    await ctx.reply(ctx.i18n.t('lightning_address_saved'));
  } catch (error) {
    console.log(error);
  }
};

const badStatusOnCancelOrderMessage = async (ctx) => {
  try {
    await ctx.reply(ctx.i18n.t('cancel_error'));
  } catch (error) {
    console.log(error);
  }
};

const successCancelOrderMessage = async (bot, user, order, i18n) => {
  try {
    await bot.telegram.sendMessage(user.tg_id, i18n.t('cancel_success', { orderId: order._id }));
  } catch (error) {
    console.log(error);
  }
};

const successCancelAllOrdersMessage = async (ctx) => {
  try {
    await ctx.reply(ctx.i18n.t('cancelall_success'));
  } catch (error) {
    console.log(error);
  }
};

const successCancelOrderByAdminMessage = async (ctx, bot, user, order) => {
  try {
    await bot.telegram.sendMessage(user.tg_id, ctx.i18n.t('order_cancelled_by_admin', { orderId: order._id }));
  } catch (error) {
    console.log(error);
  }
};

const successCompleteOrderMessage = async (ctx, order) => {
  try {
    await ctx.reply(ctx.i18n.t('order_completed', { orderId: order._id }));
  } catch (error) {
    console.log(error);
  }
};

const successCompleteOrderByAdminMessage = async (ctx, bot, user, order) => {
  try {
    await bot.telegram.sendMessage(user.tg_id, ctx.i18n.t('order_completed_by_admin', { orderId: order._id }));
  } catch (error) {
    console.log(error);
  }
};

const shouldWaitCooperativeCancelMessage = async (ctx, bot, user) => {
  try {
    await bot.telegram.sendMessage(user.tg_id, ctx.i18n.t('have_to_wait_for_counterpart'));
  } catch (error) {
    console.log(error);
  }
};

const okCooperativeCancelMessage = async (bot, user, order, i18n) => {
  try {
    await bot.telegram.sendMessage(user.tg_id, i18n.t('ok_cooperativecancel', { orderId: order._id }));
  } catch (error) {
    console.log(error);
  }
};

const refundCooperativeCancelMessage = async (bot, user, i18n) => {
  try {
    await bot.telegram.sendMessage(user.tg_id, i18n.t('refund_cooperativecancel'));
  } catch (error) {
    console.log(error);
  }
};

const initCooperativeCancelMessage = async (ctx, order) => {
  try {
    await ctx.reply(ctx.i18n.t('init_cooperativecancel', { orderId: order._id }));
  } catch (error) {
    console.log(error);
  }
};

const counterPartyWantsCooperativeCancelMessage = async (bot, user, order, i18n) => {
  try {
    await bot.telegram.sendMessage(user.tg_id, i18n.t('counterparty_wants_cooperativecancel', { orderId: order._id }));
    await bot.telegram.sendMessage(user.tg_id, i18n.t('cancel_order_cmd', { orderId: order._id }), { parse_mode: "MarkdownV2" });
  } catch (error) {
    console.log(error);
  }
};

const invoicePaymentFailedMessage = async (bot, user, i18n) => {
  try {
    await bot.telegram.sendMessage(user.tg_id, i18n.t('invoice_payment_failed', {
      pendingPaymentWindow: process.env.PENDING_PAYMENT_WINDOW,
    }));
  } catch (error) {
    console.log(error);
  }
};

const userCantTakeMoreThanOneWaitingOrderMessage = async (ctx, bot, user) => {
  try {
    await bot.telegram.sendMessage(user.tg_id, ctx.i18n.t('cant_take_more_orders'));
  } catch (error) {
    console.log(error);
  }
};

const sellerPaidHoldMessage = async (ctx, bot, user) => {
  try {
    await bot.telegram.sendMessage(user.tg_id, ctx.i18n.t('seller_released'));
  } catch (error) {
    console.log(error);
  }
};

const showInfoMessage = async (bot, user, info) => {
  try {
    // const status = !!info.public_key;
    // const statusEmoji = status ? '🟢' : '🔴';
    let fee = (process.env.FEE * 100).toString();
    fee = fee.replace('.', '\\.');
    await bot.telegram.sendMessage(user.tg_id, `*Bot fee*: ${fee}%`, { parse_mode: "MarkdownV2" });
    // if (status) {
    //   await bot.telegram.sendMessage(user.tg_id, `*Node pubkey*: ${info.public_key}\n`, { parse_mode: "MarkdownV2" });
    // }
  } catch (error) {
    console.log(error);
  }
};

const buyerReceivedSatsMessage = async (bot, buyerUser, sellerUser, i18n) => {
  try {
    await bot.telegram.sendMessage(buyerUser.tg_id, i18n.t('your_purchase_is_completed', {
      sellerUsername: sellerUser.username,
    }));
  } catch (error) {
    console.log(error);
  }
};

const listCurrenciesResponse = async (ctx, currencies) => {
  try {
    let response = `Code |   Name   |\n`;
    currencies.forEach(currency => {
      response += `${currency.code} | ${currency.name} | ${currency.emoji}\n`;
    });
    await ctx.reply(response);
  } catch (error) {
    console.log(error);
  }
};

const priceApiFailedMessage = async (ctx, bot, user) => {
  try {
    await bot.telegram.sendMessage(user.tg_id, ctx.i18n.t('problem_getting_price'));
  } catch (error) {
    console.log(error);
  }
};

const updateUserSettingsMessage = async (ctx, field, newState) => {
  try {
    await ctx.reply(ctx.i18n.t('update_user_setting', {
      field,
      newState,
    }));
  } catch (error) {
    console.log(error);
  }
};

const disableLightningAddress = async (ctx) => {
  try {
    await ctx.reply(ctx.i18n.t('lightning_address_disabled'));
  } catch (error) {
    console.log(error);
  }
};

const invalidRangeWithAmount = async (ctx) => {
  try {
    await ctx.reply(ctx.i18n.t('invalid_range_with_amount'));
  } catch (error) {
    console.log(error);
  }
};

const tooManyPendingOrdersMessage = async (bot, user, i18n) => {
  try {
    bot.telegram.sendMessage(user.tg_id, i18n.t('too_many_pending_orders'));
  } catch (error) {
    console.log(error);
  }
};

const listCommunitiesMessage = async (ctx, communities) => {
  try {
    let message = '';
    communities.forEach(community => {
      message += `ID: ${community.id}\n`;
      message += ctx.i18n.t('name') +`: ${community.name}\n`;
      message += ctx.i18n.t('group') + `: ${community.group}\n`;
      community.order_channels.forEach(channel => {
        message += ctx.i18n.t('channel') + ` ${channel.type}: ${channel.name}\n`;
      });
      community.solvers.forEach(solver => {
        message += ctx.i18n.t('solver') + `: ${solver.username}\n`;
      });
      message += ctx.i18n.t('published') + `: ${community.public ? ctx.i18n.t('yes') : ctx.i18n.t('no')}\n`;
      message += ctx.i18n.t('created') + `: ${community.created_at}\n\n`;
    });
    await ctx.reply(message);
  } catch (error) {
    console.log(error);
  }
};

const wizardAddInvoiceInitMessage = async (ctx, order, currency, expirationTime) => {
  try {
    await ctx.reply(ctx.i18n.t('wizard_add_invoice_init', {
      expirationTime,
      satsAmount: order.amount,
      currency,
      fiatAmount: order.fiat_amount,
    }));
  } catch (error) {
    console.log(error);
  }
};

const wizardAddInvoiceExitMessage = async (ctx, order) => {
  try {
    await ctx.reply(ctx.i18n.t('wizard_add_invoice_exit', {
      amount: order.amount,
      orderId: order._id,
    }));
  } catch (error) {
    console.log(error);
  }
};

const wizardCommunityEnterNameMessage = async (ctx) => {
  try {
    await ctx.reply(ctx.i18n.t('wizard_community_enter_name'));
  } catch (error) {
    console.log(error);
  }
};

const wizardExitMessage = async (ctx) => {
  try {
    await ctx.reply(ctx.i18n.t('wizard_exit'));
  } catch (error) {
    console.log(error);
  }
};

const orderExpiredMessage = async (ctx) => {
  try {
    await ctx.reply(ctx.i18n.t('order_expired'));
  } catch (error) {
    console.log(error);
  }
};

const cantAddInvoiceMessage = async (ctx) => {
  try {
    await ctx.reply(ctx.i18n.t('cant_add_invoice'));
  } catch (error) {
    console.log(error);
  }
};

const wizardCommunityTooLongNameMessage = async (ctx, length) => {
  try {
    await ctx.reply(ctx.i18n.t('wizard_community_too_long_name', { length }));
  } catch (error) {
    console.log(error);
  }
};

const wizardCommunityEnterGroupMessage = async (ctx) => {
  try {
    await ctx.reply(ctx.i18n.t('wizard_community_enter_group'));
  } catch (error) {
    console.log(error);
  }
};

const wizardCommunityEnterOrderChannelsMessage = async (ctx) => {
  try {
    await ctx.reply(ctx.i18n.t('wizard_community_enter_order_channels'));
  } catch (error) {
    console.log(error);
  }
};

const wizardCommunityOneOrTwoChannelsMessage = async (ctx) => {
  try {
    await ctx.reply(ctx.i18n.t('wizard_community_one_or_two_channels'));
  } catch (error) {
    console.log(error);
  }
};

const wizardCommunityEnterSolversMessage = async (ctx) => {
  try {
    await ctx.reply(ctx.i18n.t('wizard_community_enter_solvers'));
  } catch (error) {
    console.log(error);
  }
};

const wizardCommunityMustEnterNamesSeparatedMessage = async (ctx) => {
  try {
    await ctx.reply(ctx.i18n.t('wizard_community_must_enter_names'));
  } catch (error) {
    console.log(error);
  }
};

const wizardCommunityEnterSolversChannelMessage = async (ctx) => {
  try {
    await ctx.reply(ctx.i18n.t('wizard_community_enter_solvers_channel'));
  } catch (error) {
    console.log(error);
  }
};

const wizardCommunityCreatedMessage = async (ctx) => {
  try {
    await ctx.reply(ctx.i18n.t('wizard_community_success'));
  } catch (error) {
    console.log(error);
  }
};

const wizardCommunityWrongPermission = () => {
  return `You are not admin on this group or channel.`;
};

const wizardAddFiatAmountMessage = async (ctx, currency, action, order) => {
  try {
    await ctx.reply(ctx.i18n.t('wizard_add_fiat_amount', {
      action,
      currency,
      fiatAmount: order.fiat_amount,
      minAmount: order.min_amount,
      maxAmount: order.max_amount,
    }));
  } catch (error) {
    console.log(error);
  }
};

const wizardAddFiatAmountWrongAmountMessage = async (ctx, order) => {
  try {
    await ctx.reply(ctx.i18n.t('wizard_add_fiat_wrong_amount', {
      minAmount: order.min_amount,
      maxAmount: order.max_amount,
    }));
  } catch (error) {
    console.log(error);
  }
};

const wizardAddFiatAmountCorrectMessage = async (ctx, currency, fiatAmount) => {
  try {
    await ctx.reply(ctx.i18n.t('wizard_add_fiat_correct_amount', {
      currency: currency.symbol_native,
      fiatAmount,
    }));
  } catch (error) {
    console.log(error);
  }
};

const expiredOrderMessage = async (bot, order, buyerUser, sellerUser, i18n) => {
  try {
    const detailedOrder = getDetailedOrder(i18n, order, buyerUser, sellerUser);
    await bot.telegram.sendMessage(
      process.env.ADMIN_CHANNEL,
      i18n.t('expired_order', {
        detailedOrder,
        buyerUser,
        sellerUser,
      }),
      { parse_mode: 'MarkdownV2' },
    );
  } catch (error) {
    console.log(error);
  }
};

const toBuyerExpiredOrderMessage = async (bot, user, i18n) => {
  try {
    await bot.telegram.sendMessage(user.tg_id, i18n.t('expired_order_to_buyer'));
  } catch (error) {
    console.log(error);
  }
};

const toSellerExpiredOrderMessage = async (bot, user, i18n) => {
  try {
    await bot.telegram.sendMessage(user.tg_id, i18n.t('expired_order_to_seller'));
  } catch (error) {
    console.log(error);
  }
};

const toBuyerDidntAddInvoiceMessage = async (bot, user, order, i18n) => {
  try {
    await bot.telegram.sendMessage(user.tg_id, i18n.t('didnt_add_invoice', { orderId: order._id }));
  } catch (error) {
    console.log(error);
  }
};

const toSellerBuyerDidntAddInvoiceMessage = async (bot, user, order, i18n) => {
  try {
    await bot.telegram.sendMessage(user.tg_id, i18n.t('buyer_havent_add_invoice', { orderId: order._id }));
  } catch (error) {
    console.log(error);
  }
};

const toAdminChannelBuyerDidntAddInvoiceMessage = async (bot, user, order, i18n) => {
  try {
    await bot.telegram.sendMessage(process.env.ADMIN_CHANNEL, i18n.t('buyer_havent_add_invoice_to_admin_channel', {
      orderId: order._id,
      username: user.username,
    }));
  } catch (error) {
    console.log(error);
  }
};

const toSellerDidntPayInvoiceMessage = async (bot, user, order, i18n) => {
  try {
    await bot.telegram.sendMessage(user.tg_id, i18n.t('havent_paid_invoice', { orderId: order._id }));
  } catch (error) {
    console.log(error);
  }
};

const toBuyerSellerDidntPayInvoiceMessage = async (bot, user, order, i18n) => {
  try {
    await bot.telegram.sendMessage(user.tg_id, i18n.t('seller_havent_paid_invoice', { orderId: order._id }));
  } catch (error) {
    console.log(error);
  }
};

const toAdminChannelSellerDidntPayInvoiceMessage = async (bot, user, order, i18n) => {
  try {
    await bot.telegram.sendMessage(process.env.ADMIN_CHANNEL, i18n.t('seller_havent_add_invoice_to_admin_channel', {
      orderId: order._id,
      username: user.username,
    }));
  } catch (error) {
    console.log(error);
  }
};

const userCantDoMessage = async (ctx) => {
  try {
    await ctx.reply(ctx.i18n.t('user_cant_do'));
  } catch (error) {
    console.log(error);
  }
};

const toAdminChannelPendingPaymentSuccessMessage = async (bot, user, order, pending, payment, i18n) => {
  try {
    await bot.telegram.sendMessage(process.env.ADMIN_CHANNEL, i18n.t('pending_payment_success_to_admin', {
      orderId: order._id,
      username: user.username,
      attempts: pending.attempts,
      amount: order.amount,
      paymentSecret: payment.secret,
    }));
  } catch (error) {
    console.log(error);
  }
};

const toBuyerPendingPaymentSuccessMessage = async (bot, user, order, payment, i18n) => {
  try {
    await bot.telegram.sendMessage(user.tg_id, i18n.t('pending_payment_success', {
      orderId: order._id,
      amount: order.amount,
      paymentSecret: payment.secret,
    }));
  } catch (error) {
    console.log(error);
  }
};

const toBuyerPendingPaymentFailedMessage = async (bot, user, order, i18n) => {
  try {
    await bot.telegram.sendMessage(user.tg_id, i18n.t('pending_payment_failed'));
    await bot.telegram.sendMessage(
      user.tg_id,
      i18n.t('setinvoice_cmd_order', { orderId: order._id }),
      { parse_mode: "MarkdownV2" },
    );
  } catch (error) {
    console.log(error);
  }
};

const toAdminChannelPendingPaymentFailedMessage = async (bot, user, order, pending, i18n) => {
  try {
    await bot.telegram.sendMessage(process.env.ADMIN_CHANNEL, i18n.t('pending_payment_failed_to_admin', {
      attempts: pending.attempts,
      orderId: order._id,
      username: user.username,
    }));
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
  successCompleteOrderByAdminMessage,
  successCompleteOrderMessage,
  successCancelOrderByAdminMessage,
  successCancelOrderMessage,
  badStatusOnCancelOrderMessage,
  invoicePaymentFailedMessage,
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
  genericErrorMessage,
  refundCooperativeCancelMessage,
  toBuyerExpiredOrderMessage,
  toSellerExpiredOrderMessage,
};
