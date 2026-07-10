import {
  payViaPaymentRequest,
  getPayment,
  deleteForwardingReputations,
  AuthenticatedLnd,
} from 'lightning';
import type { PayViaPaymentRequestResult } from 'lightning/lnd_methods/offchain/pay_via_payment_request';
import { User, PendingPayment } from '../models';
import lnd from './connect';
import { handleReputationItems, getUserI18nContext } from '../util';
import * as messages from '../bot/messages';
import { logger, logTimeout, logOperationDuration } from '../logger';
import * as OrderEvents from '../bot/modules/events/orders';
import { IOrder } from '../models/order';
import { HasTelegram } from '../bot/start';
import util from 'node:util';

const { parsePaymentRequest } = require('invoices');

interface PayViaPaymentRequestParams {
  lnd: AuthenticatedLnd;
  request: string;
  pathfinding_timeout: number;
  tokens?: number;
  max_fee?: number;
}

const payRequest = async ({
  request,
  amount,
}: {
  request: string;
  amount: number;
}) => {
  const startTime = Date.now();
  const operationName = 'payRequest';
  // Use configurable pathfinding timeout, default to 60 seconds
  const pathfindingTimeout = parseInt(
    process.env.LN_PATHFINDING_TIMEOUT || '60000',
  );

  try {
    const invoice = parsePaymentRequest({ request });
    if (!invoice) return false;
    // If the invoice is expired we return is_expired = true
    if (invoice.is_expired) return invoice;

    // SECURITY: never pay an amount different from the order amount.
    // If the invoice encodes an amount, it MUST match the expected amount
    // exactly. This prevents an attacker from supplying an inflated invoice
    // (e.g. via a malicious LNURL/Lightning Address endpoint) and draining
    // the node by being paid more than was held from the seller.
    if (invoice.tokens && invoice.tokens !== amount) {
      logger.error(
        `payRequest: invoice amount (${invoice.tokens}) does not match the expected amount (${amount}); refusing to pay`,
      );
      return {
        error: 'AMOUNT_MISMATCH',
        message: 'invoice amount does not match order amount',
      };
    }

    const maxRoutingFee = process.env.MAX_ROUTING_FEE;
    if (maxRoutingFee === undefined)
      throw new Error('Environment variable MAX_ROUTING_FEE is not defined');
    // We need to set a max fee amount
    const maxFee = amount * parseFloat(maxRoutingFee);
    const params: PayViaPaymentRequestParams = {
      lnd,
      request,
      pathfinding_timeout: pathfindingTimeout,
    };
    // If the invoice doesn't have amount we add it to the params
    if (!invoice.tokens) params.tokens = amount;
    // We set the max fee
    params.max_fee = maxFee;
    // If the amount is small we use a different max routing fee
    if (amount <= 100) params.max_fee = amount * 0.1;

    // Delete all routing reputations to clear pathfinding memory
    await deleteForwardingReputations({ lnd });

    logger.info(
      `Starting payment for ${amount} sats with ${pathfindingTimeout}ms timeout`,
    );
    const payment = await payViaPaymentRequest(params);

    logOperationDuration(operationName, startTime, true);
    return payment;
  } catch (error: any) {
    const errorMessage = error.toString();

    logOperationDuration(operationName, startTime, false);

    // Enhanced error handling for different timeout scenarios
    if (
      errorMessage.includes('TimeoutError') ||
      errorMessage.includes('timed out')
    ) {
      logTimeout('payRequest', pathfindingTimeout, error);
      logger.error(
        `payRequest timeout after ${pathfindingTimeout}ms: ${errorMessage}`,
      );
      return { error: 'TIMEOUT', message: errorMessage };
    }

    if (
      errorMessage.includes('UnknownPaymentHash') ||
      errorMessage.includes('PaymentPathfindingFailedToFindPossibleRoute')
    ) {
      logger.error(`payRequest routing failed: ${errorMessage}`);
      return { error: 'ROUTING_FAILED', message: errorMessage };
    }

    if (errorMessage.includes('InsufficientBalance')) {
      logger.error(`payRequest insufficient balance: ${errorMessage}`);
      return { error: 'INSUFFICIENT_BALANCE', message: errorMessage };
    }

    logger.error(`payRequest unexpected error: ${errorMessage}`);
    return { error: 'UNKNOWN', message: errorMessage };
  }
};

const payToBuyer = async (bot: HasTelegram, order: IOrder) => {
  try {
    // Skip if the payment is already in-flight or was confirmed
    const isPaymentPendingOrConfirmed = await isPendingOrConfirmed(
      order.buyer_invoice,
    );
    if (isPaymentPendingOrConfirmed) {
      order.status = 'ERROR';
      await order.save();
      await messages.toAdminChannelOrderErrorMessage(
        bot,
        order,
        'Payment is already in-flight or was confirmed',
      );
      return;
    }
    const payment = await payRequest({
      request: order.buyer_invoice,
      amount: order.amount,
    });
    const buyerUser = await User.findOne({ _id: order.buyer_id });
    if (buyerUser === null) throw new Error('buyerUser was not found');
    // If the buyer's invoice is expired we let it know and don't try to pay again
    const i18nCtx = await getUserI18nContext(buyerUser);
    if (!!payment && payment.is_expired) {
      await messages.expiredInvoiceOnPendingMessage(
        bot,
        buyerUser,
        order,
        i18nCtx,
      );
      return;
    }
    const sellerUser = await User.findOne({ _id: order.seller_id });
    if (sellerUser === null) throw new Error('sellerUser was not found');
    if (!!payment && !!payment.confirmed_at) {
      logger.info(`Order ${order._id} - Invoice with hash: ${payment.id} paid`);
      order.status = 'SUCCESS';
      order.routing_fee = payment.fee;
      order.payout_hash = payment.id;
      order.payout_preimage = payment.secret;

      await order.save();
      OrderEvents.orderUpdated(order);
      await handleReputationItems(buyerUser, sellerUser, order.amount);
      await messages.buyerReceivedSatsMessage(
        bot,
        buyerUser,
        sellerUser,
        i18nCtx,
      );
      await messages.rateUserMessage(bot, buyerUser, order, i18nCtx);
    } else {
      // SECURITY: a structural amount mismatch must never be retried — the
      // invoice itself is wrong. Alert and stop instead of scheduling a retry,
      // otherwise the pending payments job would keep attempting to pay it.
      if (
        payment &&
        typeof payment === 'object' &&
        'error' in payment &&
        payment.error === 'AMOUNT_MISMATCH'
      ) {
        logger.error(
          `payToBuyer: AMOUNT_MISMATCH for order ${order._id}; refusing to pay and not scheduling a retry`,
        );
        await messages.invoicePaymentFailedMessage(bot, buyerUser, i18nCtx);
        return;
      }
      // Handle different types of payment failures
      if (payment && typeof payment === 'object' && 'error' in payment) {
        const errorType = payment.error as string;

        if (errorType === 'TIMEOUT') {
          logger.warning(
            `Payment timeout for order ${order._id}, will retry later`,
          );
          await messages.invoicePaymentFailedMessage(bot, buyerUser, i18nCtx);
        } else if (errorType === 'ROUTING_FAILED') {
          logger.warning(
            `Routing failed for order ${order._id}, will retry with cleared reputation`,
          );
          await messages.invoicePaymentFailedMessage(bot, buyerUser, i18nCtx);
        } else {
          logger.error(
            `Payment failed for order ${order._id} with error: ${errorType}`,
          );
          await messages.invoicePaymentFailedMessage(bot, buyerUser, i18nCtx);
        }
      } else {
        await messages.invoicePaymentFailedMessage(bot, buyerUser, i18nCtx);
      }

      // Create pending payment for retry
      const pp = new PendingPayment({
        amount: order.amount,
        payment_request: order.buyer_invoice,
        user_id: buyerUser._id,
        description: order.description,
        hash: order.hash,
        order_id: order._id,
        attempts: 1,
        last_error:
          payment && typeof payment === 'object' && 'error' in payment
            ? (payment.error as string)
            : 'UNKNOWN',
      });
      await pp.save();
    }
  } catch (error) {
    logger.error(`payToBuyer catch: ${error}`);
  }
};

type LndPayment = PayViaPaymentRequestResult;

interface PaymentStatus {
  is_confirmed: boolean;
  is_pending: boolean;
  payment?: LndPayment;
  // True when is_pending was forced by an unknown/transient LND error (fail
  // closed) rather than a genuine in-flight payment. Lets callers tell a real
  // in-flight payment apart from a node fault that would wedge retries.
  is_error?: boolean;
}

const getPaymentStatus = async (request: string): Promise<PaymentStatus> => {
  try {
    if (!request) {
      return { is_confirmed: false, is_pending: false };
    }
    const { id } = parsePaymentRequest({ request });
    const res = await getPayment({ lnd, id });
    return {
      is_confirmed: !!res.is_confirmed,
      is_pending: !!res.is_pending,
      payment: res.payment as LndPayment | undefined,
    };
  } catch (error: any) {
    // lightning lib returns errors as arrays: [code, message, details]
    const code = Array.isArray(error) ? error[0] : undefined;
    const message = Array.isArray(error)
      ? String(error[1] ?? '')
      : String(error);
    const isNotFound =
      code === 404 ||
      message.includes('SentPaymentNotFound') ||
      message.includes('PaymentNotFound');
    if (isNotFound) {
      return { is_confirmed: false, is_pending: false };
    }
    // Use util.inspect to log the error more specifically
    logger.error(`getPaymentStatus error: ` + util.inspect(error));
    // We prefer to handle this case manually preventing potential fund loss.
    // Fail closed: mark is_error so callers can tell an unknown/transient LND
    // fault apart from a genuine in-flight payment.
    return { is_confirmed: false, is_pending: true, is_error: true };
  }
};

const isPendingOrConfirmed = async (request: string) => {
  const { is_confirmed, is_pending } = await getPaymentStatus(request);
  return is_confirmed || is_pending;
};

export {
  payRequest,
  payToBuyer,
  isPendingOrConfirmed,
  getPaymentStatus,
  LndPayment,
  PaymentStatus,
};
