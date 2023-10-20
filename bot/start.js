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
exports.start = exports.initialize = void 0;
var telegraf_1 = require("telegraf");
var i18n_1 = require("@grammyjs/i18n");
var limit = require('@grammyjs/ratelimiter').limit;
var schedule = require('node-schedule');
var _a = require('../models'), Order = _a.Order, User = _a.User, PendingPayment = _a.PendingPayment, Community = _a.Community, Dispute = _a.Dispute, Config = _a.Config;
var _b = require('../util'), getCurrenciesWithPrice = _b.getCurrenciesWithPrice, deleteOrderFromChannel = _b.deleteOrderFromChannel;
var _c = require('./middleware'), commandArgsMiddleware = _c.commandArgsMiddleware, stageMiddleware = _c.stageMiddleware, userMiddleware = _c.userMiddleware, adminMiddleware = _c.adminMiddleware, superAdminMiddleware = _c.superAdminMiddleware;
var ordersActions = require('./ordersActions');
var CommunityModule = require('./modules/community');
var LanguageModule = require('./modules/language');
var NostrModule = require('./modules/nostr');
var OrdersModule = require('./modules/orders');
var UserModule = require('./modules/user');
var DisputeModule = require('./modules/dispute');
var _d = require('./commands'), rateUser = _d.rateUser, cancelAddInvoice = _d.cancelAddInvoice, addInvoice = _d.addInvoice, cancelShowHoldInvoice = _d.cancelShowHoldInvoice, showHoldInvoice = _d.showHoldInvoice, waitPayment = _d.waitPayment, addInvoicePHI = _d.addInvoicePHI, cancelOrder = _d.cancelOrder, fiatSent = _d.fiatSent, release = _d.release;
var _e = require('../ln'), settleHoldInvoice = _e.settleHoldInvoice, cancelHoldInvoice = _e.cancelHoldInvoice, payToBuyer = _e.payToBuyer, isPendingPayment = _e.isPendingPayment, subscribeInvoice = _e.subscribeInvoice, getInvoice = _e.getInvoice;
var _f = require('./validations'), validateUser = _f.validateUser, validateParams = _f.validateParams, validateObjectId = _f.validateObjectId, validateInvoice = _f.validateInvoice, validateLightningAddress = _f.validateLightningAddress;
var messages = require('./messages');
var _g = require('../jobs'), attemptPendingPayments = _g.attemptPendingPayments, cancelOrders = _g.cancelOrders, deleteOrders = _g.deleteOrders, calculateEarnings = _g.calculateEarnings, attemptCommunitiesPendingPayments = _g.attemptCommunitiesPendingPayments, deleteCommunity = _g.deleteCommunity, nodeInfo = _g.nodeInfo;
var logger = require('../logger');
var askForConfirmation = function (user, command) { return __awaiter(void 0, void 0, void 0, function () {
    var where, orders, where, orders, where, orders, error_1;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 7, , 8]);
                if (!(command === '/cancel')) return [3 /*break*/, 2];
                where = {
                    $and: [
                        { $or: [{ buyer_id: user._id }, { seller_id: user._id }] },
                        {
                            $or: [
                                { status: 'ACTIVE' },
                                { status: 'PENDING' },
                                { status: 'FIAT_SENT' },
                                { status: 'DISPUTE' },
                            ],
                        },
                    ]
                };
                return [4 /*yield*/, Order.find(where)];
            case 1:
                orders = _a.sent();
                return [2 /*return*/, orders];
            case 2:
                if (!(command === '/fiatsent')) return [3 /*break*/, 4];
                where = {
                    $and: [{ buyer_id: user._id }, { status: 'ACTIVE' }]
                };
                return [4 /*yield*/, Order.find(where)];
            case 3:
                orders = _a.sent();
                return [2 /*return*/, orders];
            case 4:
                if (!(command === '/release')) return [3 /*break*/, 6];
                where = {
                    $and: [
                        { seller_id: user._id },
                        {
                            $or: [
                                { status: 'ACTIVE' },
                                { status: 'FIAT_SENT' },
                                { status: 'DISPUTE' },
                            ],
                        },
                    ]
                };
                return [4 /*yield*/, Order.find(where)];
            case 5:
                orders = _a.sent();
                return [2 /*return*/, orders];
            case 6: return [2 /*return*/, []];
            case 7:
                error_1 = _a.sent();
                logger.error(error_1);
                return [3 /*break*/, 8];
            case 8: return [2 /*return*/];
        }
    });
}); };
/*
ctx.update doesn't initially contain message field and it might be
added to the ctx.update in specific conditions. Therefore we need
to check the existence of message in ctx.update. ctx.update.message.text
has the same condition.

The problem mentioned above is similar to this issue:
https://github.com/telegraf/telegraf/issues/1319#issuecomment-766360594
*/
var ctxUpdateAssertMsg = "ctx.update.message.text is not available.";
var initialize = function (botToken, options) {
    var i18n = new i18n_1.I18n({
        defaultLanguageOnMissing: true,
        directory: 'locales',
        useSession: true,
    });
    var bot = new telegraf_1.Telegraf(botToken, options);
    bot.catch(function (err) {
        logger.error(err);
    });
    bot.use((0, telegraf_1.session)());
    bot.use(limit());
    bot.use(i18n.middleware());
    bot.use(stageMiddleware());
    bot.use(commandArgsMiddleware());
    // We schedule pending payments job
    schedule.scheduleJob("*/".concat(process.env.PENDING_PAYMENT_WINDOW, " * * * *"), function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, attemptPendingPayments(bot)];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    schedule.scheduleJob("20,50 * * * * *", function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, cancelOrders(bot)];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    schedule.scheduleJob("25 * * * *", function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, deleteOrders(bot)];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    schedule.scheduleJob("*/10 * * * *", function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, calculateEarnings()];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    schedule.scheduleJob("*/5 * * * *", function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, attemptCommunitiesPendingPayments(bot)];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    schedule.scheduleJob("33 0 * * *", function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, deleteCommunity(bot)];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    schedule.scheduleJob("* * * * *", function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, nodeInfo(bot)];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    bot.start(function (ctx) { return __awaiter(void 0, void 0, void 0, function () {
        var tgUser, error_2;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 4, , 5]);
                    if (!('message' in ctx.update) || !('text' in ctx.update.message)) {
                        throw new Error(ctxUpdateAssertMsg);
                    }
                    tgUser = ctx.update.message.from;
                    if (!!tgUser.username) return [3 /*break*/, 2];
                    return [4 /*yield*/, messages.nonHandleErrorMessage(ctx)];
                case 1: return [2 /*return*/, _a.sent()];
                case 2:
                    messages.startMessage(ctx);
                    return [4 /*yield*/, validateUser(ctx, true)];
                case 3:
                    _a.sent();
                    return [3 /*break*/, 5];
                case 4:
                    error_2 = _a.sent();
                    logger.error(error_2);
                    return [3 /*break*/, 5];
                case 5: return [2 /*return*/];
            }
        });
    }); });
    bot.command('maintenance', superAdminMiddleware, function (ctx) { return __awaiter(void 0, void 0, void 0, function () {
        var val, config, error_3;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 5, , 6]);
                    return [4 /*yield*/, validateParams(ctx, 2, '\\<_on/off_\\>')];
                case 1:
                    val = (_a.sent())[0];
                    if (!val)
                        return [2 /*return*/];
                    return [4 /*yield*/, Config.findOne()];
                case 2:
                    config = _a.sent();
                    if (!config) {
                        config = new Config();
                    }
                    config.maintenance = false;
                    if (val == 'on') {
                        config.maintenance = true;
                    }
                    return [4 /*yield*/, config.save()];
                case 3:
                    _a.sent();
                    return [4 /*yield*/, ctx.reply(ctx.i18n.t('operation_successful'))];
                case 4:
                    _a.sent();
                    return [3 /*break*/, 6];
                case 5:
                    error_3 = _a.sent();
                    logger.error(error_3);
                    return [3 /*break*/, 6];
                case 6: return [2 /*return*/];
            }
        });
    }); });
    bot.on('text', userMiddleware, function (ctx, next) { return __awaiter(void 0, void 0, void 0, function () {
        var config, error_4;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 5, , 6]);
                    return [4 /*yield*/, Config.findOne({ maintenance: true })];
                case 1:
                    config = _a.sent();
                    if (!config) return [3 /*break*/, 3];
                    return [4 /*yield*/, ctx.reply(ctx.i18n.t('maintenance'))];
                case 2:
                    _a.sent();
                    return [3 /*break*/, 4];
                case 3:
                    next();
                    _a.label = 4;
                case 4: return [3 /*break*/, 6];
                case 5:
                    error_4 = _a.sent();
                    logger.error(error_4);
                    return [3 /*break*/, 6];
                case 6: return [2 /*return*/];
            }
        });
    }); });
    bot.command('version', function (ctx) { return __awaiter(void 0, void 0, void 0, function () {
        var pckg, err_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    pckg = require('../package.json');
                    return [4 /*yield*/, ctx.reply(pckg.version)];
                case 1:
                    _a.sent();
                    return [3 /*break*/, 3];
                case 2:
                    err_1 = _a.sent();
                    logger.error(err_1);
                    return [3 /*break*/, 3];
                case 3: return [2 /*return*/];
            }
        });
    }); });
    UserModule.configure(bot);
    NostrModule.configure(bot);
    CommunityModule.configure(bot);
    LanguageModule.configure(bot);
    bot.command('release', userMiddleware, function (ctx) { return __awaiter(void 0, void 0, void 0, function () {
        var params, _a, command, orderId, orders, error_5;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _b.trys.push([0, 10, , 11]);
                    if (!('message' in ctx.update) || !('text' in ctx.update.message)) {
                        throw new Error(ctxUpdateAssertMsg);
                    }
                    params = ctx.update.message.text.split(' ');
                    _a = params.filter(function (el) { return el; }), command = _a[0], orderId = _a[1];
                    if (!!orderId) return [3 /*break*/, 5];
                    return [4 /*yield*/, askForConfirmation(ctx.user, command)];
                case 1:
                    orders = _b.sent();
                    if (!!orders.length) return [3 /*break*/, 3];
                    return [4 /*yield*/, ctx.reply("".concat(command, " <order Id>"))];
                case 2: return [2 /*return*/, _b.sent()];
                case 3: return [4 /*yield*/, messages.showConfirmationButtons(ctx, orders, command)];
                case 4: return [2 /*return*/, _b.sent()];
                case 5: return [4 /*yield*/, validateObjectId(ctx, orderId)];
                case 6:
                    if (!!(_b.sent())) return [3 /*break*/, 7];
                    return [2 /*return*/];
                case 7: return [4 /*yield*/, release(ctx, orderId, ctx.user)];
                case 8:
                    _b.sent();
                    _b.label = 9;
                case 9: return [3 /*break*/, 11];
                case 10:
                    error_5 = _b.sent();
                    logger.error(error_5);
                    return [3 /*break*/, 11];
                case 11: return [2 /*return*/];
            }
        });
    }); });
    DisputeModule.configure(bot);
    bot.command('cancelorder', adminMiddleware, function (ctx) { return __awaiter(void 0, void 0, void 0, function () {
        var orderId, order, dispute, buyer, seller, error_6;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 21, , 22]);
                    return [4 /*yield*/, validateParams(ctx, 2, '\\<_order id_\\>')];
                case 1:
                    orderId = (_a.sent())[0];
                    if (!orderId)
                        return [2 /*return*/];
                    return [4 /*yield*/, validateObjectId(ctx, orderId)];
                case 2:
                    if (!(_a.sent()))
                        return [2 /*return*/];
                    return [4 /*yield*/, Order.findOne({ _id: orderId })];
                case 3:
                    order = _a.sent();
                    if (!order)
                        return [2 /*return*/];
                    return [4 /*yield*/, Dispute.findOne({ order_id: order._id })];
                case 4:
                    dispute = _a.sent();
                    if (!!ctx.admin.admin) return [3 /*break*/, 10];
                    if (!!order.community_id) return [3 /*break*/, 6];
                    logger.debug("cancelorder ".concat(order._id, ": The order is not in a community"));
                    return [4 /*yield*/, messages.notAuthorized(ctx)];
                case 5: return [2 /*return*/, _a.sent()];
                case 6:
                    if (!(order.community_id != ctx.admin.default_community_id)) return [3 /*break*/, 8];
                    logger.debug("cancelorder ".concat(order._id, ": The community and the default user community are not the same"));
                    return [4 /*yield*/, messages.notAuthorized(ctx)];
                case 7: return [2 /*return*/, _a.sent()];
                case 8:
                    if (!(dispute && dispute.solver_id != ctx.admin._id)) return [3 /*break*/, 10];
                    logger.debug("cancelorder ".concat(order._id, ": @").concat(ctx.admin.username, " is not the solver of this dispute"));
                    return [4 /*yield*/, messages.notAuthorized(ctx)];
                case 9: return [2 /*return*/, _a.sent()];
                case 10:
                    if (!order.hash) return [3 /*break*/, 12];
                    return [4 /*yield*/, cancelHoldInvoice({ hash: order.hash })];
                case 11:
                    _a.sent();
                    _a.label = 12;
                case 12:
                    if (!dispute) return [3 /*break*/, 14];
                    dispute.status = 'SELLER_REFUNDED';
                    return [4 /*yield*/, dispute.save()];
                case 13:
                    _a.sent();
                    _a.label = 14;
                case 14:
                    logger.info("order ".concat(order._id, ": cancelled by admin"));
                    order.status = 'CANCELED_BY_ADMIN';
                    order.canceled_by = ctx.admin._id;
                    return [4 /*yield*/, User.findOne({ _id: order.buyer_id })];
                case 15:
                    buyer = _a.sent();
                    return [4 /*yield*/, User.findOne({ _id: order.seller_id })];
                case 16:
                    seller = _a.sent();
                    return [4 /*yield*/, order.save()];
                case 17:
                    _a.sent();
                    // we sent a private message to the admin
                    return [4 /*yield*/, messages.successCancelOrderMessage(ctx, ctx.admin, order, ctx.i18n)];
                case 18:
                    // we sent a private message to the admin
                    _a.sent();
                    // we sent a private message to the seller
                    return [4 /*yield*/, messages.successCancelOrderByAdminMessage(ctx, bot, seller, order)];
                case 19:
                    // we sent a private message to the seller
                    _a.sent();
                    // we sent a private message to the buyer
                    return [4 /*yield*/, messages.successCancelOrderByAdminMessage(ctx, bot, buyer, order)];
                case 20:
                    // we sent a private message to the buyer
                    _a.sent();
                    return [3 /*break*/, 22];
                case 21:
                    error_6 = _a.sent();
                    logger.error(error_6);
                    return [3 /*break*/, 22];
                case 22: return [2 /*return*/];
            }
        });
    }); });
    // We allow users cancel pending orders,
    // pending orders are the ones that are not taken by another user
    bot.command('cancel', userMiddleware, function (ctx) { return __awaiter(void 0, void 0, void 0, function () {
        var params, _a, command, orderId, orders, error_7;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _b.trys.push([0, 10, , 11]);
                    if (!('message' in ctx.update) || !('text' in ctx.update.message)) {
                        throw new Error(ctxUpdateAssertMsg);
                    }
                    params = ctx.update.message.text.split(' ');
                    _a = params.filter(function (el) { return el; }), command = _a[0], orderId = _a[1];
                    if (!!orderId) return [3 /*break*/, 5];
                    return [4 /*yield*/, askForConfirmation(ctx.user, command)];
                case 1:
                    orders = _b.sent();
                    if (!!orders.length) return [3 /*break*/, 3];
                    return [4 /*yield*/, ctx.reply("".concat(command, "  <order Id>"))];
                case 2: return [2 /*return*/, _b.sent()];
                case 3: return [4 /*yield*/, messages.showConfirmationButtons(ctx, orders, command)];
                case 4: return [2 /*return*/, _b.sent()];
                case 5: return [4 /*yield*/, validateObjectId(ctx, orderId)];
                case 6:
                    if (!!(_b.sent())) return [3 /*break*/, 7];
                    return [2 /*return*/];
                case 7: return [4 /*yield*/, cancelOrder(ctx, orderId, ctx.user)];
                case 8:
                    _b.sent();
                    _b.label = 9;
                case 9: return [3 /*break*/, 11];
                case 10:
                    error_7 = _b.sent();
                    logger.error(error_7);
                    return [3 /*break*/, 11];
                case 11: return [2 /*return*/];
            }
        });
    }); });
    // We allow users cancel all pending orders,
    // pending orders are the ones that are not taken by another user
    bot.command('cancelall', userMiddleware, function (ctx) { return __awaiter(void 0, void 0, void 0, function () {
        var orders, _i, orders_1, order, error_8;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 8, , 9]);
                    return [4 /*yield*/, ordersActions.getOrders(ctx, ctx.user, 'PENDING')];
                case 1:
                    orders = _a.sent();
                    if (!orders)
                        return [2 /*return*/];
                    _i = 0, orders_1 = orders;
                    _a.label = 2;
                case 2:
                    if (!(_i < orders_1.length)) return [3 /*break*/, 6];
                    order = orders_1[_i];
                    order.status = 'CANCELED';
                    order.canceled_by = ctx.user.id;
                    return [4 /*yield*/, order.save()];
                case 3:
                    _a.sent();
                    // We delete the messages related to that order from the channel
                    return [4 /*yield*/, deleteOrderFromChannel(order, bot.telegram)];
                case 4:
                    // We delete the messages related to that order from the channel
                    _a.sent();
                    _a.label = 5;
                case 5:
                    _i++;
                    return [3 /*break*/, 2];
                case 6: 
                // we sent a private message to the user
                return [4 /*yield*/, messages.successCancelAllOrdersMessage(ctx)];
                case 7:
                    // we sent a private message to the user
                    _a.sent();
                    return [3 /*break*/, 9];
                case 8:
                    error_8 = _a.sent();
                    logger.error(error_8);
                    return [3 /*break*/, 9];
                case 9: return [2 /*return*/];
            }
        });
    }); });
    bot.command('settleorder', adminMiddleware, function (ctx) { return __awaiter(void 0, void 0, void 0, function () {
        var orderId, order, dispute, buyer, seller, error_9;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 21, , 22]);
                    return [4 /*yield*/, validateParams(ctx, 2, '\\<_order id_\\>')];
                case 1:
                    orderId = (_a.sent())[0];
                    if (!orderId)
                        return [2 /*return*/];
                    return [4 /*yield*/, validateObjectId(ctx, orderId)];
                case 2:
                    if (!(_a.sent()))
                        return [2 /*return*/];
                    return [4 /*yield*/, Order.findOne({ _id: orderId })];
                case 3:
                    order = _a.sent();
                    if (!order)
                        return [2 /*return*/];
                    return [4 /*yield*/, Dispute.findOne({ order_id: order._id })];
                case 4:
                    dispute = _a.sent();
                    if (!!ctx.admin.admin) return [3 /*break*/, 10];
                    if (!!order.community_id) return [3 /*break*/, 6];
                    return [4 /*yield*/, messages.notAuthorized(ctx)];
                case 5: return [2 /*return*/, _a.sent()];
                case 6:
                    if (!(order.community_id != ctx.admin.default_community_id)) return [3 /*break*/, 8];
                    return [4 /*yield*/, messages.notAuthorized(ctx)];
                case 7: return [2 /*return*/, _a.sent()];
                case 8:
                    if (!(dispute && dispute.solver_id != ctx.admin.id)) return [3 /*break*/, 10];
                    return [4 /*yield*/, messages.notAuthorized(ctx)];
                case 9: return [2 /*return*/, _a.sent()];
                case 10:
                    if (!order.secret) return [3 /*break*/, 12];
                    return [4 /*yield*/, settleHoldInvoice({ secret: order.secret })];
                case 11:
                    _a.sent();
                    _a.label = 12;
                case 12:
                    if (!dispute) return [3 /*break*/, 14];
                    dispute.status = 'SETTLED';
                    return [4 /*yield*/, dispute.save()];
                case 13:
                    _a.sent();
                    _a.label = 14;
                case 14:
                    order.status = 'COMPLETED_BY_ADMIN';
                    return [4 /*yield*/, User.findOne({ _id: order.buyer_id })];
                case 15:
                    buyer = _a.sent();
                    return [4 /*yield*/, User.findOne({ _id: order.seller_id })];
                case 16:
                    seller = _a.sent();
                    return [4 /*yield*/, order.save()];
                case 17:
                    _a.sent();
                    // we sent a private message to the admin
                    return [4 /*yield*/, messages.successCompleteOrderMessage(ctx, order)];
                case 18:
                    // we sent a private message to the admin
                    _a.sent();
                    // we sent a private message to the seller
                    return [4 /*yield*/, messages.successCompleteOrderByAdminMessage(ctx, bot, seller, order)];
                case 19:
                    // we sent a private message to the seller
                    _a.sent();
                    // we sent a private message to the buyer
                    return [4 /*yield*/, messages.successCompleteOrderByAdminMessage(ctx, bot, buyer, order)];
                case 20:
                    // we sent a private message to the buyer
                    _a.sent();
                    return [3 /*break*/, 22];
                case 21:
                    error_9 = _a.sent();
                    logger.error(error_9);
                    return [3 /*break*/, 22];
                case 22: return [2 /*return*/];
            }
        });
    }); });
    bot.command('checkorder', superAdminMiddleware, function (ctx) { return __awaiter(void 0, void 0, void 0, function () {
        var orderId, order, buyer, seller, error_10;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 7, , 8]);
                    return [4 /*yield*/, validateParams(ctx, 2, '\\<_order id_\\>')];
                case 1:
                    orderId = (_a.sent())[0];
                    if (!orderId)
                        return [2 /*return*/];
                    return [4 /*yield*/, validateObjectId(ctx, orderId)];
                case 2:
                    if (!(_a.sent()))
                        return [2 /*return*/];
                    return [4 /*yield*/, Order.findOne({ _id: orderId })];
                case 3:
                    order = _a.sent();
                    if (!order)
                        return [2 /*return*/];
                    return [4 /*yield*/, User.findOne({ _id: order.buyer_id })];
                case 4:
                    buyer = _a.sent();
                    return [4 /*yield*/, User.findOne({ _id: order.seller_id })];
                case 5:
                    seller = _a.sent();
                    return [4 /*yield*/, messages.checkOrderMessage(ctx, order, buyer, seller)];
                case 6:
                    _a.sent();
                    return [3 /*break*/, 8];
                case 7:
                    error_10 = _a.sent();
                    logger.error(error_10);
                    return [3 /*break*/, 8];
                case 8: return [2 /*return*/];
            }
        });
    }); });
    bot.command('checkinvoice', superAdminMiddleware, function (ctx) { return __awaiter(void 0, void 0, void 0, function () {
        var orderId, order, invoice, error_11;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 6, , 7]);
                    return [4 /*yield*/, validateParams(ctx, 2, '\\<_order id_\\>')];
                case 1:
                    orderId = (_a.sent())[0];
                    if (!orderId)
                        return [2 /*return*/];
                    return [4 /*yield*/, validateObjectId(ctx, orderId)];
                case 2:
                    if (!(_a.sent()))
                        return [2 /*return*/];
                    return [4 /*yield*/, Order.findOne({ _id: orderId })];
                case 3:
                    order = _a.sent();
                    if (!order)
                        return [2 /*return*/];
                    if (!order.hash)
                        return [2 /*return*/];
                    return [4 /*yield*/, getInvoice({ hash: order.hash })];
                case 4:
                    invoice = _a.sent();
                    return [4 /*yield*/, messages.checkInvoiceMessage(ctx, invoice.is_confirmed, invoice.is_canceled, invoice.is_held)];
                case 5:
                    _a.sent();
                    return [3 /*break*/, 7];
                case 6:
                    error_11 = _a.sent();
                    logger.error(error_11);
                    return [3 /*break*/, 7];
                case 7: return [2 /*return*/];
            }
        });
    }); });
    bot.command('resubscribe', superAdminMiddleware, function (ctx) { return __awaiter(void 0, void 0, void 0, function () {
        var hash, order, error_12;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 4, , 5]);
                    return [4 /*yield*/, validateParams(ctx, 2, '\\<_hash_\\>')];
                case 1:
                    hash = (_a.sent())[0];
                    if (!hash)
                        return [2 /*return*/];
                    return [4 /*yield*/, Order.findOne({ hash: hash })];
                case 2:
                    order = _a.sent();
                    if (!order)
                        return [2 /*return*/];
                    return [4 /*yield*/, subscribeInvoice(bot, hash, true)];
                case 3:
                    _a.sent();
                    ctx.reply("hash resubscribed");
                    return [3 /*break*/, 5];
                case 4:
                    error_12 = _a.sent();
                    logger.error("/resubscribe command error: ".concat(error_12.toString()));
                    return [3 /*break*/, 5];
                case 5: return [2 /*return*/];
            }
        });
    }); });
    bot.command('help', userMiddleware, function (ctx) { return __awaiter(void 0, void 0, void 0, function () {
        var error_13;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, messages.helpMessage(ctx)];
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
    }); });
    bot.command('disclaimer', userMiddleware, function (ctx) { return __awaiter(void 0, void 0, void 0, function () {
        var error_14;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, messages.disclaimerMessage(ctx)];
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
    }); });
    // Only buyers can use this command
    bot.command('fiatsent', userMiddleware, function (ctx) { return __awaiter(void 0, void 0, void 0, function () {
        var params, _a, command, orderId, orders, error_15;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _b.trys.push([0, 10, , 11]);
                    if (!('message' in ctx.update) || !('text' in ctx.update.message)) {
                        throw new Error(ctxUpdateAssertMsg);
                    }
                    params = ctx.update.message.text.split(' ');
                    _a = params.filter(function (el) { return el; }), command = _a[0], orderId = _a[1];
                    if (!!orderId) return [3 /*break*/, 5];
                    return [4 /*yield*/, askForConfirmation(ctx.user, command)];
                case 1:
                    orders = _b.sent();
                    if (!!orders.length) return [3 /*break*/, 3];
                    return [4 /*yield*/, ctx.reply("".concat(command, " <order Id>"))];
                case 2: return [2 /*return*/, _b.sent()];
                case 3: return [4 /*yield*/, messages.showConfirmationButtons(ctx, orders, command)];
                case 4: return [2 /*return*/, _b.sent()];
                case 5: return [4 /*yield*/, validateObjectId(ctx, orderId)];
                case 6:
                    if (!!(_b.sent())) return [3 /*break*/, 7];
                    return [2 /*return*/];
                case 7: return [4 /*yield*/, fiatSent(ctx, orderId, ctx.user)];
                case 8:
                    _b.sent();
                    _b.label = 9;
                case 9: return [3 /*break*/, 11];
                case 10:
                    error_15 = _b.sent();
                    logger.error(error_15);
                    return [3 /*break*/, 11];
                case 11: return [2 /*return*/];
            }
        });
    }); });
    bot.command('ban', adminMiddleware, function (ctx) { return __awaiter(void 0, void 0, void 0, function () {
        var username, user, community, error_16;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 14, , 15]);
                    return [4 /*yield*/, validateParams(ctx, 2, '\\<_username or telegram ID_\\>')];
                case 1:
                    username = (_a.sent())[0];
                    if (!username)
                        return [2 /*return*/];
                    username = username[0] == '@' ? username.slice(1) : username;
                    return [4 /*yield*/, User.findOne({
                            $or: [{ username: username }, { tg_id: username }],
                        })];
                case 2:
                    user = _a.sent();
                    if (!!user) return [3 /*break*/, 4];
                    return [4 /*yield*/, messages.notFoundUserMessage(ctx)];
                case 3:
                    _a.sent();
                    return [2 /*return*/];
                case 4:
                    if (!!ctx.admin.admin) return [3 /*break*/, 10];
                    if (!ctx.admin.default_community_id) return [3 /*break*/, 7];
                    return [4 /*yield*/, Community.findById(ctx.admin.default_community_id)];
                case 5:
                    community = _a.sent();
                    community.banned_users.push({
                        id: user._id,
                        username: user.username,
                    });
                    return [4 /*yield*/, community.save()];
                case 6:
                    _a.sent();
                    return [3 /*break*/, 9];
                case 7: return [4 /*yield*/, ctx.reply(ctx.i18n.t('need_default_community'))];
                case 8: return [2 /*return*/, _a.sent()];
                case 9: return [3 /*break*/, 12];
                case 10:
                    user.banned = true;
                    return [4 /*yield*/, user.save()];
                case 11:
                    _a.sent();
                    _a.label = 12;
                case 12: return [4 /*yield*/, messages.userBannedMessage(ctx)];
                case 13:
                    _a.sent();
                    return [3 /*break*/, 15];
                case 14:
                    error_16 = _a.sent();
                    logger.error(error_16);
                    return [3 /*break*/, 15];
                case 15: return [2 /*return*/];
            }
        });
    }); });
    bot.command('unban', adminMiddleware, function (ctx) { return __awaiter(void 0, void 0, void 0, function () {
        var username, user_1, community, error_17;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 14, , 15]);
                    return [4 /*yield*/, validateParams(ctx, 2, '\\<_username or telegram ID_\\>')];
                case 1:
                    username = (_a.sent())[0];
                    if (!username)
                        return [2 /*return*/];
                    username = username[0] == '@' ? username.slice(1) : username;
                    return [4 /*yield*/, User.findOne({
                            $or: [{ username: username }, { tg_id: username }],
                        })];
                case 2:
                    user_1 = _a.sent();
                    if (!!user_1) return [3 /*break*/, 4];
                    return [4 /*yield*/, messages.notFoundUserMessage(ctx)];
                case 3:
                    _a.sent();
                    return [2 /*return*/];
                case 4:
                    if (!!ctx.admin.admin) return [3 /*break*/, 10];
                    if (!ctx.admin.default_community_id) return [3 /*break*/, 7];
                    return [4 /*yield*/, Community.findById(ctx.admin.default_community_id)];
                case 5:
                    community = _a.sent();
                    community.banned_users = community.banned_users.filter(function (el) { return el.id !== user_1.id; });
                    return [4 /*yield*/, community.save()];
                case 6:
                    _a.sent();
                    return [3 /*break*/, 9];
                case 7: return [4 /*yield*/, ctx.reply(ctx.i18n.t('need_default_community'))];
                case 8: return [2 /*return*/, _a.sent()];
                case 9: return [3 /*break*/, 12];
                case 10:
                    user_1.banned = false;
                    return [4 /*yield*/, user_1.save()];
                case 11:
                    _a.sent();
                    _a.label = 12;
                case 12: return [4 /*yield*/, messages.userUnBannedMessage(ctx)];
                case 13:
                    _a.sent();
                    return [3 /*break*/, 15];
                case 14:
                    error_17 = _a.sent();
                    logger.error(error_17);
                    return [3 /*break*/, 15];
                case 15: return [2 /*return*/];
            }
        });
    }); });
    bot.command('setaddress', userMiddleware, function (ctx) { return __awaiter(void 0, void 0, void 0, function () {
        var lightningAddress, error_18;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 10, , 11]);
                    return [4 /*yield*/, validateParams(ctx, 2, '\\<_lightningAddress / off_\\>')];
                case 1:
                    lightningAddress = (_a.sent())[0];
                    if (!lightningAddress)
                        return [2 /*return*/];
                    if (!(lightningAddress === 'off')) return [3 /*break*/, 4];
                    ctx.user.lightning_address = null;
                    return [4 /*yield*/, ctx.user.save()];
                case 2:
                    _a.sent();
                    return [4 /*yield*/, messages.disableLightningAddress(ctx)];
                case 3: return [2 /*return*/, _a.sent()];
                case 4: return [4 /*yield*/, validateLightningAddress(lightningAddress)];
                case 5:
                    if (!!(_a.sent())) return [3 /*break*/, 7];
                    return [4 /*yield*/, messages.invalidLightningAddress(ctx)];
                case 6: return [2 /*return*/, _a.sent()];
                case 7:
                    ctx.user.lightning_address = lightningAddress;
                    return [4 /*yield*/, ctx.user.save()];
                case 8:
                    _a.sent();
                    return [4 /*yield*/, messages.successSetAddress(ctx)];
                case 9:
                    _a.sent();
                    return [3 /*break*/, 11];
                case 10:
                    error_18 = _a.sent();
                    logger.error(error_18);
                    return [3 /*break*/, 11];
                case 11: return [2 /*return*/];
            }
        });
    }); });
    // Only buyers can use this command
    bot.command('setinvoice', userMiddleware, function (ctx) { return __awaiter(void 0, void 0, void 0, function () {
        var _a, orderId, lnInvoice, invoice, order, isPendingOldPayment, isPending, isScheduled, pp, seller, error_19;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _b.trys.push([0, 30, , 31]);
                    return [4 /*yield*/, validateParams(ctx, 3, '\\<_order id_\\> \\<_lightning invoice_\\>')];
                case 1:
                    _a = _b.sent(), orderId = _a[0], lnInvoice = _a[1];
                    if (!orderId)
                        return [2 /*return*/];
                    return [4 /*yield*/, validateObjectId(ctx, orderId)];
                case 2:
                    if (!(_b.sent()))
                        return [2 /*return*/];
                    return [4 /*yield*/, validateInvoice(ctx, lnInvoice)];
                case 3:
                    invoice = _b.sent();
                    if (!invoice)
                        return [2 /*return*/];
                    return [4 /*yield*/, Order.findOne({
                            _id: orderId,
                            buyer_id: ctx.user.id,
                        })];
                case 4:
                    order = _b.sent();
                    if (!!order) return [3 /*break*/, 6];
                    return [4 /*yield*/, messages.notActiveOrderMessage(ctx)];
                case 5: return [2 /*return*/, _b.sent()];
                case 6: return [4 /*yield*/, isPendingPayment(order.buyer_invoice)];
                case 7:
                    isPendingOldPayment = _b.sent();
                    return [4 /*yield*/, isPendingPayment(lnInvoice)];
                case 8:
                    isPending = _b.sent();
                    if (!(isPending || isPendingOldPayment)) return [3 /*break*/, 10];
                    logger.info("Buyer Id: ".concat(order.buyer_id, " is trying to add a new invoice when have a pending payment on Order id: ").concat(order._id));
                    return [4 /*yield*/, messages.invoiceAlreadyUpdatedMessage(ctx)];
                case 9: return [2 /*return*/, _b.sent()];
                case 10:
                    if (!(order.status === 'SUCCESS')) return [3 /*break*/, 12];
                    return [4 /*yield*/, messages.successCompleteOrderMessage(ctx, order)];
                case 11: return [2 /*return*/, _b.sent()];
                case 12:
                    if (!(invoice.tokens && invoice.tokens !== order.amount)) return [3 /*break*/, 14];
                    return [4 /*yield*/, messages.incorrectAmountInvoiceMessage(ctx)];
                case 13: return [2 /*return*/, _b.sent()];
                case 14:
                    order.buyer_invoice = lnInvoice;
                    if (!(order.status === 'PAID_HOLD_INVOICE')) return [3 /*break*/, 23];
                    return [4 /*yield*/, PendingPayment.findOne({
                            order_id: order._id,
                            attempts: { $lt: process.env.PAYMENT_ATTEMPTS },
                            is_invoice_expired: false,
                        })];
                case 15:
                    isScheduled = _b.sent();
                    if (!isScheduled) return [3 /*break*/, 17];
                    return [4 /*yield*/, messages.invoiceAlreadyUpdatedMessage(ctx)];
                case 16: return [2 /*return*/, _b.sent()];
                case 17:
                    if (!!order.paid_hold_buyer_invoice_updated) return [3 /*break*/, 20];
                    order.paid_hold_buyer_invoice_updated = true;
                    pp = new PendingPayment({
                        amount: order.amount,
                        payment_request: lnInvoice,
                        user_id: ctx.user.id,
                        description: order.description,
                        hash: order.hash,
                        order_id: order._id,
                    });
                    return [4 /*yield*/, pp.save()];
                case 18:
                    _b.sent();
                    return [4 /*yield*/, messages.invoiceUpdatedPaymentWillBeSendMessage(ctx)];
                case 19:
                    _b.sent();
                    return [3 /*break*/, 22];
                case 20: return [4 /*yield*/, messages.invoiceAlreadyUpdatedMessage(ctx)];
                case 21:
                    _b.sent();
                    _b.label = 22;
                case 22: return [3 /*break*/, 28];
                case 23:
                    if (!(order.status === 'WAITING_BUYER_INVOICE')) return [3 /*break*/, 26];
                    return [4 /*yield*/, User.findOne({ _id: order.seller_id })];
                case 24:
                    seller = _b.sent();
                    return [4 /*yield*/, waitPayment(ctx, bot, ctx.user, seller, order, lnInvoice)];
                case 25:
                    _b.sent();
                    return [3 /*break*/, 28];
                case 26: return [4 /*yield*/, messages.invoiceUpdatedMessage(ctx)];
                case 27:
                    _b.sent();
                    _b.label = 28;
                case 28: return [4 /*yield*/, order.save()];
                case 29:
                    _b.sent();
                    return [3 /*break*/, 31];
                case 30:
                    error_19 = _b.sent();
                    logger.error(error_19);
                    return [3 /*break*/, 31];
                case 31: return [2 /*return*/];
            }
        });
    }); });
    OrdersModule.configure(bot);
    bot.action('addInvoiceBtn', userMiddleware, function (ctx) { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, addInvoice(ctx, bot)];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    bot.action('cancelAddInvoiceBtn', userMiddleware, function (ctx) { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, cancelAddInvoice(ctx)];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    bot.action('showHoldInvoiceBtn', userMiddleware, function (ctx) { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, showHoldInvoice(ctx, bot)];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    bot.action('cancelShowHoldInvoiceBtn', userMiddleware, function (ctx) { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, cancelShowHoldInvoice(ctx)];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    bot.action(/^showStarBtn\(([1-5]),(\w{24})\)$/, userMiddleware, function (ctx) { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (ctx.match === null) {
                        throw new Error("ctx.match should not be null");
                    }
                    return [4 /*yield*/, rateUser(ctx, bot, ctx.match[1], ctx.match[2])];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    bot.action(/^addInvoicePHIBtn_([0-9a-f]{24})$/, userMiddleware, function (ctx) { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (ctx.match === null) {
                        throw new Error("ctx.match should not be null");
                    }
                    return [4 /*yield*/, addInvoicePHI(ctx, bot, ctx.match[1])];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    bot.action(/^cancel_([0-9a-f]{24})$/, userMiddleware, function (ctx) { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (ctx.match === null) {
                        throw new Error("ctx.match should not be null");
                    }
                    ctx.deleteMessage();
                    return [4 /*yield*/, cancelOrder(ctx, ctx.match[1])];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    bot.action(/^fiatsent_([0-9a-f]{24})$/, userMiddleware, function (ctx) { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (ctx.match === null) {
                        throw new Error("ctx.match should not be null");
                    }
                    ctx.deleteMessage();
                    return [4 /*yield*/, fiatSent(ctx, ctx.match[1])];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    bot.action(/^release_([0-9a-f]{24})$/, userMiddleware, function (ctx) { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (ctx.match === null) {
                        throw new Error("ctx.match should not be null");
                    }
                    ctx.deleteMessage();
                    return [4 /*yield*/, release(ctx, ctx.match[1])];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    bot.command('paytobuyer', superAdminMiddleware, function (ctx) { return __awaiter(void 0, void 0, void 0, function () {
        var orderId, order, isPending, error_20;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 8, , 9]);
                    return [4 /*yield*/, validateParams(ctx, 2, '\\<_order id_\\>')];
                case 1:
                    orderId = (_a.sent())[0];
                    if (!orderId)
                        return [2 /*return*/];
                    return [4 /*yield*/, validateObjectId(ctx, orderId)];
                case 2:
                    if (!(_a.sent()))
                        return [2 /*return*/];
                    return [4 /*yield*/, Order.findOne({
                            _id: orderId,
                        })];
                case 3:
                    order = _a.sent();
                    if (!!order) return [3 /*break*/, 5];
                    return [4 /*yield*/, messages.notActiveOrderMessage(ctx)];
                case 4: return [2 /*return*/, _a.sent()];
                case 5: return [4 /*yield*/, PendingPayment.findOne({
                        order_id: order._id,
                        attempts: { $lt: process.env.PAYMENT_ATTEMPTS },
                    })];
                case 6:
                    isPending = _a.sent();
                    if (isPending)
                        return [2 /*return*/];
                    return [4 /*yield*/, payToBuyer(bot, order)];
                case 7:
                    _a.sent();
                    return [3 /*break*/, 9];
                case 8:
                    error_20 = _a.sent();
                    logger.error(error_20);
                    return [3 /*break*/, 9];
                case 9: return [2 /*return*/];
            }
        });
    }); });
    bot.command('listcurrencies', userMiddleware, function (ctx) { return __awaiter(void 0, void 0, void 0, function () {
        var currencies, error_21;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    currencies = getCurrenciesWithPrice();
                    return [4 /*yield*/, messages.listCurrenciesResponse(ctx, currencies)];
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
    }); });
    bot.command('info', userMiddleware, function (ctx) { return __awaiter(void 0, void 0, void 0, function () {
        var config, error_22;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 3, , 4]);
                    return [4 /*yield*/, Config.findOne({})];
                case 1:
                    config = _a.sent();
                    return [4 /*yield*/, messages.showInfoMessage(ctx, ctx.user, config)];
                case 2:
                    _a.sent();
                    return [3 /*break*/, 4];
                case 3:
                    error_22 = _a.sent();
                    logger.error(error_22);
                    return [3 /*break*/, 4];
                case 4: return [2 /*return*/];
            }
        });
    }); });
    bot.command('showusername', userMiddleware, function (ctx) { return __awaiter(void 0, void 0, void 0, function () {
        var show, error_23;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 3, , 4]);
                    return [4 /*yield*/, validateParams(ctx, 2, '_yes/no_')];
                case 1:
                    show = (_a.sent())[0];
                    if (!show)
                        return [2 /*return*/];
                    show = show === 'yes';
                    ctx.user.show_username = show;
                    return [4 /*yield*/, ctx.user.save()];
                case 2:
                    _a.sent();
                    messages.updateUserSettingsMessage(ctx, 'showusername', show);
                    return [3 /*break*/, 4];
                case 3:
                    error_23 = _a.sent();
                    logger.error(error_23);
                    return [3 /*break*/, 4];
                case 4: return [2 /*return*/];
            }
        });
    }); });
    bot.command('showvolume', userMiddleware, function (ctx) { return __awaiter(void 0, void 0, void 0, function () {
        var show, error_24;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 3, , 4]);
                    return [4 /*yield*/, validateParams(ctx, 2, '_yes/no_')];
                case 1:
                    show = (_a.sent())[0];
                    if (!show)
                        return [2 /*return*/];
                    show = show === 'yes';
                    ctx.user.show_volume_traded = show;
                    return [4 /*yield*/, ctx.user.save()];
                case 2:
                    _a.sent();
                    messages.updateUserSettingsMessage(ctx, 'showvolume', show);
                    return [3 /*break*/, 4];
                case 3:
                    error_24 = _a.sent();
                    logger.error(error_24);
                    return [3 /*break*/, 4];
                case 4: return [2 /*return*/];
            }
        });
    }); });
    bot.command('exit', userMiddleware, function (ctx) { return __awaiter(void 0, void 0, void 0, function () {
        var error_25;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _b.trys.push([0, 2, , 3]);
                    if (((_a = ctx.message) === null || _a === void 0 ? void 0 : _a.chat.type) !== 'private')
                        return [2 /*return*/];
                    return [4 /*yield*/, ctx.reply(ctx.i18n.t('not_wizard'))];
                case 1:
                    _b.sent();
                    return [3 /*break*/, 3];
                case 2:
                    error_25 = _b.sent();
                    logger.error(error_25);
                    return [3 /*break*/, 3];
                case 3: return [2 /*return*/];
            }
        });
    }); });
    bot.on('text', userMiddleware, function (ctx) { return __awaiter(void 0, void 0, void 0, function () {
        var text, message;
        var _a;
        return __generator(this, function (_b) {
            try {
                if (((_a = ctx.message) === null || _a === void 0 ? void 0 : _a.chat.type) !== 'private')
                    return [2 /*return*/];
                text = ctx.message.text;
                message = void 0;
                // If the user is trying to enter a command with first letter uppercase
                if (text[0] === '/' && text[1] === text[1].toUpperCase()) {
                    message = ctx.i18n.t('no_capital_letters');
                }
                else {
                    message = ctx.i18n.t('unknown_command');
                }
                ctx.reply(message);
            }
            catch (error) {
                logger.error(error);
            }
            return [2 /*return*/];
        });
    }); });
    return bot;
};
exports.initialize = initialize;
var start = function (botToken, options) {
    var bot = initialize(botToken, options);
    bot.launch();
    logger.notice('Bot launched.');
    // Enable graceful stop
    process.once('SIGINT', function () { return bot.stop('SIGINT'); });
    process.once('SIGTERM', function () { return bot.stop('SIGTERM'); });
    return bot;
};
exports.start = start;
