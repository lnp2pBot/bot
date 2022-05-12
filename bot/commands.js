const { I18n } = require('@grammyjs/i18n');
const {
    validateSeller,
    validateObjectId,
    validateTakeBuyOrder,
    validateTakeSellOrder,
    validateUserWaitingOrder,
  } = require('./validations');
  const {
    createHoldInvoice,
    subscribeInvoice,
  } = require('../ln');
const { Order, User, Community } = require('../models');
const messages = require('./messages');
const {
  getBtcFiatPrice,
  extractId,
  deleteOrderFromChannel,
  getUserI18nContext,
} = require('../util');
const { resolvLightningAddress } = require("../lnurl/lnurl-pay");
const logger = require('../logger');

const takebuy = async (ctx, bot) => {
  try {
    const text = ctx.update.callback_query.message.text;
    if (!text) return;

    const tgUser = ctx.update.callback_query.from;
    if (!tgUser) return;
    const user = await User.findOne({ tg_id: tgUser.id });

    // If user didn't initialize the bot we can't do anything
    if (!user) {
      return;
    }

    // We check if the user has the same username that we have
    if (tgUser.username != user.username) {
      user.username = tgUser.username;
      await user.save();
    }

    if (!(await validateUserWaitingOrder(ctx, bot, user))) return;

    // Sellers with orders in status = FIAT_SENT, have to solve the order
    const isOnFiatSentStatus = await validateSeller(ctx, bot, user);

    if (!isOnFiatSentStatus) return;
    const orderId = extractId(text);
    if (!orderId) return;
    if (!(await validateObjectId(ctx, orderId))) return;
    const order = await Order.findOne({ _id: orderId });
    if (!(await validateTakeBuyOrder(ctx, bot, user, order))) return;
    // We change the status to trigger the expiration of this order
    // if the user don't do anything
    order.status = 'WAITING_PAYMENT';
    order.seller_id = user._id;
    order.taken_at = Date.now();
    await order.save();
    // We delete the messages related to that order from the channel
    await deleteOrderFromChannel(order, bot.telegram);
    await messages.beginTakeBuyMessage(ctx, bot, user, order);
  } catch (error) {
    logger.error(error);
  }
};

const takesell = async (ctx, bot) => {
  try {
    const text = ctx.update.callback_query.message.text;
    if (!text) return;
    const tgUser = ctx.update.callback_query.from;
    if (!tgUser) return;
    let user = await User.findOne({ tg_id: tgUser.id });
    // If user didn't initialize the bot we can't do anything
    if (!user) {
      return;
    }
    // We check if the user has the same username that we have
    if (tgUser.username != user.username) {
      user.username = tgUser.username;
      await user.save();
    }

    if (!(await validateUserWaitingOrder(ctx, bot, user))) return;
    const orderId = extractId(text);
    if (!orderId) return;
    const order = await Order.findOne({ _id: orderId });
    if (!(await validateTakeSellOrder(ctx, bot, user, order))) return;
    order.status = 'WAITING_BUYER_INVOICE';
    order.buyer_id = user._id;
    order.taken_at = Date.now();

    await order.save();
    // We delete the messages related to that order from the channel
    await deleteOrderFromChannel(order, bot.telegram);
    await messages.beginTakeSellMessage(ctx, bot, user, order);
  } catch (error) {
    logger.error(error);
  }
};

const waitPayment = async (ctx, bot, buyer, seller, order, buyerInvoice) => {
  try {
    order.buyer_invoice = buyerInvoice;
    // We need the i18n context to send the message with the correct language
    const i18nCtx = await getUserI18nContext(seller);
    // If the buyer is the creator, at this moment the seller already paid the hold invoice
    if (order.creator_id == order.buyer_id) {
      order.status = 'ACTIVE';
      // Message to buyer
      await messages.addInvoiceMessage(ctx, bot, buyer, seller, order);
      // Message to seller
      await messages.sendBuyerInfo2SellerMessage(bot, buyer, seller, order, i18nCtx);
    } else {
      // We create a hold invoice
      const description = `Venta por @${ctx.botInfo.username} #${order._id}`;
      const amount = Math.floor(order.amount + order.fee);
      const { request, hash, secret } = await createHoldInvoice({
        amount,
        description,
      });
      order.hash = hash;
      order.secret = secret;
      order.taken_at = Date.now();
      order.status = 'WAITING_PAYMENT';
      // We monitor the invoice to know when the seller makes the payment
      await subscribeInvoice(bot, hash);

      // We send the hold invoice to the seller
      await messages.invoicePaymentRequestMessage(bot, seller, request, order, i18nCtx);
      await messages.takeSellWaitingSellerToPayMessage(ctx, bot, buyer, order);
    }
    await order.save();
  } catch (error) {
    logger.error(error);
  }
}

const addInvoice = async (ctx, bot, order) => {
  try {
    ctx.deleteMessage();
    ctx.scene.leave();
    if (!order) {
      const orderId = ctx.update.callback_query.message.text;
      if (!orderId) return;
      order = await Order.findOne({ _id: orderId });
      if (!order) return;
    }

    // Buyers only can take orders with status WAITING_BUYER_INVOICE
    if (order.status != 'WAITING_BUYER_INVOICE') {
      return;
    }

    const buyer = await User.findOne({ _id: order.buyer_id });

    if(order.fiat_amount === undefined) {
      ctx.scene.enter('ADD_FIAT_AMOUNT_WIZARD_SCENE_ID', { bot, order, caller: buyer });
      return;
    }

    let amount = order.amount;
    if (amount == 0) {
        amount = await getBtcFiatPrice(order.fiat_code, order.fiat_amount);
        const marginPercent = order.price_margin / 100;
        amount = amount - (amount * marginPercent);
        amount = Math.floor(amount);
        order.fee = Math.round(amount * parseFloat(process.env.FEE));
        order.amount = amount;
    }

    // If the price API fails we can't continue with the process
    if (order.amount == 0) {
      await messages.priceApiFailedMessage(ctx, bot, buyer);
      return;
    }
    await order.save();
    const seller = await User.findOne({ _id: order.seller_id });

    if (buyer.lightning_address) {
      let laRes = await resolvLightningAddress(buyer.lightning_address, order.amount * 1000);
      if (!!laRes && !laRes.pr) {
        logger.warn(`lightning address ${buyer.lightning_address} not available`);
        messages.unavailableLightningAddress(ctx, bot, buyer, buyer.lightning_address);
        ctx.scene.enter('ADD_INVOICE_WIZARD_SCENE_ID', { order, seller, buyer, bot });
      } else {
        await waitPayment(ctx, bot, buyer, seller, order, laRes.pr);
      }
    } else {
      ctx.scene.enter('ADD_INVOICE_WIZARD_SCENE_ID', { order, seller, buyer, bot });
    }
  } catch (error) {
    logger.error(error);
  }
};

const rateUser = async (ctx, bot, rating, orderId) => {
  try {
    ctx.deleteMessage();
    ctx.scene.leave();
    const callerId = ctx.from.id;

    if (!orderId) return;
    const order = await Order.findOne({ _id: orderId });

    if (!order) return;
    const buyer = await User.findOne({ _id: order.buyer_id });
    const seller = await User.findOne({ _id: order.seller_id });

    let targetUser = buyer;
    if (callerId == buyer.tg_id) {
      targetUser = seller;
    }

    // User can only rate other after a successful exchange
    if (!(order.status == 'SUCCESS' || order.status == 'PAID_HOLD_INVOICE')) {
      await messages.invalidDataMessage(ctx, bot, targetUser);
      return;
    }

    const response = { rating };
    await saveUserReview(targetUser, response);
  } catch (error) {
    logger.error(error);
  }
};

const saveUserReview = async (targetUser, review) => {
  try {
    targetUser.reviews.push(review);
    const totalReviews = targetUser.reviews.length;
    const oldRating = targetUser.total_rating;
    const lastRating = targetUser.reviews[totalReviews - 1].rating;
    // newRating is an average of all the ratings given to the user.
    // Its formula is based on the iterative method to compute mean,
    // as in:
    // https://math.stackexchange.com/questions/2148877/iterative-calculation-of-mean-and-standard-deviation
    const newRating = oldRating + ((lastRating - oldRating) / totalReviews);
    targetUser.total_rating = newRating || 0;

    await targetUser.save()
  } catch (error) {
    logger.error(error);
  }
};

const cancelAddInvoice = async (ctx, bot, order) => {
  try {
    if (!!ctx) {
      ctx.deleteMessage();
      ctx.scene.leave();
    }
    let userAction = false;
    if (!order) {
      userAction = true;
      const orderId = !!ctx && ctx.update.callback_query.message.text;
      if (!orderId) return;
      order = await Order.findOne({ _id: orderId });
      if (!order) return;
    }

    const user = await User.findOne({ _id: order.buyer_id });

    if (!user) return;

    const i18nCtx = await getUserI18nContext(user);
    // Buyers only can cancel orders with status WAITING_BUYER_INVOICE
    if (order.status != 'WAITING_BUYER_INVOICE') {
      await messages.genericErrorMessage(bot, user, i18nCtx);
      return;
    }
    const sellerUser = await User.findOne({ _id: order.seller_id });
    if (order.creator_id == order.buyer_id) {
      // We use a different var for order because we need to delete the order and
      // there are users that block the bot and it raises the catch block stopping 
      // the process
      const clonedOrder = order;
      await order.remove();
      await messages.toBuyerDidntAddInvoiceMessage(bot, user, clonedOrder, i18nCtx);
      const i18nCtxSeller = await getUserI18nContext(sellerUser);
      await messages.toSellerBuyerDidntAddInvoiceMessage(bot, sellerUser, clonedOrder, i18nCtxSeller);
    } else { // Re-publish order
      if (userAction) {
        logger.info(`User cancelled Order Id: ${order._id}, republishing to the channel`);
      } else {
        logger.info(`Order Id: ${order._id} expired, republishing to the channel`);
      }
      order.taken_at = null;
      order.status = 'PENDING';
      if (!!order.min_amount && !!order.max_amount) {
        order.fiat_amount = undefined;
      }
      if (order.price_from_api) {
        order.amount = 0;
        order.fee = 0;
        order.hash = null;
        order.secret = null;
      }

      if (order.type == 'buy') {
        order.seller_id = null;
        await messages.publishBuyOrderMessage(bot, user, order, i18nCtx);
      } else {
        order.buyer_id = null;
        await messages.publishSellOrderMessage(bot, sellerUser, order, i18nCtx);
      }
      await order.save();
      if (!userAction) {
        await messages.toAdminChannelBuyerDidntAddInvoiceMessage(bot, user, order, i18nCtx);
        await messages.toBuyerDidntAddInvoiceMessage(bot, user, order, i18nCtx);
      } else {
        await messages.successCancelOrderMessage(bot, user, order, i18nCtx);
      }
    }
  } catch (error) {
    logger.error(error);
  }
};

const showHoldInvoice = async (ctx, bot, order) => {
  try {
    ctx.deleteMessage();
    if (!order) {
      const orderId = ctx.update.callback_query.message.text;
      if (!orderId) return;
      order = await Order.findOne({ _id: orderId });
      if (!order) return;
    }

    const user = await User.findOne({ _id: order.seller_id });
    if (!user) return;

    // Sellers only can take orders with status WAITING_PAYMENT
    if (order.status != 'WAITING_PAYMENT') {
      await messages.invalidDataMessage(ctx, bot, user);
      return;
    }

    if(order.fiat_amount === undefined) {
      ctx.scene.enter('ADD_FIAT_AMOUNT_WIZARD_SCENE_ID', { bot, order, caller: user });
      return;
    }

    // We create the hold invoice and show it to the seller
    const description = `Venta por @${ctx.botInfo.username} #${order._id}`;
    let amount;
    if (order.amount == 0) {
      amount = await getBtcFiatPrice(order.fiat_code, order.fiat_amount);
      const marginPercent = order.price_margin / 100;
      amount = amount - (amount * marginPercent);
      amount = Math.floor(amount);
      order.fee = Math.round(amount * parseFloat(process.env.FEE));
      order.amount = amount;
    }
    amount = Math.floor(order.amount + order.fee);
    const { request, hash, secret } = await createHoldInvoice({
      description,
      amount,
    });
    order.hash = hash;
    order.secret = secret;
    await order.save();

    // We monitor the invoice to know when the seller makes the payment
    await subscribeInvoice(bot, hash);
    await messages.showHoldInvoiceMessage(ctx, request, amount, order.fiat_code, order.fiat_amount);
  } catch (error) {
    logger.error(error);
  }
};

const cancelShowHoldInvoice = async (ctx, bot, order) => {
  try {
    if (!!ctx) ctx.deleteMessage();
    let userAction = false;
    if (!order) {
      userAction = true;
      const orderId = !!ctx && ctx.update.callback_query.message.text;
      if (!orderId) return;
      order = await Order.findOne({ _id: orderId });
      if (!order) return;
    }

    const user = await User.findOne({ _id: order.seller_id });
    if (!user) return;
    const i18nCtx = await getUserI18nContext(user);
    // Sellers only can cancel orders with status WAITING_PAYMENT
    if (order.status != 'WAITING_PAYMENT') {
      await messages.genericErrorMessage(bot, user, i18nCtx);
      return;
    }

    const buyerUser = await User.findOne({ _id: order.buyer_id });
    if (order.creator_id == order.seller_id) {
      // We use a different var for order because we need to delete the order and
      // there are users that block the bot and it raises the catch block stopping 
      // the process
      const clonedOrder = order;
      await order.remove();
      await messages.toSellerDidntPayInvoiceMessage(bot, user, clonedOrder, i18nCtx);
      await messages.toBuyerSellerDidntPayInvoiceMessage(bot, buyerUser, clonedOrder, i18nCtx);
    } else { // Re-publish order
      if (userAction) {
        logger.info(`User cancelled Order Id: ${order._id}, republishing to the channel`);
      } else {
        logger.info(`Order Id: ${order._id} expired, republishing to the channel`);
      }
      order.taken_at = null;
      order.status = 'PENDING';

      if (!!order.min_amount && !!order.max_amount) {
        order.fiat_amount = undefined;
      }

      if (order.price_from_api) {
        order.amount = 0;
        order.fee = 0;
        order.hash = null;
        order.secret = null;
      }

      if (order.type == 'buy') {
        order.seller_id = null;
        await messages.publishBuyOrderMessage(bot, buyerUser, order, i18nCtx);
      } else {
        order.buyer_id = null;
        await messages.publishSellOrderMessage(bot, user, order, i18nCtx);
      }
      await order.save();
      if (!userAction) {
        await messages.toSellerDidntPayInvoiceMessage(bot, user, order, i18nCtx);
        await messages.toAdminChannelSellerDidntPayInvoiceMessage(bot, user, order, i18nCtx);
      } else {
        await messages.successCancelOrderMessage(bot, user, order, i18nCtx);
      }
    }
  } catch (error) {
    logger.error(error);
  }
};

const updateCommunity = async (ctx, id, field, bot) => {
  try {
    const tgUser = ctx.update.callback_query.from;
    if (!tgUser) return;
    const user = await User.findOne({ tg_id: tgUser.id });

    // If user didn't initialize the bot we can't do anything
    if (!user) {
      return;
    }

    // We check if the user has the same username that we have
    if (tgUser.username != user.username) {
      user.username = tgUser.username;
      await user.save();
    }

    if (!user) return;
    if (!id) return;
    if (!(await validateObjectId(ctx, id))) return;
    if (field == 'name') {
      ctx.scene.enter('UPDATE_NAME_COMMUNITY_WIZARD_SCENE_ID', { id, user });
    } else if (field == 'currencies') {
      ctx.scene.enter('UPDATE_CURRENCIES_COMMUNITY_WIZARD_SCENE_ID', { id, user });
    } else if (field == 'group') {
      ctx.scene.enter('UPDATE_GROUP_COMMUNITY_WIZARD_SCENE_ID', { id, bot, user });
    } else if (field == 'channels') {
      ctx.scene.enter('UPDATE_CHANNELS_COMMUNITY_WIZARD_SCENE_ID', { id, bot, user });
    } else if (field == 'solvers') {
      ctx.scene.enter('UPDATE_SOLVERS_COMMUNITY_WIZARD_SCENE_ID', { id, user });
    }
  } catch (error) {
    logger.error(error);
  }
};

/**
 *
 * This triggers a scene asking for a new invoice after a payment to a buyer failed
 * @param {*} bot
 * @param {*} order
 * @returns
 */
const addInvoicePHI = async (ctx, bot, orderId) => {
  try {
    ctx.deleteMessage();
    const order = await Order.findOne({ _id: orderId });
    // orders with status PAID_HOLD_INVOICE are released payments
    if (order.status != 'PAID_HOLD_INVOICE') {
      return;
    }

    const buyer = await User.findOne({ _id: order.buyer_id });
    if (!buyer) return;
    if (order.amount == 0) {
      await messages.genericErrorMessage(bot, buyer, ctx.i18n);
      return;
    }

    ctx.scene.enter('ADD_INVOICE_PHI_WIZARD_SCENE_ID', { order, buyer, bot });
  } catch (error) {
    logger.error(error);
  }
};

module.exports = {
  takebuy,
  takesell,
  rateUser,
  saveUserReview,
  cancelAddInvoice,
  waitPayment,
  addInvoice,
  cancelShowHoldInvoice,
  showHoldInvoice,
  updateCommunity,
  addInvoicePHI,
};
