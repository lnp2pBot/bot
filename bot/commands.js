const {
  validateFiatSentOrder,
  validateReleaseOrder,
} = require('./validations');
const {
  createHoldInvoice,
  subscribeInvoice,
  cancelHoldInvoice,
  settleHoldInvoice,
} = require('../ln');
const { Order, User, Dispute } = require('../models');
const messages = require('./messages');
const {
  getBtcFiatPrice,
  deleteOrderFromChannel,
  getUserI18nContext,
  getFee,
  getEmojiRate,
  decimalRound,
} = require('../util');
const ordersActions = require('./ordersActions');

const { resolvLightningAddress } = require('../lnurl/lnurl-pay');
const logger = require('../logger');

const waitPayment = async (ctx, bot, buyer, seller, order, buyerInvoice) => {
  try {
    // If there is not fiat amount the function don't do anything
    if (order.fiat_amount === undefined) {
      logger.debug(
        `waitPayment: fiat_amount === undefined, User Id ${ctx.user.id} order Id: ${order.id}`
      );
      return;
    }

    order.buyer_invoice = buyerInvoice;
    // We need the i18n context to send the message with the correct language
    const i18nCtx = await getUserI18nContext(seller);
    // If the buyer is the creator, at this moment the seller already paid the hold invoice
    if (order.creator_id === order.buyer_id) {
      order.status = 'ACTIVE';
      // Message to buyer
      await messages.addInvoiceMessage(ctx, bot, buyer, seller, order);
      // Message to seller
      await messages.sendBuyerInfo2SellerMessage(
        bot,
        buyer,
        seller,
        order,
        i18nCtx
      );
    } else {
      // We create a hold invoice
      const description = i18nCtx.t('hold_invoice_memo', {
        botName: ctx.botInfo.username,
        orderId: order._id,
        fiatCode: order.fiat_code,
        fiatAmount: order.fiat_amount,
      });
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

      // We need the buyer rate
      const buyer = await User.findById(order.buyer_id);
      const stars = getEmojiRate(buyer.total_rating);
      const roundedRating = decimalRound(buyer.total_rating, -1);
      const rate = `${roundedRating} ${stars} (${buyer.total_reviews})`;
      // We send the hold invoice to the seller
      await messages.invoicePaymentRequestMessage(
        ctx,
        seller,
        request,
        order,
        i18nCtx,
        rate
      );
      await messages.takeSellWaitingSellerToPayMessage(ctx, bot, buyer, order);
    }
    await order.save();
  } catch (error) {
    logger.error(`Error in waitPayment: ${error}`);
  }
};

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
    if (order.status !== 'WAITING_BUYER_INVOICE') {
      return;
    }

    const buyer = await User.findOne({ _id: order.buyer_id });

    if (order.fiat_amount === undefined) {
      ctx.scene.enter('ADD_FIAT_AMOUNT_WIZARD_SCENE_ID', {
        bot,
        order,
        caller: buyer,
      });
      return;
    }

    let amount = order.amount;
    if (amount === 0) {
      amount = await getBtcFiatPrice(order.fiat_code, order.fiat_amount);
      const marginPercent = order.price_margin / 100;
      amount = amount - amount * marginPercent;
      amount = Math.floor(amount);
      order.fee = await getFee(amount, order.community_id);
      order.amount = amount;
    }

    // If the price API fails we can't continue with the process
    if (order.amount === 0) {
      await messages.priceApiFailedMessage(ctx, bot, buyer);
      return;
    }
    await order.save();
    const seller = await User.findOne({ _id: order.seller_id });

    if (buyer.lightning_address) {
      const laRes = await resolvLightningAddress(
        buyer.lightning_address,
        order.amount * 1000
      );
      if (!!laRes && !laRes.pr) {
        logger.warn(
          `lightning address ${buyer.lightning_address} not available`
        );
        messages.unavailableLightningAddress(
          ctx,
          bot,
          buyer,
          buyer.lightning_address
        );
        ctx.scene.enter('ADD_INVOICE_WIZARD_SCENE_ID', {
          order,
          seller,
          buyer,
          bot,
        });
      } else {
        await waitPayment(ctx, bot, buyer, seller, order, laRes.pr);
      }
    } else {
      ctx.scene.enter('ADD_INVOICE_WIZARD_SCENE_ID', {
        order,
        seller,
        buyer,
        bot,
      });
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
    if (!(order.status === 'SUCCESS' || order.status === 'PAID_HOLD_INVOICE')) {
      await messages.invalidDataMessage(ctx, bot, targetUser);
      return;
    }

    await saveUserReview(targetUser, rating);
  } catch (error) {
    logger.error(error);
  }
};

const saveUserReview = async (targetUser, rating) => {
  try {
    let totalReviews = targetUser.total_reviews
      ? targetUser.total_reviews
      : targetUser.reviews.length;
    totalReviews++;

    const oldRating = targetUser.total_rating;
    let lastRating = targetUser.reviews.length
      ? targetUser.reviews[targetUser.reviews.length - 1].rating
      : 0;

    lastRating = targetUser.last_rating ? targetUser.last_rating : lastRating;

    // newRating is an average of all the ratings given to the user.
    // Its formula is based on the iterative method to compute mean,
    // as in:
    // https://math.stackexchange.com/questions/2148877/iterative-calculation-of-mean-and-standard-deviation
    const newRating = oldRating + (lastRating - oldRating) / totalReviews;
    targetUser.total_rating = newRating;
    targetUser.last_rating = rating;
    targetUser.total_reviews = totalReviews;

    await targetUser.save();
  } catch (error) {
    logger.error(error);
  }
};

const cancelAddInvoice = async (ctx, order, job) => {
  try {
    if (!job) {
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

    // We make sure the seller can't send us sats now
    await cancelHoldInvoice({ hash: order.hash });

    const user = await User.findOne({ _id: order.buyer_id });

    if (!user) return;

    const i18nCtx = await getUserI18nContext(user);
    // Buyers only can cancel orders with status WAITING_BUYER_INVOICE
    if (order.status !== 'WAITING_BUYER_INVOICE')
      return await messages.genericErrorMessage(ctx, user, i18nCtx);

    const sellerUser = await User.findOne({ _id: order.seller_id });
    if (order.creator_id === order.buyer_id) {
      order.status = 'CLOSED';
      await order.save();
      await messages.toBuyerDidntAddInvoiceMessage(ctx, user, order, i18nCtx);
      const i18nCtxSeller = await getUserI18nContext(sellerUser);
      await messages.toSellerBuyerDidntAddInvoiceMessage(
        ctx,
        sellerUser,
        order,
        i18nCtxSeller
      );
    } else {
      // Re-publish order
      if (userAction) {
        logger.info(
          `Buyer Id: ${user.id} cancelled Order Id: ${order._id}, republishing to the channel`
        );
      } else {
        logger.info(
          `Order Id: ${order._id} expired, republishing to the channel`
        );
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

      if (order.type === 'buy') {
        order.seller_id = null;
        await messages.publishBuyOrderMessage(ctx, user, order, i18nCtx);
      } else {
        order.buyer_id = null;
        await messages.publishSellOrderMessage(ctx, sellerUser, order, i18nCtx);
      }
      await order.save();
      if (!userAction) {
        if (job) {
          await messages.toAdminChannelBuyerDidntAddInvoiceMessage(
            ctx,
            user,
            order,
            i18nCtx
          );
          await messages.toBuyerDidntAddInvoiceMessage(
            ctx,
            user,
            order,
            i18nCtx
          );
        } else {
          await messages.successCancelOrderMessage(
            ctx,
            sellerUser,
            order,
            i18nCtx
          );
          await messages.counterPartyCancelOrderMessage(
            ctx,
            user,
            order,
            i18nCtx
          );
        }
      } else {
        await messages.successCancelOrderMessage(ctx, user, order, i18nCtx);
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
    if (order.status !== 'WAITING_PAYMENT') {
      await messages.invalidDataMessage(ctx, bot, user);
      return;
    }

    if (order.fiat_amount === undefined) {
      ctx.scene.enter('ADD_FIAT_AMOUNT_WIZARD_SCENE_ID', {
        bot,
        order,
        caller: user,
      });
      return;
    }

    // We create the hold invoice and show it to the seller
    const description = ctx.i18n.t('hold_invoice_memo', {
      botName: ctx.botInfo.username,
      orderId: order._id,
      fiatCode: order.fiat_code,
      fiatAmount: order.fiat_amount,
    });
    let amount;
    if (order.amount === 0) {
      amount = await getBtcFiatPrice(order.fiat_code, order.fiat_amount);
      const marginPercent = order.price_margin / 100;
      amount = amount - amount * marginPercent;
      amount = Math.floor(amount);
      order.fee = await getFee(amount, order.community_id);
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
    await messages.showHoldInvoiceMessage(
      ctx,
      request,
      amount,
      order.fiat_code,
      order.fiat_amount
    );
  } catch (error) {
    logger.error(`Error in showHoldInvoice: ${error}`);
  }
};

const cancelShowHoldInvoice = async (ctx, order, job) => {
  try {
    if (!job) ctx.deleteMessage();
    let userAction = false;
    if (!order) {
      userAction = true;
      const orderId = !!ctx && ctx.update.callback_query.message.text;
      if (!orderId) return;
      order = await Order.findOne({ _id: orderId });
      if (!order) return;
    }
    // We make sure the seller can't send us sats now
    await cancelHoldInvoice({ hash: order.hash });

    const user = await User.findOne({ _id: order.seller_id });
    if (!user) return;
    const i18nCtx = await getUserI18nContext(user);
    // Sellers only can cancel orders with status WAITING_PAYMENT
    if (order.status !== 'WAITING_PAYMENT')
      return await messages.genericErrorMessage(ctx, user, i18nCtx);

    const buyerUser = await User.findOne({ _id: order.buyer_id });
    if (order.creator_id === order.seller_id) {
      order.status = 'CLOSED';
      await order.save();
      await messages.toSellerDidntPayInvoiceMessage(ctx, user, order, i18nCtx);
      await messages.toBuyerSellerDidntPayInvoiceMessage(
        ctx,
        buyerUser,
        order,
        i18nCtx
      );
    } else {
      // Re-publish order
      if (userAction) {
        logger.info(
          `Seller Id ${user.id} cancelled Order Id: ${order._id}, republishing to the channel`
        );
      } else {
        logger.info(
          `Order Id: ${order._id} expired, republishing to the channel`
        );
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

      if (order.type === 'buy') {
        order.seller_id = null;
        await messages.publishBuyOrderMessage(ctx, buyerUser, order, i18nCtx);
      } else {
        order.buyer_id = null;
        await messages.publishSellOrderMessage(ctx, user, order, i18nCtx);
      }
      await order.save();
      if (!userAction) {
        if (job) {
          await messages.toSellerDidntPayInvoiceMessage(
            ctx,
            user,
            order,
            i18nCtx
          );
          await messages.toAdminChannelSellerDidntPayInvoiceMessage(
            ctx,
            user,
            order,
            i18nCtx
          );
        } else {
          await messages.successCancelOrderMessage(
            ctx,
            buyerUser,
            order,
            i18nCtx
          );
          await messages.counterPartyCancelOrderMessage(
            ctx,
            user,
            order,
            i18nCtx
          );
        }
      } else {
        await messages.successCancelOrderMessage(ctx, user, order, i18nCtx);
      }
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
    if (order.status !== 'PAID_HOLD_INVOICE') {
      return;
    }

    const buyer = await User.findOne({ _id: order.buyer_id });
    if (!buyer) return;
    if (order.amount === 0) {
      await messages.genericErrorMessage(bot, buyer, ctx.i18n);
      return;
    }

    ctx.scene.enter('ADD_INVOICE_PHI_WIZARD_SCENE_ID', { order, buyer, bot });
  } catch (error) {
    logger.error(error);
  }
};

const cancelOrder = async (ctx, orderId, user) => {
  try {
    if (!user) {
      const tgUser = ctx.update.callback_query.from;
      if (!tgUser) return;

      user = await User.findOne({ tg_id: tgUser.id });

      // If user didn't initialize the bot we can't do anything
      if (!user) return;
    }
    if (user.banned) return await messages.bannedUserErrorMessage(ctx, user);
    const order = await ordersActions.getOrder(ctx, user, orderId);

    if (!order) return;

    if (order.status === 'PENDING') {
      // If we already have a holdInvoice we cancel it and return the money
      if (order.hash) await cancelHoldInvoice({ hash: order.hash });

      order.status = 'CANCELED';
      order.canceled_by = user._id;
      await order.save();
      // we sent a private message to the user
      await messages.successCancelOrderMessage(ctx, user, order, ctx.i18n);
      // We delete the messages related to that order from the channel
      return await deleteOrderFromChannel(order, ctx.telegram);
    }

    // If a buyer is taking a sell offer and accidentally touch continue button we
    // let the user to cancel
    if (order.type === 'sell' && order.status === 'WAITING_BUYER_INVOICE') {
      return await cancelAddInvoice(ctx, order);
    }

    // If a seller is taking a buy offer and accidentally touch continue button we
    // let the user to cancel
    if (order.type === 'buy' && order.status === 'WAITING_PAYMENT') {
      return await cancelShowHoldInvoice(ctx, order);
    }

    if (
      !(
        order.status === 'ACTIVE' ||
        order.status === 'FIAT_SENT' ||
        order.status === 'DISPUTE'
      )
    )
      return await messages.badStatusOnCancelOrderMessage(ctx);

    // If the order is active we start a cooperative cancellation
    let counterPartyUser, initiator, counterParty;

    const initiatorUser = user;
    if (initiatorUser._id == order.buyer_id) {
      counterPartyUser = await User.findOne({ _id: order.seller_id });
      initiator = 'buyer';
      counterParty = 'seller';
    } else {
      counterPartyUser = await User.findOne({ _id: order.buyer_id });
      initiator = 'seller';
      counterParty = 'buyer';
    }

    if (order[`${initiator}_cooperativecancel`])
      return await messages.shouldWaitCooperativeCancelMessage(
        ctx,
        initiatorUser
      );

    order[`${initiator}_cooperativecancel`] = true;

    const i18nCtxCP = await getUserI18nContext(counterPartyUser);
    // If the counter party already requested a cooperative cancel order
    if (order[`${counterParty}_cooperativecancel`]) {
      // If we already have a holdInvoice we cancel it and return the money
      if (order.hash) await cancelHoldInvoice({ hash: order.hash });

      order.status = 'CANCELED';
      let seller = initiatorUser;
      let i18nCtxSeller = ctx.i18n;
      if (order.seller_id == counterPartyUser._id) {
        seller = counterPartyUser;
        i18nCtxSeller = i18nCtxCP;
      }
      // We sent a private message to the users
      await messages.successCancelOrderMessage(
        ctx,
        initiatorUser,
        order,
        ctx.i18n
      );
      await messages.okCooperativeCancelMessage(
        ctx,
        counterPartyUser,
        order,
        i18nCtxCP
      );
      await messages.refundCooperativeCancelMessage(ctx, seller, i18nCtxSeller);
      logger.info(`Order ${order._id} was cancelled cooperatively!`);
    } else {
      await messages.initCooperativeCancelMessage(ctx, order);
      await messages.counterPartyWantsCooperativeCancelMessage(
        ctx,
        counterPartyUser,
        order,
        i18nCtxCP
      );
    }
    await order.save();
  } catch (error) {
    logger.error(error);
  }
};

const fiatSent = async (ctx, orderId, user) => {
  try {
    if (!user) {
      const tgUser = ctx.update.callback_query.from;
      if (!tgUser) return;

      user = await User.findOne({ tg_id: tgUser.id });

      // If user didn't initialize the bot we can't do anything
      if (!user) return;
    }
    if (user.banned) return await messages.bannedUserErrorMessage(ctx, user);
    const order = await validateFiatSentOrder(ctx, user, orderId);
    if (!order) return;

    order.status = 'FIAT_SENT';
    const seller = await User.findOne({ _id: order.seller_id });
    await order.save();
    // We sent messages to both parties
    // We need to create i18n context for each user
    const i18nCtxBuyer = await getUserI18nContext(user);
    const i18nCtxSeller = await getUserI18nContext(seller);
    await messages.fiatSentMessages(
      ctx,
      user,
      seller,
      i18nCtxBuyer,
      i18nCtxSeller
    );
  } catch (error) {
    logger.error(error);
  }
};

const release = async (ctx, orderId, user) => {
  try {
    if (!user) {
      const tgUser = ctx.update.callback_query.from;
      if (!tgUser) return;

      user = await User.findOne({ tg_id: tgUser.id });

      // If user didn't initialize the bot we can't do anything
      if (!user) return;
    }
    if (user.banned) return await messages.bannedUserErrorMessage(ctx, user);
    const order = await validateReleaseOrder(ctx, user, orderId);
    if (!order) return;
    // We look for a dispute for this order
    const dispute = await Dispute.findOne({ order_id: order._id });

    if (dispute) {
      dispute.status = 'RELEASED';
      await dispute.save();
    }

    await settleHoldInvoice({ secret: order.secret });
  } catch (error) {
    logger.error(error);
  }
};

module.exports = {
  rateUser,
  saveUserReview,
  cancelAddInvoice,
  waitPayment,
  addInvoice,
  cancelShowHoldInvoice,
  showHoldInvoice,
  addInvoicePHI,
  cancelOrder,
  fiatSent,
  release,
};
