"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = void 0;
var winston_1 = __importDefault(require("winston"));
var level = process.env.LOG_LEVEL || 'notice';
var logger = winston_1.default.createLogger({
    format: winston_1.default.format.combine(winston_1.default.format.timestamp({
        format: 'YYYY-MM-DDTHH:mm:ss.SSSZ',
    }), winston_1.default.format.colorize(), winston_1.default.format.printf(function (info) {
        return "[".concat(info.timestamp, "] ").concat(info.level, ": ").concat(info.message, " ").concat(info.stack ? info.stack : '');
    })),
    levels: winston_1.default.config.syslog.levels,
    level: level,
    transports: [
        new winston_1.default.transports.Console({
            handleExceptions: true,
        }),
    ],
    exitOnError: false,
});
exports.logger = logger;
