"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
var _a = require('../ln'), payRequest = _a.payRequest, isPendingPayment = _a.isPendingPayment;
var _b = require('../models'), PendingPayment = _b.PendingPayment, Order = _b.Order, User = _b.User, Community = _b.Community;
var messages = require('../bot/messages');
var getUserI18nContext = require('../util').getUserI18nContext;
var logger = require('../logger').logger;
var orderUpdated = require('../bot/modules/events/orders').orderUpdated;
exports.attemptPendingPayments = function (bot) { return __awaiter(void 0, void 0, void 0, function () {
    var pendingPayments, _i, pendingPayments_1, pending, order, isPendingOldPayment, isPending, payment, buyerUser, i18nCtx, sellerUser, error_1, message;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, PendingPayment.find({
                    paid: false,
                    attempts: { $lt: process.env.PAYMENT_ATTEMPTS },
                    is_invoice_expired: false,
                    community_id: null,
                })];
            case 1:
                pendingPayments = _a.sent();
                _i = 0, pendingPayments_1 = pendingPayments;
                _a.label = 2;
            case 2:
                if (!(_i < pendingPayments_1.length)) return [3 /*break*/, 29];
                pending = pendingPayments_1[_i];
                return [4 /*yield*/, Order.findOne({ _id: pending.order_id })];
            case 3:
                order = _a.sent();
                _a.label = 4;
            case 4:
                _a.trys.push([4, 24, 25, 28]);
                pending.attempts++;
                if (!(order.status === 'SUCCESS')) return [3 /*break*/, 6];
                pending.paid = true;
                return [4 /*yield*/, pending.save()];
            case 5:
                _a.sent();
                logger.info("Order id: ".concat(order._id, " was already paid"));
                return [2 /*return*/];
            case 6: return [4 /*yield*/, isPendingPayment(order.buyer_invoice)];
            case 7:
                isPendingOldPayment = _a.sent();
                return [4 /*yield*/, isPendingPayment(pending.payment_request)];
            case 8:
                isPending = _a.sent();
                // If one of the payments is on flight we don't do anything
                if (isPending || isPendingOldPayment)
                    return [2 /*return*/];
                return [4 /*yield*/, payRequest({
                        amount: pending.amount,
                        request: pending.payment_request,
                    })];
            case 9:
                payment = _a.sent();
                return [4 /*yield*/, User.findOne({ _id: order.buyer_id })];
            case 10:
                buyerUser = _a.sent();
                return [4 /*yield*/, getUserI18nContext(buyerUser)];
            case 11:
                i18nCtx = _a.sent();
                if (!(!!payment && payment.is_expired)) return [3 /*break*/, 13];
                pending.is_invoice_expired = true;
                order.paid_hold_buyer_invoice_updated = false;
                return [4 /*yield*/, messages.expiredInvoiceOnPendingMessage(bot, buyerUser, order, i18nCtx)];
            case 12: return [2 /*return*/, _a.sent()];
            case 13:
                if (!(!!payment && !!payment.confirmed_at)) return [3 /*break*/, 19];
                order.status = 'SUCCESS';
                order.routing_fee = payment.fee;
                pending.paid = true;
                pending.paid_at = new Date().toISOString();
                // We add a new completed trade for the buyer
                buyerUser.trades_completed++;
                return [4 /*yield*/, buyerUser.save()];
            case 14:
                _a.sent();
                return [4 /*yield*/, User.findOne({ _id: order.seller_id })];
            case 15:
                sellerUser = _a.sent();
                sellerUser.trades_completed++;
                sellerUser.save();
                logger.info("Invoice with hash: ".concat(pending.hash, " paid"));
                return [4 /*yield*/, messages.toAdminChannelPendingPaymentSuccessMessage(bot, buyerUser, order, pending, payment, i18nCtx)];
            case 16:
                _a.sent();
                return [4 /*yield*/, messages.toBuyerPendingPaymentSuccessMessage(bot, buyerUser, order, payment, i18nCtx)];
            case 17:
                _a.sent();
                return [4 /*yield*/, messages.rateUserMessage(bot, buyerUser, order, i18nCtx)];
            case 18:
                _a.sent();
                return [3 /*break*/, 23];
            case 19:
                if (!(process.env.PAYMENT_ATTEMPTS !== undefined &&
                    pending.attempts === parseInt(process.env.PAYMENT_ATTEMPTS))) return [3 /*break*/, 21];
                order.paid_hold_buyer_invoice_updated = false;
                return [4 /*yield*/, messages.toBuyerPendingPaymentFailedMessage(bot, buyerUser, order, i18nCtx)];
            case 20:
                _a.sent();
                _a.label = 21;
            case 21: return [4 /*yield*/, messages.toAdminChannelPendingPaymentFailedMessage(bot, buyerUser, order, pending, i18nCtx)];
            case 22:
                _a.sent();
                _a.label = 23;
            case 23: return [3 /*break*/, 28];
            case 24:
                error_1 = _a.sent();
                message = error_1.toString();
                logger.error("attemptPendingPayments catch error: ".concat(message));
                return [3 /*break*/, 28];
            case 25: return [4 /*yield*/, order.save()];
            case 26:
                _a.sent();
                orderUpdated(order);
                return [4 /*yield*/, pending.save()];
            case 27:
                _a.sent();
                return [7 /*endfinally*/];
            case 28:
                _i++;
                return [3 /*break*/, 2];
            case 29: return [2 /*return*/];
        }
    });
}); };
exports.attemptCommunitiesPendingPayments = function (bot) { return __awaiter(void 0, void 0, void 0, function () {
    var pendingPayments, _i, pendingPayments_2, pending, isPending, payment, user, i18nCtx, community, error_2;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, PendingPayment.find({
                    paid: false,
                    attempts: { $lt: process.env.PAYMENT_ATTEMPTS },
                    is_invoice_expired: false,
                    community_id: { $ne: null },
                })];
            case 1:
                pendingPayments = _a.sent();
                _i = 0, pendingPayments_2 = pendingPayments;
                _a.label = 2;
            case 2:
                if (!(_i < pendingPayments_2.length)) return [3 /*break*/, 21];
                pending = pendingPayments_2[_i];
                _a.label = 3;
            case 3:
                _a.trys.push([3, 17, 18, 20]);
                pending.attempts++;
                return [4 /*yield*/, isPendingPayment(pending.payment_request)];
            case 4:
                isPending = _a.sent();
                // If the payments is on flight we don't do anything
                if (isPending)
                    return [2 /*return*/];
                return [4 /*yield*/, payRequest({
                        amount: pending.amount,
                        request: pending.payment_request,
                    })];
            case 5:
                payment = _a.sent();
                return [4 /*yield*/, User.findById(pending.user_id)];
            case 6:
                user = _a.sent();
                return [4 /*yield*/, getUserI18nContext(user)];
            case 7:
                i18nCtx = _a.sent();
                if (!(!!payment && payment.is_expired)) return [3 /*break*/, 9];
                pending.is_invoice_expired = true;
                return [4 /*yield*/, bot.telegram.sendMessage(user.tg_id, i18nCtx.t('invoice_expired_earnings'))];
            case 8:
                _a.sent();
                _a.label = 9;
            case 9: return [4 /*yield*/, Community.findById(pending.community_id)];
            case 10:
                community = _a.sent();
                if (!(!!payment && !!payment.confirmed_at)) return [3 /*break*/, 13];
                pending.paid = true;
                pending.paid_at = new Date().toISOString();
                // Reset the community's values
                community.earnings = 0;
                community.orders_to_redeem = 0;
                return [4 /*yield*/, community.save()];
            case 11:
                _a.sent();
                logger.info("Community ".concat(community.id, " withdrew ").concat(pending.amount, " sats, invoice with hash: ").concat(payment.id, " was paid"));
                return [4 /*yield*/, bot.telegram.sendMessage(user.tg_id, i18nCtx.t('pending_payment_success', {
                        id: community.id,
                        amount: pending.amount,
                        paymentSecret: payment.secret,
                    }))];
            case 12:
                _a.sent();
                return [3 /*break*/, 16];
            case 13:
                if (!(process.env.PAYMENT_ATTEMPTS !== undefined &&
                    pending.attempts === parseInt(process.env.PAYMENT_ATTEMPTS))) return [3 /*break*/, 15];
                return [4 /*yield*/, bot.telegram.sendMessage(user.tg_id, i18nCtx.t('pending_payment_failed', {
                        attempts: pending.attempts,
                    }))];
            case 14:
                _a.sent();
                _a.label = 15;
            case 15:
                logger.error("Community ".concat(community.id, ": Withdraw failed after ").concat(pending.attempts, " attempts, amount ").concat(pending.amount, " sats"));
                _a.label = 16;
            case 16: return [3 /*break*/, 20];
            case 17:
                error_2 = _a.sent();
                logger.error("attemptCommunitiesPendingPayments catch error: ".concat(error_2));
                return [3 /*break*/, 20];
            case 18: return [4 /*yield*/, pending.save()];
            case 19:
                _a.sent();
                return [7 /*endfinally*/];
            case 20:
                _i++;
                return [3 /*break*/, 2];
            case 21: return [2 /*return*/];
        }
    });
}); };
