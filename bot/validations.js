const { parsePaymentRequest } = require('invoices');
const { ObjectId } = require('mongoose').Types;
const messages = require('./messages');
const { Order, User } = require('../models');
const { isIso4217, parseArguments, parseArgs } = require('../util');

// We look in database if the telegram user exists,
// if not, it creates a new user
const validateUser = async (ctx, bot, start) => {
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
    await messages.initBotErrorMessage(bot, tgUser.id);
  } else if (user.banned) {
    await messages.bannedUserErrorMessage(ctx);

    return false;
  }
  return user;
};

const validateAdmin = async (ctx, bot) => {
  const tgUser = ctx.update.message.from;
  let user = await User.findOne({ tg_id: tgUser.id });
  if (!user) {
    await bot.telegram.sendMessage(tgUser.id, 'Este usuario no puede realizar esta operación');
    return false;
  } else if (!user.admin) {
    bot.telegram.sendMessage(tgUser.id, 'Este usuario no puede realizar esta operación');
    return false;
  }
  return user;
};

const validateSellOrder = async (ctx, bot, user) => {

  const args = parseArgs(ctx.update.message.text);
  if (args.length < 5 ) {
    await messages.sellOrderCorrectFormatMessage(bot, user);
    return false;
  }

  let [ _, amount, fiatAmount, fiatCode, paymentMethod, showUsername ] = args;

  if (!!showUsername && showUsername != 'y') {
    await messages.showUsernameErrorMessage(bot, user);
    return false;
  }

  amount = parseInt(amount);
  if (!Number.isInteger(amount)) {
    await messages.mustBeIntMessage(bot, user, 'monto_en_sats');
    return false;
  };

  if (amount != 0 && amount < 100) {
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

  return {
    amount,
    fiatAmount,
    fiatCode: fiatCode.toUpperCase(),
    paymentMethod,
    showUsername,
  };
};

const validateBuyOrder = async (ctx, bot, user) => {
  const args = parseArgs(ctx.update.message.text);
  if (args.length < 5) {
    await messages.buyOrderCorrectFormatMessage(bot, user);
    return false;
  }
  let [ _, amount, fiatAmount, fiatCode, paymentMethod, showUsername ] = args;

  if (!!showUsername && showUsername != 'y') {
    await messages.showUsernameErrorMessage(bot, user);
    return false;
  }

  amount = parseInt(amount);
  if (!Number.isInteger(amount)) {
    await messages.mustBeIntMessage(bot, user, 'monto_en_sats');
    return false;
  };

  if (amount != 0 && amount < 100) {
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

  return {
    amount,
    fiatAmount,
    fiatCode: fiatCode.toUpperCase(),
    paymentMethod,
    showUsername,
  };
};

const validateInvoice = async (bot, user, lnInvoice) => {
  try {
    const invoice = parsePaymentRequest({ request: lnInvoice });
    const latestDate = new Date(Date.now() + parseInt(process.env.INVOICE_EXPIRATION_WINDOW)).toISOString();
    if (!!invoice.tokens && invoice.tokens < 100) {
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

    return invoice;
  } catch (error) {
    await messages.errorParsingInvoiceMessage(bot, user);
    return false;
  }
};

const isValidInvoice = async (lnInvoice) => {
  try {
    const invoice = parsePaymentRequest({ request: lnInvoice });
    const latestDate = new Date(Date.now() + parseInt(process.env.INVOICE_EXPIRATION_WINDOW)).toISOString();
    if (!!invoice.tokens && invoice.tokens < 100) {
      return {
        success: false,
        error: "La factura debe ser mayor o igual a 100 satoshis",
      };
    }

    if (new Date(invoice.expires_at) < latestDate) {
      return {
        success: false,
        error: "El tiempo de expiración de la factura es muy corto",
      };
    }

    if (invoice.is_expired !== false) {
      return {
        success: false,
        error: "La factura ha expirado",
      };
    }

    if (!invoice.destination) {
      return {
        success: false,
        error: "La factura necesita una dirección destino",
      };
    }

    if (!invoice.id) {
      return {
        success: false,
        error: "La factura necesita un hash",
      };
    }

    return {
      success: true,
      error: '',
      invoice,
    };
  } catch (error) {
    return {
      success: false,
      error: "Error parseando la factura, recuerda que solo debes indicarme la factura lightning, debe comenzar por lnbc1,\n\nPara volver al modo donde puedes ingresar comandos solo escribe la palabra: exit",
    };
  }
};

const isOrderCreator = (user, order) => {
  if (order.creator_id == user._id) {
    return true
  };

  return false;
};

const validateTakeSellOrder = async (bot, user, order) => {
  if (!order) {
    await messages.invalidOrderMessage(bot, user);
    return false;
  }
  if (isOrderCreator(user, order)) {
    await messages.cantTakeOwnOrderMessage(bot, user);
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

const validateTakeBuyOrder = async (bot, user, order) => {
  if (!order) {
    await messages.invalidOrderMessage(bot, user);
    return false;
  }
  if (isOrderCreator(user, order)) {
    await messages.cantTakeOwnOrderMessage(bot, user);
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

const validateFiatSentOrder = async (bot, user, orderId) => {
  const where = {
    buyer_id: user._id,
    status: 'ACTIVE',
  };

  if (!!orderId) {
    where._id = orderId;
  }
  try {
    const order = await Order.findOne(where);
    if (!order) {
      await messages.notActiveOrderMessage(bot, user);
      return false;
    }

    if (!order.buyer_invoice) {
      await messages.notLightningInvoiceMessage(bot, user, order);
      return false;
    }

    return order;
  } catch (error) {
    await messages.customMessage(bot, user, '/fiatsent <order_id>');
    return false;
  }
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

const validateParams = async (ctx, bot, user, paramNumber, errOutputString) => {
  const paramsArray = ctx.update.message.text.split(' ');
  const params = paramsArray.filter(el => el != '');
  if (params.length != paramNumber) {
    await messages.customMessage(bot, user, `${params[0]} ${errOutputString}`);

    return [];
  }

  return params.slice(1);
};

const validateObjectId = async (bot, user, id) => {
  if (!ObjectId.isValid(id)) {
    await messages.notValidIdMessage(bot, user);
    return false;
  }
  return true;
};

const validateUserWaitingOrder = async (bot, user) => {
  const where = {
    $and: [
      {
        $or: [
          {seller_id: user._id},
          {buyer_id: user._id},
        ],
      },
      {
        $or: [
          {status: 'WAITING_BUYER_INVOICE'},
          {status: 'WAITING_PAYMENT'},
        ],
      },
    ],
  };
  const orders = await Order.find(where);
  if (orders.length > 0) {
    await messages.userCantTakeMoreThanOneWaitingOrderMessage(bot, user);
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
  validateTakeSellOrder,
  validateTakeBuyOrder,
  validateReleaseOrder,
  validateDisputeOrder,
  validateFiatSentOrder,
  validateSeller,
  validateParams,
  validateObjectId,
  isValidInvoice,
  validateUserWaitingOrder,
};
