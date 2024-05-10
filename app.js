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
require("dotenv/config");
var socks_proxy_agent_1 = require("socks-proxy-agent");
var start_1 = require("./bot/start");
var db_connect_1 = require("./db_connect");
var resubscribeInvoices = require('./ln').resubscribeInvoices;
var logger_1 = require("./logger");
var delay = require('./util').delay;
(function () { return __awaiter(void 0, void 0, void 0, function () {
    var mongoose;
    return __generator(this, function (_a) {
        process.on('unhandledRejection', function (e) {
            if (e) {
                logger_1.logger.error("Unhandled Rejection: ".concat(e));
            }
        });
        process.on('uncaughtException', function (e) {
            if (e) {
                logger_1.logger.error("Uncaught Exception: ".concat(e));
            }
        });
        mongoose = (0, db_connect_1.connect)();
        mongoose.connection
            .once('open', function () { return __awaiter(void 0, void 0, void 0, function () {
            var options, agent, bot;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        logger_1.logger.info('Connected to Mongo instance.');
                        options = { handlerTimeout: 60000 };
                        if (process.env.SOCKS_PROXY_HOST) {
                            agent = new socks_proxy_agent_1.SocksProxyAgent(process.env.SOCKS_PROXY_HOST);
                            options = {
                                telegram: {
                                    agent: agent,
                                },
                            };
                        }
                        bot = (0, start_1.start)(String(process.env.BOT_TOKEN), options);
                        // Wait 1 seconds before try to resubscribe hold invoices
                        return [4 /*yield*/, delay(1000)];
                    case 1:
                        // Wait 1 seconds before try to resubscribe hold invoices
                        _a.sent();
                        return [4 /*yield*/, resubscribeInvoices(bot)];
                    case 2:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); })
            .on('error', function (error) { return logger_1.logger.error("Error connecting to Mongo: ".concat(error)); });
        return [2 /*return*/];
    });
}); })();
