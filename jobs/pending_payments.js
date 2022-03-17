const { I18n } = require('@grammyjs/i18n');
const { payRequest, isPendingPayment } = require('../ln');
const { PendingPayment, Order, User } = require('../models');
const messages = require('../bot/messages');

const attemptPendingPayments = async (bot) => {
    const pendingPayments = await PendingPayment.find({
        paid: false,
        attempts: { $lt: 3 },
        is_invoice_expired: false,
    });
    // We need to create a i18n object to create a context
    const i18n = new I18n({
        defaultLanguageOnMissing: true,
        directory: 'locales',
    });
    for (const pending of pendingPayments) {
        const order = await Order.findOne({ _id: pending.order_id });
        try {
            pending.attempts++;
            if (order.status == 'SUCCESS') {
                pending.paid = true;
                await pending.save();
                console.log(`Order id: ${order._id} was already paid`);
                return;
            }
            // We check if the payment is on flight we don't do anything
            const isPending = await isPendingPayment(order.buyer_invoice);
            if (!!isPending) {
                return;
            }
            const payment = await payRequest({
                amount: pending.amount,
                request: pending.payment_request,
            });
            const buyerUser = await User.findOne({ _id: order.buyer_id });
            // If the buyer's invoice is expired we let it know and don't try to pay again
            if (!!payment && payment.is_expired) {
                pending.is_invoice_expired = true;
                await messages.expiredInvoiceOnPendingMessage(bot, buyerUser, order);
                return;
            }

            if (!!payment && !!payment.confirmed_at) {
                order.status = 'SUCCESS';
                order.routing_fee = payment.fee;
                pending.paid = true;
                // We add a new completed trade for the buyer
                buyerUser.trades_completed++;
                await buyerUser.save();
                // We add a new completed trade for the seller
                const sellerUser = await User.findOne({ _id: order.seller_id });
                sellerUser.trades_completed++;
                sellerUser.save();
                console.log(`Invoice with hash: ${pending.hash} paid`);
                await messages.toAdminChannelPendingPaymentSuccessMessage(bot, buyerUser, order, pending, payment);
                await messages.toBuyerPendingPaymentSuccessMessage(bot, buyerUser, order, payment);
                await messages.rateUserMessage(bot, buyerUser, order, i18nCtx);
            } else {
                if (pending.attempts == 3) {
                    order.paid_hold_buyer_invoice_updated = false;
                    await messages.toBuyerPendingPaymentFailedMessage(bot, buyerUser, order);
                }
                await messages.toAdminChannelPendingPaymentFailedMessage(bot, user, order);
            }
        } catch (error) {
            console.log('attemptPendingPayments catch error:', error);
        } finally {
            await order.save();
            await pending.save();
        }
    }
};

module.exports = attemptPendingPayments;
