import { PendingPayment, Order, User, Community } from '../models';
import * as messages from '../bot/messages';
import { logger } from '../logger';
import { Telegraf } from 'telegraf';
import { I18nContext } from '@grammyjs/i18n';
import { payRequest, isPendingPayment } from '../ln';
import { getUserI18nContext } from '../util';
import { CommunityContext } from '../bot/modules/community/communityContext';
import { orderUpdated } from '../bot/modules/events/orders';

const maxPaymentAttempts = process.env.PAYMENT_ATTEMPTS
  ? parseInt(process.env.PAYMENT_ATTEMPTS, 10)
  : 3;

export const attemptPendingPayments = async (
  bot: Telegraf<CommunityContext>,
): Promise<void> => {
  const pendingPayments = await PendingPayment.find({
    paid: false,
    attempts: { $lt: maxPaymentAttempts },
    is_invoice_expired: false,
    community_id: null,
    next_retry: { $lte: new Date() },
  });
  for (const pending of pendingPayments) {
    const order = await Order.findOne({ _id: pending.order_id });
    try {
      if (order === null) throw Error('Order was not found in DB');
      pending.attempts++;

      // Calculate exponential backoff delay
      const baseDelay = 5 * 60 * 1000; // 5 minutes
      const exponentialDelay = baseDelay * Math.pow(2, pending.attempts - 1);
      const maxDelay = 60 * 60 * 1000; // 1 hour max
      const nextRetryDelay = Math.min(exponentialDelay, maxDelay);
      pending.next_retry = new Date(Date.now() + nextRetryDelay);

      if (order.status === 'SUCCESS') {
        pending.paid = true;
        await pending.save();
        logger.info(`Order id: ${order._id} was already paid`);
        continue;
      }
      // We check if the old payment is on flight
      const isPendingOldPayment: boolean = await isPendingPayment(
        order.buyer_invoice,
      );

      // We check if this new payment is on flight
      const isPending: boolean = await isPendingPayment(
        pending.payment_request,
      );

      // If one of the payments is on flight we don't do anything
      if (isPending || isPendingOldPayment) continue;

      // SECURITY (defense in depth): the amount to pay must equal the order
      // amount. payRequest also enforces this, but we stop retries early here
      // so a structurally-wrong pending payment is never re-attempted.
      if (pending.amount !== order.amount) {
        pending.last_error = 'AMOUNT_MISMATCH';
        pending.is_invoice_expired = true; // prevents further retries
        logger.error(
          `attemptPendingPayments: amount mismatch for order ${order._id} ` +
            `(pending ${pending.amount} != order ${order.amount}); stopping retries`,
        );
        continue;
      }

      const payment = await payRequest({
        amount: pending.amount,
        request: pending.payment_request,
      });
      const buyerUser = await User.findOne({ _id: order.buyer_id });
      if (buyerUser === null) throw Error('buyerUser was not found in DB');
      const i18nCtx: I18nContext = await getUserI18nContext(buyerUser);
      // If the buyer's invoice is expired we let it know and don't try to pay again
      if (!!payment && payment.is_expired) {
        pending.is_invoice_expired = true;
        order.paid_hold_buyer_invoice_updated = false;
        await messages.expiredInvoiceOnPendingMessage(
          bot,
          buyerUser,
          order,
          i18nCtx,
        );
        continue;
      }

      if (!!payment && !!payment.confirmed_at) {
        order.status = 'SUCCESS';
        order.routing_fee = payment.fee;
        pending.paid = true;
        pending.paid_at = new Date();
        // We add a new completed trade for the buyer
        buyerUser.trades_completed++;
        await buyerUser.save();
        // We add a new completed trade for the seller
        const sellerUser = await User.findOne({ _id: order.seller_id });
        if (sellerUser === null) throw Error('sellerUser was not found in DB');
        sellerUser.trades_completed++;
        sellerUser.save();
        logger.info(`Invoice with hash: ${pending.hash} paid`);
        await messages.toAdminChannelPendingPaymentSuccessMessage(
          bot,
          buyerUser,
          order,
          pending,
          payment,
          i18nCtx,
        );
        await messages.toBuyerPendingPaymentSuccessMessage(
          bot,
          buyerUser,
          order,
          payment,
          i18nCtx,
        );
        await messages.rateUserMessage(bot, buyerUser, order, i18nCtx);
      } else {
        // Enhanced error handling for different payment failure types
        if (payment && typeof payment === 'object' && 'error' in payment) {
          pending.last_error = payment.error as string;

          if (payment.error === 'TIMEOUT') {
            logger.warning(
              `Payment timeout for order ${order._id}, attempt ${pending.attempts}`,
            );
          } else if (payment.error === 'ROUTING_FAILED') {
            logger.warning(
              `Routing failed for order ${order._id}, attempt ${pending.attempts}`,
            );
          } else if (payment.error === 'AMOUNT_MISMATCH') {
            // Structural error: never retry an invoice with the wrong amount.
            pending.is_invoice_expired = true;
            logger.error(
              `AMOUNT_MISMATCH for order ${order._id}; stopping retries`,
            );
          } else {
            logger.error(
              `Payment failed for order ${order._id}, attempt ${pending.attempts}, error: ${payment.error}`,
            );
          }
        } else {
          pending.last_error = 'PAYMENT_FAILED';
          logger.error(
            `Payment failed for order ${order._id}, attempt ${pending.attempts}`,
          );
        }

        if (
          process.env.PAYMENT_ATTEMPTS !== undefined &&
          pending.attempts >= parseInt(process.env.PAYMENT_ATTEMPTS)
        ) {
          order.paid_hold_buyer_invoice_updated = false;
          await messages.toBuyerPendingPaymentFailedMessage(
            bot,
            buyerUser,
            order,
            i18nCtx,
          );
        }
        await messages.toAdminChannelPendingPaymentFailedMessage(
          bot,
          buyerUser,
          order,
          pending,
          i18nCtx,
        );
      }
    } catch (error: any) {
      const message: string = error.toString();
      logger.error(`attemptPendingPayments catch error: ${message}`);
    } finally {
      if (order !== null) {
        await order.save();
        orderUpdated(order);
      }
      await pending.save();
    }
  }
};

export const attemptCommunitiesPendingPayments = async (
  bot: Telegraf<CommunityContext>,
): Promise<void> => {
  const pendingPayments = await PendingPayment.find({
    paid: false,
    attempts: { $lt: maxPaymentAttempts },
    is_invoice_expired: false,
    community_id: { $ne: null },
    next_retry: { $lte: new Date() },
  });

  for (const pending of pendingPayments) {
    try {
      pending.attempts++;

      // Calculate exponential backoff delay for community payments
      const baseDelay = 5 * 60 * 1000; // 5 minutes
      const exponentialDelay = baseDelay * Math.pow(2, pending.attempts - 1);
      const maxDelay = 60 * 60 * 1000; // 1 hour max
      const nextRetryDelay = Math.min(exponentialDelay, maxDelay);
      pending.next_retry = new Date(Date.now() + nextRetryDelay);

      // We check if this new payment is on flight
      const isPending: boolean = await isPendingPayment(
        pending.payment_request,
      );

      // If the payments is on flight we don't do anything
      if (isPending) return;

      const payment = await payRequest({
        amount: pending.amount,
        request: pending.payment_request,
      });
      const user = await User.findById(pending.user_id);
      if (user === null) throw Error('User was not found in DB');
      const i18nCtx: I18nContext = await getUserI18nContext(user);
      // If the buyer's invoice is expired we let it know and don't try to pay again
      if (!!payment && payment.is_expired) {
        pending.is_invoice_expired = true;
        // Don't let a notification failure abort the run before the earnings
        // are restored further down; restoring the balance is the critical
        // step and the pending payment is excluded from future runs once it is
        // flagged as expired.
        try {
          await bot.telegram.sendMessage(
            user.tg_id,
            i18nCtx.t('invoice_expired_earnings'),
            {
              reply_markup: {
                inline_keyboard: [
                  [
                    {
                      text: i18nCtx.t('withdraw_earnings'),
                      callback_data: `withdrawEarnings_${pending.community_id}`,
                    },
                  ],
                ],
              },
            },
          );
        } catch (error) {
          logger.error(
            `Failed to notify user ${user.tg_id} about expired invoice: ${error}`,
          );
        }
      }

      const community = await Community.findById(pending.community_id);
      if (community === null) throw Error('Community was not found in DB');
      if (!!payment && !!payment.confirmed_at) {
        pending.paid = true;
        pending.paid_at = new Date();

        // The earnings were already atomically zeroed when this withdrawal was
        // claimed at scheduling time, so don't reset them again here: doing so
        // would wipe out any earnings accrued between the claim and this
        // successful payment.
        community.orders_to_redeem = 0;
        await community.save();
        logger.info(
          `Community ${community.id} withdrew ${pending.amount} sats, invoice with hash: ${payment.id} was paid`,
        );
        await bot.telegram.sendMessage(
          user.tg_id,
          i18nCtx.t('pending_payment_success', {
            id: community.id,
            amount: pending.amount,
            paymentSecret: payment.secret,
          }),
        );
      } else {
        // Enhanced error handling for community payments
        if (payment && typeof payment === 'object' && 'error' in payment) {
          pending.last_error = payment.error as string;
          logger.error(
            `Community ${community.id}: Withdraw failed after ${pending.attempts} attempts, amount ${pending.amount} sats, error: ${payment.error}`,
          );
        } else {
          pending.last_error = 'PAYMENT_FAILED';
          logger.error(
            `Community ${community.id}: Withdraw failed after ${pending.attempts} attempts, amount ${pending.amount} sats`,
          );
        }

        const attemptsExhausted =
          process.env.PAYMENT_ATTEMPTS !== undefined &&
          pending.attempts >= parseInt(process.env.PAYMENT_ATTEMPTS);

        // SECURITY/accounting: the earnings were atomically claimed (zeroed)
        // when this withdrawal was scheduled. If the payout has now failed
        // permanently (invoice expired or no attempts left) we restore them so
        // the community can withdraw again without losing funds. Because the
        // pending payment is then excluded from future runs (is_invoice_expired
        // or attempts >= PAYMENT_ATTEMPTS), this restore happens exactly once.
        if (pending.is_invoice_expired || attemptsExhausted) {
          // Atomic increment against the current DB value so we don't clobber
          // earnings accrued since this community document was read above.
          await Community.findByIdAndUpdate(community._id, {
            $inc: { earnings: pending.amount },
          });
        }

        if (attemptsExhausted) {
          await bot.telegram.sendMessage(
            user.tg_id,
            i18nCtx.t('pending_payment_failed_earnings', {
              attempts: pending.attempts,
            }),
            {
              reply_markup: {
                inline_keyboard: [
                  [
                    {
                      text: i18nCtx.t('withdraw_earnings'),
                      callback_data: `withdrawEarnings_${pending.community_id}`,
                    },
                  ],
                ],
              },
            },
          );
        }
      }
    } catch (error) {
      logger.error(`attemptCommunitiesPendingPayments catch error: ${error}`);
    } finally {
      await pending.save();
    }
  }
};
