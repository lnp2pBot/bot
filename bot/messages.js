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
var TelegramError = require('telegraf').TelegramError;
var QR = require('qrcode');
var _a = require('../util'), getCurrency = _a.getCurrency, numberFormat = _a.numberFormat, getDetailedOrder = _a.getDetailedOrder, secondsToTime = _a.secondsToTime, getOrderChannel = _a.getOrderChannel, holdInvoiceExpirationInSecs = _a.holdInvoiceExpirationInSecs, sanitizeMD = _a.sanitizeMD, getEmojiRate = _a.getEmojiRate, decimalRound = _a.decimalRound, getUserAge = _a.getUserAge, getStars = _a.getStars;
var logger = require('../logger').logger;
var startMessage = function (ctx) { return __awaiter(void 0, void 0, void 0, function () {
    var holdInvoiceExpiration, orderExpiration, disclaimer, message, error_1;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                holdInvoiceExpiration = holdInvoiceExpirationInSecs();
                orderExpiration = (holdInvoiceExpiration.expirationTimeInSecs -
                    holdInvoiceExpiration.safetyWindowInSecs) /
                    60 /
                    60;
                disclaimer = ctx.i18n.t('disclaimer');
                message = ctx.i18n.t('start', {
                    orderExpiration: Math.floor(orderExpiration),
                    channel: process.env.CHANNEL,
                    disclaimer: disclaimer,
                });
                return [4 /*yield*/, ctx.reply(message)];
            case 1:
                _a.sent();
                return [3 /*break*/, 3];
            case 2:
                error_1 = _a.sent();
                logger.error(error_1);
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); };
var initBotErrorMessage = function (ctx, bot, user) { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: 
            // Correct way to handle errors: https://github.com/telegraf/telegraf/issues/1757
            return [4 /*yield*/, bot.telegram.sendMessage(user.tg_id, ctx.i18n.t('init_bot_error')).catch(function (error) {
                    if (!(error instanceof TelegramError && error.response.error_code === 403)) {
                        logger.error(error);
                    }
                })];
            case 1:
                // Correct way to handle errors: https://github.com/telegraf/telegraf/issues/1757
                _a.sent();
                return [2 /*return*/];
        }
    });
}); };
var invoicePaymentRequestMessage = function (ctx, user, request, order, i18n, buyer) { return __awaiter(void 0, void 0, void 0, function () {
    var currency, expirationTime, stars, roundedRating, rate, ageInDays, message, qrBytes, error_2;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 4, , 5]);
                currency = getCurrency(order.fiat_code);
                currency =
                    !!currency && !!currency.symbol_native
                        ? currency.symbol_native
                        : order.fiat_code;
                expirationTime = Number(process.env.HOLD_INVOICE_EXPIRATION_WINDOW) / 60;
                stars = getEmojiRate(buyer.total_rating);
                roundedRating = decimalRound(buyer.total_rating, -1);
                rate = "".concat(roundedRating, " ").concat(stars, " (").concat(buyer.total_reviews, ")");
                ageInDays = getUserAge(buyer);
                message = i18n.t('invoice_payment_request', {
                    currency: currency,
                    order: order,
                    expirationTime: expirationTime,
                    rate: rate,
                    days: ageInDays,
                });
                return [4 /*yield*/, ctx.telegram.sendMessage(user.tg_id, message)];
            case 1:
                _a.sent();
                return [4 /*yield*/, QR.toBuffer(request)];
            case 2:
                qrBytes = _a.sent();
                // Send payment request in QR and text
                return [4 /*yield*/, ctx.telegram.sendMediaGroup(user.tg_id, [
                        {
                            type: 'photo',
                            media: { source: qrBytes },
                            caption: ['`', request, '`'].join(''),
                            parse_mode: 'MarkdownV2',
                        },
                    ])];
            case 3:
                // Send payment request in QR and text
                _a.sent();
                return [3 /*break*/, 5];
            case 4:
                error_2 = _a.sent();
                logger.error(error_2);
                return [3 /*break*/, 5];
            case 5: return [2 /*return*/];
        }
    });
}); };
var pendingSellMessage = function (ctx, user, order, channel, i18n) { return __awaiter(void 0, void 0, void 0, function () {
    var orderExpirationWindow, error_3;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 3, , 4]);
                orderExpirationWindow = Number(process.env.ORDER_PUBLISHED_EXPIRATION_WINDOW) / 60 / 60;
                return [4 /*yield*/, ctx.telegram.sendMessage(user.tg_id, i18n.t('pending_sell', {
                        channel: channel,
                        orderExpirationWindow: Math.round(orderExpirationWindow),
                    }))];
            case 1:
                _a.sent();
                return [4 /*yield*/, ctx.telegram.sendMessage(user.tg_id, i18n.t('cancel_order_cmd', { orderId: order._id }), { parse_mode: 'MarkdownV2' })];
            case 2:
                _a.sent();
                return [3 /*break*/, 4];
            case 3:
                error_3 = _a.sent();
                logger.error(error_3);
                return [3 /*break*/, 4];
            case 4: return [2 /*return*/];
        }
    });
}); };
var pendingBuyMessage = function (bot, user, order, channel, i18n) { return __awaiter(void 0, void 0, void 0, function () {
    var orderExpirationWindow, error_4;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 3, , 4]);
                orderExpirationWindow = Number(process.env.ORDER_PUBLISHED_EXPIRATION_WINDOW) / 60 / 60;
                return [4 /*yield*/, bot.telegram.sendMessage(user.tg_id, i18n.t('pending_buy', {
                        channel: channel,
                        orderExpirationWindow: Math.round(orderExpirationWindow),
                    }))];
            case 1:
                _a.sent();
                return [4 /*yield*/, bot.telegram.sendMessage(user.tg_id, i18n.t('cancel_order_cmd', { orderId: order._id }), { parse_mode: 'MarkdownV2' })];
            case 2:
                _a.sent();
                return [3 /*break*/, 4];
            case 3:
                error_4 = _a.sent();
                logger.error(error_4);
                return [3 /*break*/, 4];
            case 4: return [2 /*return*/];
        }
    });
}); };
var sellOrderCorrectFormatMessage = function (ctx) { return __awaiter(void 0, void 0, void 0, function () {
    var error_5;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                return [4 /*yield*/, ctx.reply(ctx.i18n.t('sell_correct_format'), {
                        parse_mode: 'MarkdownV2',
                    })];
            case 1:
                _a.sent();
                return [3 /*break*/, 3];
            case 2:
                error_5 = _a.sent();
                logger.error(error_5);
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); };
var buyOrderCorrectFormatMessage = function (ctx) { return __awaiter(void 0, void 0, void 0, function () {
    var error_6;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                return [4 /*yield*/, ctx.reply(ctx.i18n.t('buy_correct_format'), {
                        parse_mode: 'MarkdownV2',
                    })];
            case 1:
                _a.sent();
                return [3 /*break*/, 3];
            case 2:
                error_6 = _a.sent();
                logger.error(error_6);
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); };
var minimunAmountInvoiceMessage = function (ctx) { return __awaiter(void 0, void 0, void 0, function () {
    var error_7;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                return [4 /*yield*/, ctx.reply(ctx.i18n.t('min_invoice_amount', {
                        minPaymentAmount: process.env.MIN_PAYMENT_AMT,
                    }))];
            case 1:
                _a.sent();
                return [3 /*break*/, 3];
            case 2:
                error_7 = _a.sent();
                logger.error(error_7);
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); };
var minimunExpirationTimeInvoiceMessage = function (ctx) { return __awaiter(void 0, void 0, void 0, function () {
    var expirationTime, error_8;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                expirationTime = Number(process.env.INVOICE_EXPIRATION_WINDOW) / 60 / 1000;
                return [4 /*yield*/, ctx.reply(ctx.i18n.t('min_expiration_time', { expirationTime: expirationTime }))];
            case 1:
                _a.sent();
                return [3 /*break*/, 3];
            case 2:
                error_8 = _a.sent();
                logger.error(error_8);
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); };
var expiredInvoiceMessage = function (ctx) { return __awaiter(void 0, void 0, void 0, function () {
    var error_9;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                return [4 /*yield*/, ctx.reply(ctx.i18n.t('invoice_expired'))];
            case 1:
                _a.sent();
                return [3 /*break*/, 3];
            case 2:
                error_9 = _a.sent();
                logger.error(error_9);
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); };
var expiredInvoiceOnPendingMessage = function (bot, user, order, i18n) { return __awaiter(void 0, void 0, void 0, function () {
    var error_10;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 3, , 4]);
                return [4 /*yield*/, bot.telegram.sendMessage(user.tg_id, i18n.t('invoice_expired_long'))];
            case 1:
                _a.sent();
                return [4 /*yield*/, bot.telegram.sendMessage(user.tg_id, i18n.t('setinvoice_cmd_order', { orderId: order._id }), { parse_mode: 'MarkdownV2' })];
            case 2:
                _a.sent();
                return [3 /*break*/, 4];
            case 3:
                error_10 = _a.sent();
                logger.error(error_10);
                return [3 /*break*/, 4];
            case 4: return [2 /*return*/];
        }
    });
}); };
var requiredAddressInvoiceMessage = function (ctx) { return __awaiter(void 0, void 0, void 0, function () {
    var error_11;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                return [4 /*yield*/, ctx.reply(ctx.i18n.t('invoice_require_destination'))];
            case 1:
                _a.sent();
                return [3 /*break*/, 3];
            case 2:
                error_11 = _a.sent();
                logger.error(error_11);
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); };
var invoiceMustBeLargerMessage = function (ctx) { return __awaiter(void 0, void 0, void 0, function () {
    var error_12;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                return [4 /*yield*/, ctx.reply(ctx.i18n.t('invoice_must_be_larger_error', {
                        minInvoice: process.env.MIN_PAYMENT_AMT,
                    }))];
            case 1:
                _a.sent();
                return [3 /*break*/, 3];
            case 2:
                error_12 = _a.sent();
                logger.error(error_12);
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); };
var invoiceExpiryTooShortMessage = function (ctx) { return __awaiter(void 0, void 0, void 0, function () {
    var error_13;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                return [4 /*yield*/, ctx.reply(ctx.i18n.t('invoice_expiry_too_short_error'))];
            case 1:
                _a.sent();
                return [3 /*break*/, 3];
            case 2:
                error_13 = _a.sent();
                logger.error(error_13);
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); };
var invoiceHasExpiredMessage = function (ctx) { return __awaiter(void 0, void 0, void 0, function () {
    var error_14;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                return [4 /*yield*/, ctx.reply(ctx.i18n.t('invoice_has_expired_error'))];
            case 1:
                _a.sent();
                return [3 /*break*/, 3];
            case 2:
                error_14 = _a.sent();
                logger.error(error_14);
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); };
var invoiceHasWrongDestinationMessage = function (ctx) { return __awaiter(void 0, void 0, void 0, function () {
    var error_15;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                return [4 /*yield*/, ctx.reply(ctx.i18n.t('invoice_has_wrong_destination_error'))];
            case 1:
                _a.sent();
                return [3 /*break*/, 3];
            case 2:
                error_15 = _a.sent();
                logger.error(error_15);
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); };
var requiredHashInvoiceMessage = function (ctx) { return __awaiter(void 0, void 0, void 0, function () {
    var error_16;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                return [4 /*yield*/, ctx.reply(ctx.i18n.t('invoice_require_hash'))];
            case 1:
                _a.sent();
                return [3 /*break*/, 3];
            case 2:
                error_16 = _a.sent();
                logger.error(error_16);
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); };
var invoiceInvalidMessage = function (ctx) { return __awaiter(void 0, void 0, void 0, function () {
    var error_17;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                return [4 /*yield*/, ctx.reply(ctx.i18n.t('invoice_invalid_error'))];
            case 1:
                _a.sent();
                return [3 /*break*/, 3];
            case 2:
                error_17 = _a.sent();
                logger.error(error_17);
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); };
var invalidOrderMessage = function (ctx, bot, user) { return __awaiter(void 0, void 0, void 0, function () {
    var error_18;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                return [4 /*yield*/, bot.telegram.sendMessage(user.tg_id, ctx.i18n.t('order_id_invalid'))];
            case 1:
                _a.sent();
                return [3 /*break*/, 3];
            case 2:
                error_18 = _a.sent();
                logger.error(error_18);
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); };
var invalidTypeOrderMessage = function (ctx, bot, user, type) { return __awaiter(void 0, void 0, void 0, function () {
    var error_19;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                return [4 /*yield*/, bot.telegram.sendMessage(user.tg_id, ctx.i18n.t('order_invalid_type', { type: type }))];
            case 1:
                _a.sent();
                return [3 /*break*/, 3];
            case 2:
                error_19 = _a.sent();
                logger.error(error_19);
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); };
var alreadyTakenOrderMessage = function (ctx, bot, user) { return __awaiter(void 0, void 0, void 0, function () {
    var error_20;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                return [4 /*yield*/, bot.telegram.sendMessage(user.tg_id, ctx.i18n.t('order_already_taken'))];
            case 1:
                _a.sent();
                return [3 /*break*/, 3];
            case 2:
                error_20 = _a.sent();
                logger.error(error_20);
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); };
var invalidDataMessage = function (ctx, bot, user) { return __awaiter(void 0, void 0, void 0, function () {
    var error_21;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                return [4 /*yield*/, bot.telegram.sendMessage(user.tg_id, ctx.i18n.t('invalid_data'))];
            case 1:
                _a.sent();
                return [3 /*break*/, 3];
            case 2:
                error_21 = _a.sent();
                logger.error(error_21);
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); };
var genericErrorMessage = function (bot, user, i18n) { return __awaiter(void 0, void 0, void 0, function () {
    var error_22;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                return [4 /*yield*/, bot.telegram.sendMessage(user.tg_id, i18n.t('generic_error'))];
            case 1:
                _a.sent();
                return [3 /*break*/, 3];
            case 2:
                error_22 = _a.sent();
                logger.error(error_22);
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); };
var beginTakeBuyMessage = function (ctx, bot, seller, order) { return __awaiter(void 0, void 0, void 0, function () {
    var expirationTime, error_23;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 3, , 4]);
                expirationTime = Number(process.env.HOLD_INVOICE_EXPIRATION_WINDOW) / 60;
                return [4 /*yield*/, bot.telegram.sendMessage(seller.tg_id, ctx.i18n.t('begin_take_buy', { expirationTime: expirationTime }))];
            case 1:
                _a.sent();
                return [4 /*yield*/, bot.telegram.sendMessage(seller.tg_id, order._id, {
                        reply_markup: {
                            inline_keyboard: [
                                [
                                    {
                                        text: ctx.i18n.t('continue'),
                                        callback_data: 'showHoldInvoiceBtn',
                                    },
                                    {
                                        text: ctx.i18n.t('cancel'),
                                        callback_data: 'cancelShowHoldInvoiceBtn',
                                    },
                                ],
                            ],
                        },
                    })];
            case 2:
                _a.sent();
                return [3 /*break*/, 4];
            case 3:
                error_23 = _a.sent();
                logger.error(error_23);
                return [3 /*break*/, 4];
            case 4: return [2 /*return*/];
        }
    });
}); };
var showHoldInvoiceMessage = function (ctx, request, amount, fiatCode, fiatAmount) { return __awaiter(void 0, void 0, void 0, function () {
    var currency, qrBytes, error_24;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 4, , 5]);
                currency = getCurrency(fiatCode);
                currency =
                    !!currency && !!currency.symbol_native
                        ? currency.symbol_native
                        : fiatCode;
                return [4 /*yield*/, ctx.reply(ctx.i18n.t('pay_invoice', {
                        amount: numberFormat(fiatCode, amount),
                        fiatAmount: numberFormat(fiatCode, fiatAmount),
                        currency: currency,
                    }))];
            case 1:
                _a.sent();
                return [4 /*yield*/, QR.toBuffer(request)];
            case 2:
                qrBytes = _a.sent();
                // Send payment request in QR and text
                return [4 /*yield*/, ctx.replyWithMediaGroup([
                        {
                            type: 'photo',
                            media: { source: qrBytes },
                            caption: ['`', request, '`'].join(''),
                            parse_mode: 'MarkdownV2',
                        },
                    ])];
            case 3:
                // Send payment request in QR and text
                _a.sent();
                return [3 /*break*/, 5];
            case 4:
                error_24 = _a.sent();
                logger.error(error_24);
                return [3 /*break*/, 5];
            case 5: return [2 /*return*/];
        }
    });
}); };
var onGoingTakeBuyMessage = function (bot, seller, buyer, order, i18nBuyer, i18nSeller, rate) { return __awaiter(void 0, void 0, void 0, function () {
    var holdInvoiceExpiration, orderExpiration, time, expirationTime, ageInDays, error_25;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 4, , 5]);
                return [4 /*yield*/, bot.telegram.sendMessage(seller.tg_id, i18nSeller.t('payment_received'))];
            case 1:
                _a.sent();
                holdInvoiceExpiration = holdInvoiceExpirationInSecs();
                orderExpiration = holdInvoiceExpiration.expirationTimeInSecs -
                    holdInvoiceExpiration.safetyWindowInSecs;
                time = secondsToTime(orderExpiration);
                expirationTime = time.hours + ' ' + i18nBuyer.t('hours');
                expirationTime +=
                    time.minutes > 0 ? ' ' + time.minutes + ' ' + i18nBuyer.t('minutes') : '';
                ageInDays = getUserAge(seller);
                return [4 /*yield*/, bot.telegram.sendMessage(buyer.tg_id, i18nBuyer.t('someone_took_your_order', {
                        expirationTime: expirationTime,
                        rate: rate,
                        days: ageInDays,
                    }))];
            case 2:
                _a.sent();
                return [4 /*yield*/, bot.telegram.sendMessage(buyer.tg_id, order._id, {
                        reply_markup: {
                            inline_keyboard: [
                                [{ text: i18nBuyer.t('continue'), callback_data: 'addInvoiceBtn' }],
                            ],
                        },
                    })];
            case 3:
                _a.sent();
                return [3 /*break*/, 5];
            case 4:
                error_25 = _a.sent();
                logger.error(error_25);
                return [3 /*break*/, 5];
            case 5: return [2 /*return*/];
        }
    });
}); };
var beginTakeSellMessage = function (ctx, bot, buyer, order) { return __awaiter(void 0, void 0, void 0, function () {
    var holdInvoiceExpiration, orderExpiration, time, expirationTime, error_26;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 3, , 4]);
                holdInvoiceExpiration = holdInvoiceExpirationInSecs();
                orderExpiration = holdInvoiceExpiration.expirationTimeInSecs -
                    holdInvoiceExpiration.safetyWindowInSecs;
                time = secondsToTime(orderExpiration);
                expirationTime = time.hours + ' ' + ctx.i18n.t('hours');
                expirationTime +=
                    time.minutes > 0 ? ' ' + time.minutes + ' ' + ctx.i18n.t('minutes') : '';
                return [4 /*yield*/, bot.telegram.sendMessage(buyer.tg_id, ctx.i18n.t('you_took_someone_order', { expirationTime: expirationTime }), { parse_mode: 'MarkdownV2' })];
            case 1:
                _a.sent();
                return [4 /*yield*/, bot.telegram.sendMessage(buyer.tg_id, order._id, {
                        reply_markup: {
                            inline_keyboard: [
                                [
                                    { text: ctx.i18n.t('continue'), callback_data: 'addInvoiceBtn' },
                                    {
                                        text: ctx.i18n.t('cancel'),
                                        callback_data: 'cancelAddInvoiceBtn',
                                    },
                                ],
                            ],
                        },
                    })];
            case 2:
                _a.sent();
                return [3 /*break*/, 4];
            case 3:
                error_26 = _a.sent();
                logger.error(error_26);
                return [3 /*break*/, 4];
            case 4: return [2 /*return*/];
        }
    });
}); };
var onGoingTakeSellMessage = function (bot, sellerUser, buyerUser, order, i18nBuyer, i18nSeller) { return __awaiter(void 0, void 0, void 0, function () {
    var error_27;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 4, , 5]);
                return [4 /*yield*/, bot.telegram.sendMessage(buyerUser.tg_id, i18nBuyer.t('get_in_touch_with_seller', {
                        orderId: order.id,
                        currency: order.fiat_code,
                        sellerUsername: sellerUser.username,
                        fiatAmount: numberFormat(order.fiat_code, order.fiat_amount),
                        paymentMethod: order.payment_method,
                    }))];
            case 1:
                _a.sent();
                return [4 /*yield*/, bot.telegram.sendMessage(buyerUser.tg_id, i18nBuyer.t('fiatsent_order_cmd'), { parse_mode: 'MarkdownV2' })];
            case 2:
                _a.sent();
                return [4 /*yield*/, bot.telegram.sendMessage(sellerUser.tg_id, i18nSeller.t('buyer_took_your_order', {
                        orderId: order.id,
                        fiatAmount: order.fiat_amount,
                        paymentMethod: order.payment_method,
                        currency: order.fiat_code,
                        buyerUsername: buyerUser.username,
                    }))];
            case 3:
                _a.sent();
                return [3 /*break*/, 5];
            case 4:
                error_27 = _a.sent();
                logger.error(error_27);
                return [3 /*break*/, 5];
            case 5: return [2 /*return*/];
        }
    });
}); };
var takeSellWaitingSellerToPayMessage = function (ctx, bot, buyerUser, order) { return __awaiter(void 0, void 0, void 0, function () {
    var error_28;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                return [4 /*yield*/, bot.telegram.sendMessage(buyerUser.tg_id, ctx.i18n.t('waiting_seller_to_pay', { orderId: order._id }))];
            case 1:
                _a.sent();
                return [3 /*break*/, 3];
            case 2:
                error_28 = _a.sent();
                logger.error(error_28);
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); };
var releasedSatsMessage = function (bot, sellerUser, buyerUser, i18nBuyer, i18nSeller) { return __awaiter(void 0, void 0, void 0, function () {
    var error_29;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 3, , 4]);
                return [4 /*yield*/, bot.telegram.sendMessage(sellerUser.tg_id, i18nSeller.t('sell_success', { buyerUsername: buyerUser.username }))];
            case 1:
                _a.sent();
                return [4 /*yield*/, bot.telegram.sendMessage(buyerUser.tg_id, i18nBuyer.t('funds_released', { sellerUsername: sellerUser.username }))];
            case 2:
                _a.sent();
                return [3 /*break*/, 4];
            case 3:
                error_29 = _a.sent();
                logger.error(error_29);
                return [3 /*break*/, 4];
            case 4: return [2 /*return*/];
        }
    });
}); };
var rateUserMessage = function (bot, caller, order, i18n) { return __awaiter(void 0, void 0, void 0, function () {
    var starButtons, num, error_30;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                starButtons = [];
                for (num = 5; num > 0; num--) {
                    starButtons.push([
                        {
                            text: '⭐'.repeat(num),
                            callback_data: "showStarBtn(".concat(num, ",").concat(order._id, ")"),
                        },
                    ]);
                }
                return [4 /*yield*/, bot.telegram.sendMessage(caller.tg_id, i18n.t('rate_counterpart'), {
                        reply_markup: {
                            inline_keyboard: starButtons,
                        },
                    })];
            case 1:
                _a.sent();
                return [3 /*break*/, 3];
            case 2:
                error_30 = _a.sent();
                logger.error(error_30);
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); };
var notActiveOrderMessage = function (ctx) { return __awaiter(void 0, void 0, void 0, function () {
    var error_31;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                return [4 /*yield*/, ctx.reply(ctx.i18n.t('cant_process_order'))];
            case 1:
                _a.sent();
                return [3 /*break*/, 3];
            case 2:
                error_31 = _a.sent();
                logger.error(error_31);
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); };
var waitingForBuyerOrderMessage = function (ctx) { return __awaiter(void 0, void 0, void 0, function () {
    var error_32;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                return [4 /*yield*/, ctx.reply(ctx.i18n.t('cant_release_order'))];
            case 1:
                _a.sent();
                return [3 /*break*/, 3];
            case 2:
                error_32 = _a.sent();
                logger.error(error_32);
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); };
var notOrderMessage = function (ctx) { return __awaiter(void 0, void 0, void 0, function () {
    var error_33;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                return [4 /*yield*/, ctx.reply(ctx.i18n.t('no_id_related'))];
            case 1:
                _a.sent();
                return [3 /*break*/, 3];
            case 2:
                error_33 = _a.sent();
                logger.error(error_33);
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); };
var publishBuyOrderMessage = function (bot, user, order, i18n, messageToUser) { return __awaiter(void 0, void 0, void 0, function () {
    var publishMessage, channel, message1, error_34;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 6, , 7]);
                publishMessage = "\u26A1\uFE0F\uD83C\uDF4A\u26A1\uFE0F\n".concat(order.description, "\n");
                publishMessage += ":".concat(order._id, ":");
                return [4 /*yield*/, getOrderChannel(order)];
            case 1:
                channel = _a.sent();
                return [4 /*yield*/, bot.telegram.sendMessage(channel, publishMessage, {
                        reply_markup: {
                            inline_keyboard: [
                                [{ text: i18n.t('sell_sats'), callback_data: 'takebuy' }],
                            ],
                        },
                    })];
            case 2:
                message1 = _a.sent();
                // We save the id of the message in the order
                order.tg_channel_message1 =
                    message1 && (message1.message_id).toString() ? (message1.message_id).toString() : null;
                return [4 /*yield*/, order.save()];
            case 3:
                _a.sent();
                if (!messageToUser) return [3 /*break*/, 5];
                // Message to user let know the order was published
                return [4 /*yield*/, pendingBuyMessage(bot, user, order, channel, i18n)];
            case 4:
                // Message to user let know the order was published
                _a.sent();
                _a.label = 5;
            case 5: return [3 /*break*/, 7];
            case 6:
                error_34 = _a.sent();
                logger.error(error_34);
                return [3 /*break*/, 7];
            case 7: return [2 /*return*/];
        }
    });
}); };
var publishSellOrderMessage = function (ctx, user, order, i18n, messageToUser) { return __awaiter(void 0, void 0, void 0, function () {
    var publishMessage, channel, message1, error_35;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 6, , 7]);
                publishMessage = "\u26A1\uFE0F\uD83C\uDF4A\u26A1\uFE0F\n".concat(order.description, "\n");
                publishMessage += ":".concat(order._id, ":");
                return [4 /*yield*/, getOrderChannel(order)];
            case 1:
                channel = _a.sent();
                return [4 /*yield*/, ctx.telegram.sendMessage(channel, publishMessage, {
                        reply_markup: {
                            inline_keyboard: [
                                [{ text: i18n.t('buy_sats'), callback_data: 'takesell' }],
                            ],
                        },
                    })];
            case 2:
                message1 = _a.sent();
                // We save the id of the message in the order
                order.tg_channel_message1 =
                    message1 && (message1.message_id).toString() ? (message1.message_id).toString() : null;
                return [4 /*yield*/, order.save()];
            case 3:
                _a.sent();
                if (!messageToUser) return [3 /*break*/, 5];
                return [4 /*yield*/, pendingSellMessage(ctx, user, order, channel, i18n)];
            case 4:
                _a.sent();
                _a.label = 5;
            case 5: return [3 /*break*/, 7];
            case 6:
                error_35 = _a.sent();
                logger.error(error_35);
                return [3 /*break*/, 7];
            case 7: return [2 /*return*/];
        }
    });
}); };
var customMessage = function (ctx, message) { return __awaiter(void 0, void 0, void 0, function () {
    var error_36;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                return [4 /*yield*/, ctx.reply(message, { parse_mode: 'MarkdownV2' })];
            case 1:
                _a.sent();
                return [3 /*break*/, 3];
            case 2:
                error_36 = _a.sent();
                logger.error(error_36);
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); };
var checkOrderMessage = function (ctx, order, buyer, seller) { return __awaiter(void 0, void 0, void 0, function () {
    var message, error_37;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                message = getDetailedOrder(ctx.i18n, order, buyer, seller);
                message += "\n\n";
                return [4 /*yield*/, ctx.reply(message, { parse_mode: 'MarkdownV2' })];
            case 1:
                _a.sent();
                return [3 /*break*/, 3];
            case 2:
                error_37 = _a.sent();
                logger.error(error_37);
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); };
var checkInvoiceMessage = function (ctx, isConfirmed, isCanceled, isHeld) { return __awaiter(void 0, void 0, void 0, function () {
    var error_38;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 8, , 9]);
                if (!isConfirmed) return [3 /*break*/, 2];
                return [4 /*yield*/, ctx.reply(ctx.i18n.t('invoice_settled'))];
            case 1: return [2 /*return*/, _a.sent()];
            case 2:
                if (!isCanceled) return [3 /*break*/, 4];
                return [4 /*yield*/, ctx.reply(ctx.i18n.t('invoice_cancelled'))];
            case 3: return [2 /*return*/, _a.sent()];
            case 4:
                if (!isHeld) return [3 /*break*/, 6];
                return [4 /*yield*/, ctx.reply(ctx.i18n.t('invoice_held'))];
            case 5: return [2 /*return*/, _a.sent()];
            case 6: return [4 /*yield*/, ctx.reply(ctx.i18n.t('invoice_no_info'))];
            case 7: return [2 /*return*/, _a.sent()];
            case 8:
                error_38 = _a.sent();
                logger.error(error_38);
                return [3 /*break*/, 9];
            case 9: return [2 /*return*/];
        }
    });
}); };
var mustBeValidCurrency = function (ctx) { return __awaiter(void 0, void 0, void 0, function () {
    var error_39;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                return [4 /*yield*/, ctx.reply(ctx.i18n.t('must_be_valid_currency'))];
            case 1:
                _a.sent();
                return [3 /*break*/, 3];
            case 2:
                error_39 = _a.sent();
                logger.error(error_39);
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); };
var mustBeANumberOrRange = function (ctx) { return __awaiter(void 0, void 0, void 0, function () {
    var error_40;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                return [4 /*yield*/, ctx.reply(ctx.i18n.t('must_be_number_or_range'))];
            case 1:
                _a.sent();
                return [3 /*break*/, 3];
            case 2:
                error_40 = _a.sent();
                logger.error(error_40);
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); };
var invalidLightningAddress = function (ctx) { return __awaiter(void 0, void 0, void 0, function () {
    var error_41;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                return [4 /*yield*/, ctx.reply(ctx.i18n.t('invalid_lightning_address'))];
            case 1:
                _a.sent();
                return [3 /*break*/, 3];
            case 2:
                error_41 = _a.sent();
                logger.error(error_41);
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); };
var helpMessage = function (ctx) { return __awaiter(void 0, void 0, void 0, function () {
    var error_42;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                return [4 /*yield*/, ctx.reply(ctx.i18n.t('help'), { parse_mode: 'Markdown' })];
            case 1:
                _a.sent();
                return [3 /*break*/, 3];
            case 2:
                error_42 = _a.sent();
                logger.error(error_42);
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); };
var disclaimerMessage = function (ctx) { return __awaiter(void 0, void 0, void 0, function () {
    var error_43;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                return [4 /*yield*/, ctx.reply(ctx.i18n.t('disclaimer'), { parse_mode: 'Markdown' })];
            case 1:
                _a.sent();
                return [3 /*break*/, 3];
            case 2:
                error_43 = _a.sent();
                logger.error(error_43);
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); };
var mustBeGreatherEqThan = function (ctx, fieldName, qty) { return __awaiter(void 0, void 0, void 0, function () {
    var error_44;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                return [4 /*yield*/, ctx.reply(ctx.i18n.t('must_be_gt_or_eq', {
                        fieldName: fieldName,
                        qty: qty,
                    }))];
            case 1:
                _a.sent();
                return [3 /*break*/, 3];
            case 2:
                error_44 = _a.sent();
                logger.error(error_44);
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); };
var bannedUserErrorMessage = function (ctx, user) { return __awaiter(void 0, void 0, void 0, function () {
    var error_45;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                return [4 /*yield*/, ctx.telegram.sendMessage(user.tg_id, ctx.i18n.t('you_have_been_banned'))];
            case 1:
                _a.sent();
                return [3 /*break*/, 3];
            case 2:
                error_45 = _a.sent();
                logger.error(error_45);
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); };
var fiatSentMessages = function (ctx, buyer, seller, i18nBuyer, i18nSeller) { return __awaiter(void 0, void 0, void 0, function () {
    var error_46;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 4, , 5]);
                return [4 /*yield*/, ctx.telegram.sendMessage(buyer.tg_id, i18nBuyer.t('I_told_seller_you_sent_fiat', {
                        sellerUsername: seller.username,
                    }))];
            case 1:
                _a.sent();
                return [4 /*yield*/, ctx.telegram.sendMessage(seller.tg_id, i18nSeller.t('buyer_told_me_that_sent_fiat', {
                        buyerUsername: buyer.username,
                    }))];
            case 2:
                _a.sent();
                return [4 /*yield*/, ctx.telegram.sendMessage(seller.tg_id, i18nSeller.t('release_order_cmd'), { parse_mode: 'Markdown' })];
            case 3:
                _a.sent();
                return [3 /*break*/, 5];
            case 4:
                error_46 = _a.sent();
                logger.error(error_46);
                return [3 /*break*/, 5];
            case 5: return [2 /*return*/];
        }
    });
}); };
var orderOnfiatSentStatusMessages = function (ctx, user) { return __awaiter(void 0, void 0, void 0, function () {
    var error_47;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                return [4 /*yield*/, ctx.telegram.sendMessage(user.tg_id, ctx.i18n.t('you_have_orders_waiting'))];
            case 1:
                _a.sent();
                return [3 /*break*/, 3];
            case 2:
                error_47 = _a.sent();
                logger.error(error_47);
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); };
var userBannedMessage = function (ctx) { return __awaiter(void 0, void 0, void 0, function () {
    var error_48;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                return [4 /*yield*/, ctx.reply(ctx.i18n.t('user_banned'))];
            case 1:
                _a.sent();
                return [3 /*break*/, 3];
            case 2:
                error_48 = _a.sent();
                logger.error(error_48);
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); };
var userUnBannedMessage = function (ctx) { return __awaiter(void 0, void 0, void 0, function () {
    var error_49;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                return [4 /*yield*/, ctx.reply(ctx.i18n.t('user_unbanned'))];
            case 1:
                _a.sent();
                return [3 /*break*/, 3];
            case 2:
                error_49 = _a.sent();
                logger.error(error_49);
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); };
var notFoundUserMessage = function (ctx) { return __awaiter(void 0, void 0, void 0, function () {
    var error_50;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                return [4 /*yield*/, ctx.reply(ctx.i18n.t('user_not_found'))];
            case 1:
                _a.sent();
                return [3 /*break*/, 3];
            case 2:
                error_50 = _a.sent();
                logger.error(error_50);
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); };
var errorParsingInvoiceMessage = function (ctx) { return __awaiter(void 0, void 0, void 0, function () {
    var error_51;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                return [4 /*yield*/, ctx.reply(ctx.i18n.t('parse_invoice_error'))];
            case 1:
                _a.sent();
                return [3 /*break*/, 3];
            case 2:
                error_51 = _a.sent();
                logger.error(error_51);
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); };
var notValidIdMessage = function (ctx) { return __awaiter(void 0, void 0, void 0, function () {
    var error_52;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                return [4 /*yield*/, ctx.reply(ctx.i18n.t('invalid_id'))];
            case 1:
                _a.sent();
                return [3 /*break*/, 3];
            case 2:
                error_52 = _a.sent();
                logger.error(error_52);
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); };
var addInvoiceMessage = function (ctx, bot, buyer, seller, order) { return __awaiter(void 0, void 0, void 0, function () {
    var error_53;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 3, , 4]);
                return [4 /*yield*/, bot.telegram.sendMessage(buyer.tg_id, ctx.i18n.t('get_in_touch_with_seller', {
                        orderId: order.id,
                        currency: order.fiat_code,
                        sellerUsername: seller.username,
                        fiatAmount: numberFormat(order.fiat_code, order.fiat_amount),
                        paymentMethod: order.payment_method,
                    }))];
            case 1:
                _a.sent();
                return [4 /*yield*/, bot.telegram.sendMessage(buyer.tg_id, ctx.i18n.t('fiatsent_order_cmd'), { parse_mode: 'MarkdownV2' })];
            case 2:
                _a.sent();
                return [3 /*break*/, 4];
            case 3:
                error_53 = _a.sent();
                logger.error(error_53);
                return [3 /*break*/, 4];
            case 4: return [2 /*return*/];
        }
    });
}); };
var sendBuyerInfo2SellerMessage = function (bot, buyer, seller, order, i18n) { return __awaiter(void 0, void 0, void 0, function () {
    var error_54;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                return [4 /*yield*/, bot.telegram.sendMessage(seller.tg_id, i18n.t('get_in_touch_with_buyer', {
                        currency: order.fiat_code,
                        orderId: order.id,
                        buyerUsername: buyer.username,
                        fiatAmount: numberFormat(order.fiat_code, order.fiat_amount),
                        paymentMethod: order.payment_method,
                    }))];
            case 1:
                _a.sent();
                return [3 /*break*/, 3];
            case 2:
                error_54 = _a.sent();
                logger.error(error_54);
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); };
var cantTakeOwnOrderMessage = function (ctx, bot, user) { return __awaiter(void 0, void 0, void 0, function () {
    var error_55;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                return [4 /*yield*/, bot.telegram.sendMessage(user.tg_id, ctx.i18n.t('cant_take_own_order'))];
            case 1:
                _a.sent();
                return [3 /*break*/, 3];
            case 2:
                error_55 = _a.sent();
                logger.error(error_55);
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); };
var notLightningInvoiceMessage = function (ctx, order) { return __awaiter(void 0, void 0, void 0, function () {
    var error_56;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 3, , 4]);
                return [4 /*yield*/, ctx.reply(ctx.i18n.t('send_me_lninvoice', { amount: order.amount }))];
            case 1:
                _a.sent();
                return [4 /*yield*/, ctx.reply(ctx.i18n.t('setinvoice_cmd_order', { orderId: order._id }), { parse_mode: 'MarkdownV2' })];
            case 2:
                _a.sent();
                return [3 /*break*/, 4];
            case 3:
                error_56 = _a.sent();
                logger.error(error_56);
                return [3 /*break*/, 4];
            case 4: return [2 /*return*/];
        }
    });
}); };
var notOrdersMessage = function (ctx) { return __awaiter(void 0, void 0, void 0, function () {
    var error_57;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                return [4 /*yield*/, ctx.reply(ctx.i18n.t('you_have_no_orders'))];
            case 1:
                _a.sent();
                return [3 /*break*/, 3];
            case 2:
                error_57 = _a.sent();
                logger.error(error_57);
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); };
var notRateForCurrency = function (bot, user, i18n) { return __awaiter(void 0, void 0, void 0, function () {
    var error_58;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                return [4 /*yield*/, bot.telegram.sendMessage(user.tg_id, i18n.t('not_rate_for_currency', {
                        fiatRateProvider: process.env.FIAT_RATE_NAME,
                    }))];
            case 1:
                _a.sent();
                return [3 /*break*/, 3];
            case 2:
                error_58 = _a.sent();
                logger.error(error_58);
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); };
var incorrectAmountInvoiceMessage = function (ctx) { return __awaiter(void 0, void 0, void 0, function () {
    var error_59;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                return [4 /*yield*/, ctx.reply(ctx.i18n.t('invoice_with_incorrect_amount'))];
            case 1:
                _a.sent();
                return [3 /*break*/, 3];
            case 2:
                error_59 = _a.sent();
                logger.error(error_59);
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); };
var invoiceUpdatedMessage = function (ctx) { return __awaiter(void 0, void 0, void 0, function () {
    var error_60;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                return [4 /*yield*/, ctx.reply(ctx.i18n.t('invoice_updated'))];
            case 1:
                _a.sent();
                return [3 /*break*/, 3];
            case 2:
                error_60 = _a.sent();
                logger.error(error_60);
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); };
var invoiceUpdatedPaymentWillBeSendMessage = function (ctx) { return __awaiter(void 0, void 0, void 0, function () {
    var error_61;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                return [4 /*yield*/, ctx.reply(ctx.i18n.t('invoice_updated_and_will_be_paid'))];
            case 1:
                _a.sent();
                return [3 /*break*/, 3];
            case 2:
                error_61 = _a.sent();
                logger.error(error_61);
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); };
var invoiceAlreadyUpdatedMessage = function (ctx) { return __awaiter(void 0, void 0, void 0, function () {
    var error_62;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                return [4 /*yield*/, ctx.reply(ctx.i18n.t('invoice_already_being_paid'))];
            case 1:
                _a.sent();
                return [3 /*break*/, 3];
            case 2:
                error_62 = _a.sent();
                logger.error(error_62);
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); };
var successSetAddress = function (ctx) { return __awaiter(void 0, void 0, void 0, function () {
    var error_63;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                return [4 /*yield*/, ctx.reply(ctx.i18n.t('lightning_address_saved'))];
            case 1:
                _a.sent();
                return [3 /*break*/, 3];
            case 2:
                error_63 = _a.sent();
                logger.error(error_63);
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); };
var badStatusOnCancelOrderMessage = function (ctx) { return __awaiter(void 0, void 0, void 0, function () {
    var error_64;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                return [4 /*yield*/, ctx.reply(ctx.i18n.t('cancel_error'))];
            case 1:
                _a.sent();
                return [3 /*break*/, 3];
            case 2:
                error_64 = _a.sent();
                logger.error(error_64);
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); };
var orderIsAlreadyCanceledMessage = function (ctx) { return __awaiter(void 0, void 0, void 0, function () {
    var error_65;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                return [4 /*yield*/, ctx.reply(ctx.i18n.t('already_cancelled'))];
            case 1:
                _a.sent();
                return [3 /*break*/, 3];
            case 2:
                error_65 = _a.sent();
                logger.error(error_65);
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); };
var successCancelOrderMessage = function (ctx, user, order, i18n) { return __awaiter(void 0, void 0, void 0, function () {
    var error_66;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                return [4 /*yield*/, ctx.telegram.sendMessage(user.tg_id, i18n.t('cancel_success', { orderId: order._id }))];
            case 1:
                _a.sent();
                return [3 /*break*/, 3];
            case 2:
                error_66 = _a.sent();
                logger.error(error_66);
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); };
var counterPartyCancelOrderMessage = function (ctx, user, order, i18n) { return __awaiter(void 0, void 0, void 0, function () {
    var error_67;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                return [4 /*yield*/, ctx.telegram.sendMessage(user.tg_id, i18n.t('order_cancelled_by_counterparty', { orderId: order._id }))];
            case 1:
                _a.sent();
                return [3 /*break*/, 3];
            case 2:
                error_67 = _a.sent();
                logger.error(error_67);
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); };
var successCancelAllOrdersMessage = function (ctx) { return __awaiter(void 0, void 0, void 0, function () {
    var error_68;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                return [4 /*yield*/, ctx.reply(ctx.i18n.t('cancelall_success'))];
            case 1:
                _a.sent();
                return [3 /*break*/, 3];
            case 2:
                error_68 = _a.sent();
                logger.error(error_68);
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); };
var successCancelOrderByAdminMessage = function (ctx, bot, user, order) { return __awaiter(void 0, void 0, void 0, function () {
    var error_69;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                return [4 /*yield*/, bot.telegram.sendMessage(user.tg_id, ctx.i18n.t('order_cancelled_by_admin', { orderId: order._id }))];
            case 1:
                _a.sent();
                return [3 /*break*/, 3];
            case 2:
                error_69 = _a.sent();
                logger.error(error_69);
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); };
var successCompleteOrderMessage = function (ctx, order) { return __awaiter(void 0, void 0, void 0, function () {
    var error_70;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                return [4 /*yield*/, ctx.reply(ctx.i18n.t('order_completed', { orderId: order._id }))];
            case 1:
                _a.sent();
                return [3 /*break*/, 3];
            case 2:
                error_70 = _a.sent();
                logger.error(error_70);
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); };
var successCompleteOrderByAdminMessage = function (ctx, bot, user, order) { return __awaiter(void 0, void 0, void 0, function () {
    var error_71;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                return [4 /*yield*/, bot.telegram.sendMessage(user.tg_id, ctx.i18n.t('order_completed_by_admin', { orderId: order._id }))];
            case 1:
                _a.sent();
                return [3 /*break*/, 3];
            case 2:
                error_71 = _a.sent();
                logger.error(error_71);
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); };
var shouldWaitCooperativeCancelMessage = function (ctx, user) { return __awaiter(void 0, void 0, void 0, function () {
    var error_72;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                return [4 /*yield*/, ctx.telegram.sendMessage(user.tg_id, ctx.i18n.t('have_to_wait_for_counterpart'))];
            case 1:
                _a.sent();
                return [3 /*break*/, 3];
            case 2:
                error_72 = _a.sent();
                logger.error(error_72);
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); };
var okCooperativeCancelMessage = function (ctx, user, order, i18n) { return __awaiter(void 0, void 0, void 0, function () {
    var error_73;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                return [4 /*yield*/, ctx.telegram.sendMessage(user.tg_id, i18n.t('ok_cooperativecancel', { orderId: order._id }))];
            case 1:
                _a.sent();
                return [3 /*break*/, 3];
            case 2:
                error_73 = _a.sent();
                logger.error(error_73);
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); };
var refundCooperativeCancelMessage = function (ctx, user, i18n) { return __awaiter(void 0, void 0, void 0, function () {
    var error_74;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                return [4 /*yield*/, ctx.telegram.sendMessage(user.tg_id, i18n.t('refund_cooperativecancel'))];
            case 1:
                _a.sent();
                return [3 /*break*/, 3];
            case 2:
                error_74 = _a.sent();
                logger.error(error_74);
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); };
var initCooperativeCancelMessage = function (ctx, order) { return __awaiter(void 0, void 0, void 0, function () {
    var error_75;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                return [4 /*yield*/, ctx.reply(ctx.i18n.t('init_cooperativecancel', { orderId: order._id }))];
            case 1:
                _a.sent();
                return [3 /*break*/, 3];
            case 2:
                error_75 = _a.sent();
                logger.error(error_75);
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); };
var counterPartyWantsCooperativeCancelMessage = function (ctx, user, order, i18n) { return __awaiter(void 0, void 0, void 0, function () {
    var error_76;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 3, , 4]);
                return [4 /*yield*/, ctx.telegram.sendMessage(user.tg_id, i18n.t('counterparty_wants_cooperativecancel', { orderId: order._id }))];
            case 1:
                _a.sent();
                return [4 /*yield*/, ctx.telegram.sendMessage(user.tg_id, i18n.t('cancel_order_cmd', { orderId: order._id }), { parse_mode: 'MarkdownV2' })];
            case 2:
                _a.sent();
                return [3 /*break*/, 4];
            case 3:
                error_76 = _a.sent();
                logger.error(error_76);
                return [3 /*break*/, 4];
            case 4: return [2 /*return*/];
        }
    });
}); };
var invoicePaymentFailedMessage = function (bot, user, i18n) { return __awaiter(void 0, void 0, void 0, function () {
    var error_77;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                return [4 /*yield*/, bot.telegram.sendMessage(user.tg_id, i18n.t('invoice_payment_failed', {
                        pendingPaymentWindow: process.env.PENDING_PAYMENT_WINDOW,
                        attempts: process.env.PAYMENT_ATTEMPTS,
                    }))];
            case 1:
                _a.sent();
                return [3 /*break*/, 3];
            case 2:
                error_77 = _a.sent();
                logger.error(error_77);
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); };
var userCantTakeMoreThanOneWaitingOrderMessage = function (ctx, bot, user) { return __awaiter(void 0, void 0, void 0, function () {
    var error_78;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                return [4 /*yield*/, bot.telegram.sendMessage(user.tg_id, ctx.i18n.t('cant_take_more_orders'))];
            case 1:
                _a.sent();
                return [3 /*break*/, 3];
            case 2:
                error_78 = _a.sent();
                logger.error(error_78);
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); };
var sellerPaidHoldMessage = function (ctx, user) { return __awaiter(void 0, void 0, void 0, function () {
    var error_79;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                return [4 /*yield*/, ctx.telegram.sendMessage(user.tg_id, ctx.i18n.t('seller_released'))];
            case 1:
                _a.sent();
                return [3 /*break*/, 3];
            case 2:
                error_79 = _a.sent();
                logger.error(error_79);
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); };
var showInfoMessage = function (ctx, user, config) { return __awaiter(void 0, void 0, void 0, function () {
    var volume_traded, total_rating, disputes, ratingText, user_info, status, node_uri, bot_fee, routing_fee, error_80;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                volume_traded = sanitizeMD(user.volume_traded);
                total_rating = user.total_rating;
                disputes = user.disputes;
                ratingText = '';
                if (total_rating) {
                    ratingText = getStars(total_rating, user.total_reviews);
                }
                ratingText = sanitizeMD(ratingText);
                user_info = ctx.i18n.t('user_info', { volume_traded: volume_traded, total_rating: ratingText, disputes: disputes });
                status = config.node_status == 'up' ? '🟢' : '🔴';
                node_uri = sanitizeMD(config.node_uri);
                bot_fee = (Number(process.env.MAX_FEE) * 100).toString() + '%';
                bot_fee = bot_fee.replace('.', '\\.');
                routing_fee = (Number(process.env.MAX_ROUTING_FEE) * 100).toString() + '%';
                routing_fee = routing_fee.replace('.', '\\.');
                return [4 /*yield*/, ctx.telegram.sendMessage(user.tg_id, ctx.i18n.t('bot_info', { bot_fee: bot_fee, routing_fee: routing_fee, status: status, node_uri: node_uri, user_info: user_info }), {
                        parse_mode: 'MarkdownV2',
                    })];
            case 1:
                _a.sent();
                return [3 /*break*/, 3];
            case 2:
                error_80 = _a.sent();
                logger.error(error_80);
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); };
var buyerReceivedSatsMessage = function (bot, buyerUser, sellerUser, i18n) { return __awaiter(void 0, void 0, void 0, function () {
    var error_81;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                return [4 /*yield*/, bot.telegram.sendMessage(buyerUser.tg_id, i18n.t('your_purchase_is_completed', {
                        sellerUsername: sellerUser.username,
                    }))];
            case 1:
                _a.sent();
                return [3 /*break*/, 3];
            case 2:
                error_81 = _a.sent();
                logger.error(error_81);
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); };
var listCurrenciesResponse = function (ctx, currencies) { return __awaiter(void 0, void 0, void 0, function () {
    var response_1, error_82;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                response_1 = "Code |   Name   |\n";
                currencies.forEach(function (currency) {
                    response_1 += "".concat(currency.code, " | ").concat(currency.name, " | ").concat(currency.emoji, "\n");
                });
                return [4 /*yield*/, ctx.reply(response_1)];
            case 1:
                _a.sent();
                return [3 /*break*/, 3];
            case 2:
                error_82 = _a.sent();
                logger.error(error_82);
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); };
var priceApiFailedMessage = function (ctx, bot, user) { return __awaiter(void 0, void 0, void 0, function () {
    var error_83;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                return [4 /*yield*/, bot.telegram.sendMessage(user.tg_id, ctx.i18n.t('problem_getting_price'))];
            case 1:
                _a.sent();
                return [3 /*break*/, 3];
            case 2:
                error_83 = _a.sent();
                logger.error(error_83);
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); };
var updateUserSettingsMessage = function (ctx, field, newState) { return __awaiter(void 0, void 0, void 0, function () {
    var error_84;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                return [4 /*yield*/, ctx.reply(ctx.i18n.t('update_user_setting', {
                        field: field,
                        newState: newState,
                    }))];
            case 1:
                _a.sent();
                return [3 /*break*/, 3];
            case 2:
                error_84 = _a.sent();
                logger.error(error_84);
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); };
var disableLightningAddress = function (ctx) { return __awaiter(void 0, void 0, void 0, function () {
    var error_85;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                return [4 /*yield*/, ctx.reply(ctx.i18n.t('lightning_address_disabled'))];
            case 1:
                _a.sent();
                return [3 /*break*/, 3];
            case 2:
                error_85 = _a.sent();
                logger.error(error_85);
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); };
var invalidRangeWithAmount = function (ctx) { return __awaiter(void 0, void 0, void 0, function () {
    var error_86;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                return [4 /*yield*/, ctx.reply(ctx.i18n.t('invalid_range_with_amount'))];
            case 1:
                _a.sent();
                return [3 /*break*/, 3];
            case 2:
                error_86 = _a.sent();
                logger.error(error_86);
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); };
var tooManyPendingOrdersMessage = function (ctx, user, i18n) { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        try {
            ctx.telegram.sendMessage(user.tg_id, i18n.t('too_many_pending_orders'));
        }
        catch (error) {
            logger.error(error);
        }
        return [2 /*return*/];
    });
}); };
var wizardAddInvoiceInitMessage = function (ctx, order, currency, expirationTime) { return __awaiter(void 0, void 0, void 0, function () {
    var error_87;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                return [4 /*yield*/, ctx.reply(ctx.i18n.t('wizard_add_invoice_init', {
                        expirationTime: expirationTime,
                        satsAmount: numberFormat(order.fiat_code, order.amount),
                        currency: currency,
                        fiatAmount: numberFormat(order.fiat_code, order.fiat_amount),
                    }))];
            case 1:
                _a.sent();
                return [3 /*break*/, 3];
            case 2:
                error_87 = _a.sent();
                logger.error(error_87);
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); };
var wizardAddInvoiceExitMessage = function (ctx, order) { return __awaiter(void 0, void 0, void 0, function () {
    var error_88;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                return [4 /*yield*/, ctx.reply(ctx.i18n.t('wizard_add_invoice_exit', {
                        amount: numberFormat(order.fiat_code, order.amount),
                        orderId: order._id,
                    }), { parse_mode: 'MarkdownV2' })];
            case 1:
                _a.sent();
                return [3 /*break*/, 3];
            case 2:
                error_88 = _a.sent();
                logger.error(error_88);
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); };
var wizardExitMessage = function (ctx) { return __awaiter(void 0, void 0, void 0, function () {
    var error_89;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                return [4 /*yield*/, ctx.reply(ctx.i18n.t('wizard_exit'))];
            case 1:
                _a.sent();
                return [3 /*break*/, 3];
            case 2:
                error_89 = _a.sent();
                logger.error(error_89);
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); };
var orderExpiredMessage = function (ctx) { return __awaiter(void 0, void 0, void 0, function () {
    var error_90;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                return [4 /*yield*/, ctx.reply(ctx.i18n.t('order_expired'))];
            case 1:
                _a.sent();
                return [3 /*break*/, 3];
            case 2:
                error_90 = _a.sent();
                logger.error(error_90);
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); };
var cantAddInvoiceMessage = function (ctx) { return __awaiter(void 0, void 0, void 0, function () {
    var error_91;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                return [4 /*yield*/, ctx.reply(ctx.i18n.t('cant_add_invoice'))];
            case 1:
                _a.sent();
                return [3 /*break*/, 3];
            case 2:
                error_91 = _a.sent();
                logger.error(error_91);
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); };
var sendMeAnInvoiceMessage = function (ctx, amount, i18nCtx) { return __awaiter(void 0, void 0, void 0, function () {
    var error_92;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                return [4 /*yield*/, ctx.reply(i18nCtx.t('send_me_lninvoice', { amount: amount }))];
            case 1:
                _a.sent();
                return [3 /*break*/, 3];
            case 2:
                error_92 = _a.sent();
                logger.error(error_92);
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); };
var wizardAddFiatAmountMessage = function (ctx, currency, action, order) { return __awaiter(void 0, void 0, void 0, function () {
    var error_93;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                return [4 /*yield*/, ctx.reply(ctx.i18n.t('wizard_add_fiat_amount', {
                        action: action,
                        currency: currency,
                        fiatAmount: numberFormat(order.fiat_code, order.fiat_amount),
                        minAmount: numberFormat(order.fiat_code, order.min_amount),
                        maxAmount: numberFormat(order.fiat_code, order.max_amount),
                    }))];
            case 1:
                _a.sent();
                return [3 /*break*/, 3];
            case 2:
                error_93 = _a.sent();
                logger.error(error_93);
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); };
var wizardAddFiatAmountWrongAmountMessage = function (ctx, order) { return __awaiter(void 0, void 0, void 0, function () {
    var error_94;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                ctx.deleteMessage();
                return [4 /*yield*/, ctx.reply(ctx.i18n.t('wizard_add_fiat_wrong_amount', {
                        minAmount: numberFormat(order.fiat_code, order.min_amount),
                        maxAmount: numberFormat(order.fiat_code, order.max_amount),
                    }))];
            case 1:
                _a.sent();
                return [3 /*break*/, 3];
            case 2:
                error_94 = _a.sent();
                logger.error(error_94);
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); };
var wizardAddFiatAmountCorrectMessage = function (ctx, currency, fiatAmount) { return __awaiter(void 0, void 0, void 0, function () {
    var error_95;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                return [4 /*yield*/, ctx.reply(ctx.i18n.t('wizard_add_fiat_correct_amount', {
                        currency: currency.symbol_native,
                        fiatAmount: fiatAmount,
                    }))];
            case 1:
                _a.sent();
                return [3 /*break*/, 3];
            case 2:
                error_95 = _a.sent();
                logger.error(error_95);
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); };
var expiredOrderMessage = function (bot, order, buyerUser, sellerUser, i18n) { return __awaiter(void 0, void 0, void 0, function () {
    var detailedOrder, error_96;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                detailedOrder = getDetailedOrder(i18n, order, buyerUser, sellerUser);
                return [4 /*yield*/, bot.telegram.sendMessage(String(process.env.ADMIN_CHANNEL), i18n.t('expired_order', {
                        detailedOrder: detailedOrder,
                        buyerUser: buyerUser,
                        sellerUser: sellerUser,
                    }), { parse_mode: 'MarkdownV2' })];
            case 1:
                _a.sent();
                return [3 /*break*/, 3];
            case 2:
                error_96 = _a.sent();
                logger.error(error_96);
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); };
var toBuyerExpiredOrderMessage = function (bot, user, i18n) { return __awaiter(void 0, void 0, void 0, function () {
    var error_97;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                return [4 /*yield*/, bot.telegram.sendMessage(user.tg_id, i18n.t('expired_order_to_buyer', { helpGroup: process.env.HELP_GROUP }))];
            case 1:
                _a.sent();
                return [3 /*break*/, 3];
            case 2:
                error_97 = _a.sent();
                logger.error(error_97);
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); };
var toSellerExpiredOrderMessage = function (bot, user, i18n) { return __awaiter(void 0, void 0, void 0, function () {
    var error_98;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                return [4 /*yield*/, bot.telegram.sendMessage(user.tg_id, i18n.t('expired_order_to_seller', { helpGroup: process.env.HELP_GROUP }))];
            case 1:
                _a.sent();
                return [3 /*break*/, 3];
            case 2:
                error_98 = _a.sent();
                logger.error(error_98);
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); };
var toBuyerDidntAddInvoiceMessage = function (bot, user, order, i18n) { return __awaiter(void 0, void 0, void 0, function () {
    var error_99;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                return [4 /*yield*/, bot.telegram.sendMessage(user.tg_id, i18n.t('didnt_add_invoice', { orderId: order._id }))];
            case 1:
                _a.sent();
                return [3 /*break*/, 3];
            case 2:
                error_99 = _a.sent();
                logger.error(error_99);
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); };
var toSellerBuyerDidntAddInvoiceMessage = function (bot, user, order, i18n) { return __awaiter(void 0, void 0, void 0, function () {
    var error_100;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                return [4 /*yield*/, bot.telegram.sendMessage(user.tg_id, i18n.t('buyer_havent_add_invoice', { orderId: order._id }))];
            case 1:
                _a.sent();
                return [3 /*break*/, 3];
            case 2:
                error_100 = _a.sent();
                logger.error(error_100);
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); };
var toAdminChannelBuyerDidntAddInvoiceMessage = function (bot, user, order, i18n) { return __awaiter(void 0, void 0, void 0, function () {
    var error_101;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                return [4 /*yield*/, bot.telegram.sendMessage(String(process.env.ADMIN_CHANNEL), i18n.t('buyer_havent_add_invoice_to_admin_channel', {
                        orderId: order._id,
                        username: user.username,
                    }))];
            case 1:
                _a.sent();
                return [3 /*break*/, 3];
            case 2:
                error_101 = _a.sent();
                logger.error(error_101);
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); };
var toSellerDidntPayInvoiceMessage = function (bot, user, order, i18n) { return __awaiter(void 0, void 0, void 0, function () {
    var error_102;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                return [4 /*yield*/, bot.telegram.sendMessage(user.tg_id, i18n.t('havent_paid_invoice', { orderId: order._id }))];
            case 1:
                _a.sent();
                return [3 /*break*/, 3];
            case 2:
                error_102 = _a.sent();
                logger.error(error_102);
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); };
var toBuyerSellerDidntPayInvoiceMessage = function (bot, user, order, i18n) { return __awaiter(void 0, void 0, void 0, function () {
    var error_103;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                return [4 /*yield*/, bot.telegram.sendMessage(user.tg_id, i18n.t('seller_havent_paid_invoice', { orderId: order._id }))];
            case 1:
                _a.sent();
                return [3 /*break*/, 3];
            case 2:
                error_103 = _a.sent();
                logger.error(error_103);
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); };
var toAdminChannelSellerDidntPayInvoiceMessage = function (bot, user, order, i18n) { return __awaiter(void 0, void 0, void 0, function () {
    var error_104;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                return [4 /*yield*/, bot.telegram.sendMessage(String(process.env.ADMIN_CHANNEL), i18n.t('seller_havent_add_invoice_to_admin_channel', {
                        orderId: order._id,
                        username: user.username,
                    }))];
            case 1:
                _a.sent();
                return [3 /*break*/, 3];
            case 2:
                error_104 = _a.sent();
                logger.error(error_104);
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); };
var toAdminChannelPendingPaymentSuccessMessage = function (bot, user, order, pending, payment, i18n) { return __awaiter(void 0, void 0, void 0, function () {
    var error_105;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                return [4 /*yield*/, bot.telegram.sendMessage(String(process.env.ADMIN_CHANNEL), i18n.t('pending_payment_success_to_admin', {
                        orderId: order._id,
                        username: user.username,
                        attempts: pending.attempts,
                        amount: numberFormat(order.fiat_code, order.amount),
                        paymentSecret: payment.secret,
                    }))];
            case 1:
                _a.sent();
                return [3 /*break*/, 3];
            case 2:
                error_105 = _a.sent();
                logger.error(error_105);
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); };
var toBuyerPendingPaymentSuccessMessage = function (bot, user, order, payment, i18n) { return __awaiter(void 0, void 0, void 0, function () {
    var error_106;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                return [4 /*yield*/, bot.telegram.sendMessage(user.tg_id, i18n.t('pending_payment_success', {
                        id: order._id,
                        amount: numberFormat(order.fiat_code, order.amount),
                        paymentSecret: payment.secret,
                    }))];
            case 1:
                _a.sent();
                return [3 /*break*/, 3];
            case 2:
                error_106 = _a.sent();
                logger.error(error_106);
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); };
var toBuyerPendingPaymentFailedMessage = function (bot, user, order, i18n) { return __awaiter(void 0, void 0, void 0, function () {
    var attempts, error_107;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 3, , 4]);
                attempts = process.env.PAYMENT_ATTEMPTS;
                return [4 /*yield*/, bot.telegram.sendMessage(user.tg_id, i18n.t('pending_payment_failed', {
                        attempts: attempts,
                    }))];
            case 1:
                _a.sent();
                return [4 /*yield*/, bot.telegram.sendMessage(user.tg_id, i18n.t('press_to_continue'), {
                        reply_markup: {
                            inline_keyboard: [
                                [
                                    {
                                        text: i18n.t('continue'),
                                        callback_data: "addInvoicePHIBtn_".concat(order._id),
                                    },
                                ],
                            ],
                        },
                    })];
            case 2:
                _a.sent();
                return [3 /*break*/, 4];
            case 3:
                error_107 = _a.sent();
                logger.error(error_107);
                return [3 /*break*/, 4];
            case 4: return [2 /*return*/];
        }
    });
}); };
var toAdminChannelPendingPaymentFailedMessage = function (bot, user, order, pending, i18n) { return __awaiter(void 0, void 0, void 0, function () {
    var error_108;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                return [4 /*yield*/, bot.telegram.sendMessage(String(process.env.ADMIN_CHANNEL), i18n.t('pending_payment_failed_to_admin', {
                        attempts: pending.attempts,
                        orderId: order._id,
                        username: user.username,
                    }))];
            case 1:
                _a.sent();
                return [3 /*break*/, 3];
            case 2:
                error_108 = _a.sent();
                logger.error(error_108);
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); };
var currencyNotSupportedMessage = function (ctx, currencies) { return __awaiter(void 0, void 0, void 0, function () {
    var currenciesStr, error_109;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                currenciesStr = currencies.join(', ');
                return [4 /*yield*/, ctx.reply(ctx.i18n.t('currency_not_supported', { currenciesStr: currenciesStr }))];
            case 1:
                _a.sent();
                return [3 /*break*/, 3];
            case 2:
                error_109 = _a.sent();
                logger.error(error_109);
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); };
var notAuthorized = function (ctx, tgId) { return __awaiter(void 0, void 0, void 0, function () {
    var error_110;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 5, , 6]);
                if (!tgId) return [3 /*break*/, 2];
                return [4 /*yield*/, ctx.telegram.sendMessage(tgId, ctx.i18n.t('not_authorized'))];
            case 1:
                _a.sent();
                return [3 /*break*/, 4];
            case 2: return [4 /*yield*/, ctx.reply(ctx.i18n.t('not_authorized'))];
            case 3:
                _a.sent();
                _a.label = 4;
            case 4: return [3 /*break*/, 6];
            case 5:
                error_110 = _a.sent();
                logger.error(error_110);
                return [3 /*break*/, 6];
            case 6: return [2 /*return*/];
        }
    });
}); };
var mustBeANumber = function (ctx) { return __awaiter(void 0, void 0, void 0, function () {
    var error_111;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                return [4 /*yield*/, ctx.reply(ctx.i18n.t('not_number'))];
            case 1:
                _a.sent();
                return [3 /*break*/, 3];
            case 2:
                error_111 = _a.sent();
                logger.error(error_111);
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); };
var showConfirmationButtons = function (ctx, orders, commandString) { return __awaiter(void 0, void 0, void 0, function () {
    var inlineKeyboard, lastTwo, lineBtn, message, error_112;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                commandString = commandString.slice(1);
                inlineKeyboard = [];
                while (orders.length > 0) {
                    lastTwo = orders.splice(-2);
                    lineBtn = lastTwo
                        .map(function (ord) {
                        return {
                            _id: ord._id.toString(),
                            fiat: ord.fiat_code,
                            amount: ord.fiat_amount || '-',
                            type: ord.type,
                        };
                    })
                        .map(function (ord) { return ({
                        text: "".concat(ord._id.slice(0, 2), "..").concat(ord._id.slice(-2), " - ").concat(ord.type, " - ").concat(ord.fiat, " ").concat(ord.amount),
                        callback_data: "".concat(commandString, "_").concat(ord._id),
                    }); });
                    inlineKeyboard.push(lineBtn);
                }
                message = commandString === 'release'
                    ? ctx.i18n.t('tap_release')
                    : ctx.i18n.t('tap_button');
                return [4 /*yield*/, ctx.reply(message, {
                        reply_markup: { inline_keyboard: inlineKeyboard },
                    })];
            case 1:
                _a.sent();
                return [3 /*break*/, 3];
            case 2:
                error_112 = _a.sent();
                logger.error(error_112);
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); };
module.exports = {
    startMessage: startMessage,
    initBotErrorMessage: initBotErrorMessage,
    invoicePaymentRequestMessage: invoicePaymentRequestMessage,
    sellOrderCorrectFormatMessage: sellOrderCorrectFormatMessage,
    buyOrderCorrectFormatMessage: buyOrderCorrectFormatMessage,
    minimunAmountInvoiceMessage: minimunAmountInvoiceMessage,
    minimunExpirationTimeInvoiceMessage: minimunExpirationTimeInvoiceMessage,
    expiredInvoiceMessage: expiredInvoiceMessage,
    requiredAddressInvoiceMessage: requiredAddressInvoiceMessage,
    invoiceMustBeLargerMessage: invoiceMustBeLargerMessage,
    invoiceExpiryTooShortMessage: invoiceExpiryTooShortMessage,
    invoiceHasExpiredMessage: invoiceHasExpiredMessage,
    invoiceHasWrongDestinationMessage: invoiceHasWrongDestinationMessage,
    invoiceInvalidMessage: invoiceInvalidMessage,
    requiredHashInvoiceMessage: requiredHashInvoiceMessage,
    publishBuyOrderMessage: publishBuyOrderMessage,
    invalidOrderMessage: invalidOrderMessage,
    invalidTypeOrderMessage: invalidTypeOrderMessage,
    alreadyTakenOrderMessage: alreadyTakenOrderMessage,
    onGoingTakeSellMessage: onGoingTakeSellMessage,
    invalidDataMessage: invalidDataMessage,
    beginTakeBuyMessage: beginTakeBuyMessage,
    notActiveOrderMessage: notActiveOrderMessage,
    publishSellOrderMessage: publishSellOrderMessage,
    onGoingTakeBuyMessage: onGoingTakeBuyMessage,
    pendingSellMessage: pendingSellMessage,
    pendingBuyMessage: pendingBuyMessage,
    notOrderMessage: notOrderMessage,
    customMessage: customMessage,
    checkOrderMessage: checkOrderMessage,
    mustBeValidCurrency: mustBeValidCurrency,
    mustBeANumberOrRange: mustBeANumberOrRange,
    invalidLightningAddress: invalidLightningAddress,
    helpMessage: helpMessage,
    disclaimerMessage: disclaimerMessage,
    mustBeGreatherEqThan: mustBeGreatherEqThan,
    bannedUserErrorMessage: bannedUserErrorMessage,
    fiatSentMessages: fiatSentMessages,
    orderOnfiatSentStatusMessages: orderOnfiatSentStatusMessages,
    takeSellWaitingSellerToPayMessage: takeSellWaitingSellerToPayMessage,
    userBannedMessage: userBannedMessage,
    userUnBannedMessage: userUnBannedMessage,
    notFoundUserMessage: notFoundUserMessage,
    errorParsingInvoiceMessage: errorParsingInvoiceMessage,
    notValidIdMessage: notValidIdMessage,
    addInvoiceMessage: addInvoiceMessage,
    cantTakeOwnOrderMessage: cantTakeOwnOrderMessage,
    notLightningInvoiceMessage: notLightningInvoiceMessage,
    notOrdersMessage: notOrdersMessage,
    notRateForCurrency: notRateForCurrency,
    incorrectAmountInvoiceMessage: incorrectAmountInvoiceMessage,
    beginTakeSellMessage: beginTakeSellMessage,
    invoiceUpdatedMessage: invoiceUpdatedMessage,
    counterPartyWantsCooperativeCancelMessage: counterPartyWantsCooperativeCancelMessage,
    initCooperativeCancelMessage: initCooperativeCancelMessage,
    okCooperativeCancelMessage: okCooperativeCancelMessage,
    shouldWaitCooperativeCancelMessage: shouldWaitCooperativeCancelMessage,
    successCompleteOrderByAdminMessage: successCompleteOrderByAdminMessage,
    successCompleteOrderMessage: successCompleteOrderMessage,
    successCancelOrderByAdminMessage: successCancelOrderByAdminMessage,
    successCancelOrderMessage: successCancelOrderMessage,
    badStatusOnCancelOrderMessage: badStatusOnCancelOrderMessage,
    orderIsAlreadyCanceledMessage: orderIsAlreadyCanceledMessage,
    invoicePaymentFailedMessage: invoicePaymentFailedMessage,
    userCantTakeMoreThanOneWaitingOrderMessage: userCantTakeMoreThanOneWaitingOrderMessage,
    buyerReceivedSatsMessage: buyerReceivedSatsMessage,
    releasedSatsMessage: releasedSatsMessage,
    rateUserMessage: rateUserMessage,
    listCurrenciesResponse: listCurrenciesResponse,
    priceApiFailedMessage: priceApiFailedMessage,
    showHoldInvoiceMessage: showHoldInvoiceMessage,
    waitingForBuyerOrderMessage: waitingForBuyerOrderMessage,
    invoiceUpdatedPaymentWillBeSendMessage: invoiceUpdatedPaymentWillBeSendMessage,
    invoiceAlreadyUpdatedMessage: invoiceAlreadyUpdatedMessage,
    successSetAddress: successSetAddress,
    sellerPaidHoldMessage: sellerPaidHoldMessage,
    showInfoMessage: showInfoMessage,
    sendBuyerInfo2SellerMessage: sendBuyerInfo2SellerMessage,
    updateUserSettingsMessage: updateUserSettingsMessage,
    expiredInvoiceOnPendingMessage: expiredInvoiceOnPendingMessage,
    successCancelAllOrdersMessage: successCancelAllOrdersMessage,
    disableLightningAddress: disableLightningAddress,
    invalidRangeWithAmount: invalidRangeWithAmount,
    tooManyPendingOrdersMessage: tooManyPendingOrdersMessage,
    wizardAddInvoiceInitMessage: wizardAddInvoiceInitMessage,
    wizardAddInvoiceExitMessage: wizardAddInvoiceExitMessage,
    orderExpiredMessage: orderExpiredMessage,
    cantAddInvoiceMessage: cantAddInvoiceMessage,
    wizardExitMessage: wizardExitMessage,
    wizardAddFiatAmountMessage: wizardAddFiatAmountMessage,
    wizardAddFiatAmountWrongAmountMessage: wizardAddFiatAmountWrongAmountMessage,
    wizardAddFiatAmountCorrectMessage: wizardAddFiatAmountCorrectMessage,
    expiredOrderMessage: expiredOrderMessage,
    toBuyerDidntAddInvoiceMessage: toBuyerDidntAddInvoiceMessage,
    toSellerBuyerDidntAddInvoiceMessage: toSellerBuyerDidntAddInvoiceMessage,
    toAdminChannelBuyerDidntAddInvoiceMessage: toAdminChannelBuyerDidntAddInvoiceMessage,
    toSellerDidntPayInvoiceMessage: toSellerDidntPayInvoiceMessage,
    toBuyerSellerDidntPayInvoiceMessage: toBuyerSellerDidntPayInvoiceMessage,
    toAdminChannelSellerDidntPayInvoiceMessage: toAdminChannelSellerDidntPayInvoiceMessage,
    toAdminChannelPendingPaymentSuccessMessage: toAdminChannelPendingPaymentSuccessMessage,
    toBuyerPendingPaymentSuccessMessage: toBuyerPendingPaymentSuccessMessage,
    toBuyerPendingPaymentFailedMessage: toBuyerPendingPaymentFailedMessage,
    toAdminChannelPendingPaymentFailedMessage: toAdminChannelPendingPaymentFailedMessage,
    genericErrorMessage: genericErrorMessage,
    refundCooperativeCancelMessage: refundCooperativeCancelMessage,
    toBuyerExpiredOrderMessage: toBuyerExpiredOrderMessage,
    toSellerExpiredOrderMessage: toSellerExpiredOrderMessage,
    currencyNotSupportedMessage: currencyNotSupportedMessage,
    sendMeAnInvoiceMessage: sendMeAnInvoiceMessage,
    notAuthorized: notAuthorized,
    mustBeANumber: mustBeANumber,
    showConfirmationButtons: showConfirmationButtons,
    counterPartyCancelOrderMessage: counterPartyCancelOrderMessage,
    checkInvoiceMessage: checkInvoiceMessage,
};
