"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
var mongoose_1 = __importStar(require("mongoose"));
var CURRENCIES = parseInt(process.env.COMMUNITY_CURRENCIES || '10');
var arrayLimits = function (val) {
    return val.length > 0 && val.length <= 2;
};
var currencyLimits = function (val) {
    return val.length > 0 && val.length <= CURRENCIES;
};
var OrderChannelSchema = new mongoose_1.Schema({
    name: { type: String, required: true, trim: true },
    type: {
        type: String,
        enum: ['buy', 'sell', 'mixed'],
    },
});
var usernameIdSchema = new mongoose_1.Schema({
    id: { type: String, required: true },
    username: { type: String, required: true, trim: true },
});
var CommunitySchema = new mongoose_1.Schema({
    name: {
        type: String,
        unique: true,
        maxlength: 30,
        trim: true,
        required: true,
    },
    creator_id: { type: String },
    group: { type: String, trim: true },
    order_channels: {
        // array of Id or public name of channels
        type: [OrderChannelSchema],
        validate: [arrayLimits, '{PATH} is not within limits'],
    },
    fee: { type: Number, min: 0, max: 100, default: 0 },
    earnings: { type: Number, default: 0 },
    orders_to_redeem: { type: Number, default: 0 },
    dispute_channel: { type: String },
    solvers: [usernameIdSchema],
    banned_users: [usernameIdSchema],
    public: { type: Boolean, default: true },
    currencies: {
        type: [String],
        required: true,
        trim: true,
        validate: [currencyLimits, '{PATH} is not within limits'],
    },
    created_at: { type: Date, default: Date.now },
    nostr_public_key: { type: String },
});
exports.default = mongoose_1.default.model('Community', CommunitySchema);
