const { parsePaymentRequest } = require('invoices');
const messages = require('./messages');
const { Order, User } = require('../models');
const { isIso4217 } = require('../util');

// We look in database if the telegram user exists,
// if not, it creates a new user
const validateUser = async (ctx, start) => {
  const tgUser = ctx.update.message.from;
  let user = await User.findOne({ tg_id: tgUser.id });
  if (!user && start) {
    user = new User({
      tg_id: tgUser.id,
      username: tgUser.username,
      first_name: tgUser.first_name,
      last_name: tgUser.last_name,
    });
    await user.save();
  } else if (!user) {
    await messages.initBotErrorMessage(ctx);
  } else if (user.banned) {
    await messages.bannedUserErrorMessage(ctx);

    return false;
  }
  return user;
};

const validateAdmin = async (ctx) => {
  const tgUser = ctx.update.message.from;
  let user = await User.findOne({ tg_id: tgUser.id });
  if (!user) {
    await bot.telegram.sendMessage(tgUser.id, 'No puede realizar esta operación');
    return false;
  } else if (!user.admin) {
    bot.telegram.sendMessage(tgUser.id, 'No puede realizar esta operación');
    return false;
  }
  return user;
};

const validateSellOrder = async (ctx, bot, user) => {
  const sellOrderParams = ctx.update.message.text.split(' ');
  if (sellOrderParams.length !== 5) {
    await messages.sellOrderCorrectFormatMessage(bot, user);
    return false;
  }
  let [_, amount, fiatAmount, fiatCode, paymentMethod] = sellOrderParams;
  amount = parseInt(amount);
  if (!Number.isInteger(amount)) {
    await messages.mustBeIntMessage(bot, user, 'monto_en_sats');
    return false;
  };

  if (amount < 100) {
    await messages.mustBeGreatherEqThan(bot, user, 'monto_en_sats', 100);
    return false;
  };

  if (isNaN(fiatAmount)) {
    await messages.mustBeANumber(bot, user, 'monto_en_fiat');
    return false;
  }

  if (fiatAmount < 1) {
    await messages.mustBeGreatherEqThan(bot, user, 'monto_en_fiat', 1);
    return false;
  };

  if (!isIso4217(fiatCode)) {
    await messages.mustBeValidCurrency(bot, user, 'codigo_fiat');
    return false
  };

  return {amount, fiatAmount, fiatCode, paymentMethod};
};

const validateBuyOrder = async (ctx, bot, user) => {
  const buyOrderParams = ctx.update.message.text.split(' ');
  if (buyOrderParams.length !== 6) {
    await messages.buyOrderCorrectFormatMessage(bot, user);
    return false;
  }
  let [_, amount, fiatAmount, fiatCode, paymentMethod, lnInvoice] = buyOrderParams;
  
  if (!lnInvoice) {
    await messages.customMessage(bot, user, "Por favor agrega una factura lightning para recibir los sats");
    return false;
  }

  amount = parseInt(amount);
  if (!Number.isInteger(amount)) {
    await messages.mustBeIntMessage(bot, user, 'monto_en_sats');
    return false;
  };

  if (amount < 100) {
    await messages.mustBeGreatherEqThan(bot, user, 'monto_en_sats', 100);
    return false;
  };
  
  if (isNaN(fiatAmount)) {
    await messages.mustBeANumber(bot, user, 'monto_en_fiat');
    return false;
  }

  if (fiatAmount < 1) {
    await messages.mustBeGreatherEqThan(bot, user, 'monto_en_fiat', 1);
    return false;
  };

  if (!isIso4217(fiatCode)) {
    await messages.mustBeValidCurrency(bot, user, 'codigo_fiat');
    return false
  };

  try {
    const invoice = parsePaymentRequest({ request: lnInvoice });

    if (!(await validateInvoice(bot, user, invoice))) return false;

    if (invoice.tokens != amount) {
      await messages.amountMustTheSameInvoiceMessage(bot, user, amount);
      return false;
    }

    const order = await Order.findOne({ buyer_invoice: lnInvoice });
    if (order) {
      await messages.repeatedInvoiceMessage(bot, user);
      return false;
    }

    return {amount, fiatAmount, fiatCode, paymentMethod, lnInvoice};
  } catch (error) {
    await messages.invalidInvoice(bot, user);
  }
};

const validateInvoice = async (bot, user, invoice) => {
  const latestDate = new Date(Date.now() + parseInt(process.env.INVOICE_EXPIRATION_WINDOW)).toISOString();
  if (invoice.tokens < 100) {
    await messages.minimunAmountInvoiceMessage(bot, user);
    return false;
  }

  if (new Date(invoice.expires_at) < latestDate) {
    await messages.minimunExpirationTimeInvoiceMessage(bot, user);
    return false;
  }

  if (invoice.is_expired !== false) {
    await messages.expiredInvoiceMessage(bot, user);
    return false;
  }

  if (!invoice.destination) {
    await messages.requiredAddressInvoiceMessage(bot, user);
    return false;
  }

  if (!invoice.id) {
    await messages.requiredHashInvoiceMessage(bot, user);
    return false;
  }

  return true;
};

const validateTakeSell = async (ctx, bot, user) => {
  const takeSellParams = ctx.update.message.text.split(' ');
  if (takeSellParams.length !== 3) {
    await messages.takeSellCorrectFormatMessage(bot, user);
    return false;
  }
  const [_, orderId, lnInvoice] = takeSellParams;
  if (!lnInvoice) {
    await messages.customMessage(bot, user, "Por favor agrega una factura lightning para recibir los sats");
    return false;
  }
  try {
    const invoice = parsePaymentRequest({ request: lnInvoice });

    if (!(await validateInvoice(bot, user, invoice))) return;
  } catch (error) {
    await messages.invalidInvoice(bot, user);
  }

  return {orderId, lnInvoice};
};

const validateTakeSellOrder = async (bot, user, lnInvoice, order) => {
  const invoice = parsePaymentRequest({ request: lnInvoice });
  const latestDate = new Date(Date.now() + parseInt(process.env.INVOICE_EXPIRATION_WINDOW)).toISOString();
  if (invoice.tokens !== order.amount) {
    await messages.amountMustTheSameInvoiceMessage(bot, user, order.amount);
    return false;
  }
  if (new Date(invoice.expires_at) < latestDate) {
    await messages.minimunExpirationTimeInvoiceMessage(bot, user);
    return false;
  }
  if (!order) {
    await messages.invalidOrderMessage(bot, user);
    return false;
  }
  if (order.type === 'buy') {
    await messages.invalidTypeOrderMessage(bot, user, order.type);
    return false;
  }
  if (order.status !== 'PENDING') {
    await messages.alreadyTakenOrderMessage(bot, user);
    return false;
  }
  return true;
};

const validateTakeBuy = async (ctx, bot, user) => {
  const takeBuyParams = ctx.update.message.text.split(' ');
  if (takeBuyParams.length !== 2) {
    await messages.takeBuyCorrectFormatMessage(bot, user);
    return false;
  }
  return takeBuyParams[1];
};

const validateTakeBuyOrder = async (bot, user, order) => {
  if (!order) {
    await messages.invalidOrderMessage(bot, user);
    return false;
  }
  if (order.type === 'sell') {
    await messages.invalidTypeOrderMessage(bot, user, order.type);
    return false;
  }
  if (order.status !== 'PENDING') {
    await messages.alreadyTakenOrderMessage(bot, user);
    return false;
  }
  return true;
};

const validateRelease = async (ctx, bot, user) => {
  const releaseParams = ctx.update.message.text.split(' ');
  if (releaseParams.length !== 2) {
    await messages.releaseCorrectFormatMessage(bot, user);
    return false;
  }
  return releaseParams[1];
};

const validateReleaseOrder = async (bot, user, orderId) => {
  const where = {
    seller_id: user._id,
    $or: [
      {status: 'ACTIVE'},
      {status: 'FIAT_SENT'},
    ],
  };

  if (!!orderId) {
    where._id = orderId;
  }
  const order = await Order.findOne(where);

  if (!order) {
    await messages.notActiveOrderMessage(bot, user);
    return false;
  }

  return order;
};

const validateDispute = async (ctx, bot, user) => {
  const disputeParams = ctx.update.message.text.split(' ');
  if (disputeParams.length !== 2) {
    await messages.disputeCorrectFormatMessage(bot, user);
    return false;
  }

  return disputeParams[1];
};

const validateDisputeOrder = async (bot, user, orderId) => {
  const where = {
    status: 'ACTIVE',
    _id: orderId,
    $or: [
      {seller_id: user._id},
      {buyer_id: user._id},
    ],
  };

  const order = await Order.findOne(where);
  if (!order) {
    await messages.notActiveOrderMessage(bot, user);
    return false;
  }

  return order;
};

const validateCancel = async (ctx, bot, user) => {
  const cancelParams = ctx.update.message.text.split(' ');
  if (cancelParams.length !== 2) {
    await messages.cancelCorrectFormatMessage(bot, user);
    return false;
  }

  return cancelParams[1];
};

const validateCooperativeCancel = async (ctx, bot, user) => {
  const cancelParams = ctx.update.message.text.split(' ');
  if (cancelParams.length !== 2) {
    await messages.cooperativeCancelCorrectFormatMessage(bot, user);
    return false;
  }

  return cancelParams[1];
};

const validateCancelAdmin = async (ctx, bot, user) => {
  const cancelParams = ctx.update.message.text.split(' ');
  if (cancelParams.length !== 2) {
    await messages.customMessage(bot, user, '/cancelorder <order_id>');
    return false;
  }

  return cancelParams[1];
};

const validateSettleAdmin = async (ctx, bot, user) => {
  const cancelParams = ctx.update.message.text.split(' ');
  if (cancelParams.length !== 2) {
    await messages.customMessage(bot, user, '/settleorder <order_id>');
    return false;
  }

  return cancelParams[1];
};

const validateFiatSent = async (ctx, bot, user) => {
  const sentFiatParams = ctx.update.message.text.split(' ');
  if (sentFiatParams.length !== 2) {
    await messages.fiatSentCorrectFormatMessage(bot, user);
    return false;
  }

  return sentFiatParams[1];
};

const validateFiatSentOrder = async (bot, user, orderId) => {
  const where = {
    buyer_id: user._id,
    status: 'ACTIVE',
  };

  if (!!orderId) {
    where._id = orderId;
  }
  const order = await Order.findOne(where);
  if (!order) {
    await messages.notActiveOrderMessage(bot, user);
    return false;
  }

  return order;
};

// If a seller have an order with status FIAT_SENT, return false
const validateSeller = async (bot, user) => {
  const where = {
    seller_id: user._id,
    status: 'FIAT_SENT',
  };

  const order = await Order.findOne(where);
  if (!!order) {
    await messages.orderOnfiatSentStatusMessages(bot, user);
    return false;
  }

  return true;
};

module.exports = {
  validateSellOrder,
  validateBuyOrder,
  validateUser,
  validateAdmin,
  validateInvoice,
  validateTakeSell,
  validateTakeSellOrder,
  validateTakeBuy,
  validateTakeBuyOrder,
  validateRelease,
  validateReleaseOrder,
  validateDispute,
  validateDisputeOrder,
  validateCancel,
  validateCancelAdmin,
  validateSettleAdmin,
  validateFiatSent,
  validateFiatSentOrder,
  validateSeller,
  validateCooperativeCancel,
};
