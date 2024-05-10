"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.connect = void 0;
var mongoose_1 = __importDefault(require("mongoose"));
var logger_1 = require("./logger");
mongoose_1.default.set('strictQuery', false);
// connect to database
var credentials = process.env.DB_USER
    ? "".concat(process.env.DB_USER, ":").concat(process.env.DB_PASS, "@")
    : '';
var MONGO_URI = "mongodb://".concat(credentials).concat(process.env.DB_HOST, ":").concat(process.env.DB_PORT, "/").concat(process.env.DB_NAME, "?authSource=admin");
MONGO_URI = process.env.MONGO_URI ? process.env.MONGO_URI : MONGO_URI;
if (!MONGO_URI) {
    throw new Error('You must provide a MongoDB URI');
}
logger_1.logger.info("Connecting to MongoDB");
var connect = function () {
    mongoose_1.default.connect(MONGO_URI, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
    });
    return mongoose_1.default;
};
exports.connect = connect;
