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
var orderSchema = new mongoose_1.Schema({
    description: { type: String, required: true },
    amount: {
        // amount in satoshis
        type: Number,
        min: 0,
    },
    max_amount: {
        // max amount in fiat
        type: Number,
        min: 0,
    },
    min_amount: {
        // min amount in fiat
        type: Number,
        min: 0,
    },
    fee: { type: Number, min: 0 },
    bot_fee: { type: Number, min: 0 },
    community_fee: { type: Number, min: 0 },
    routing_fee: { type: Number, min: 0, default: 0 },
    hash: {
        type: String,
        index: {
            unique: true,
            partialFilterExpression: { hash: { $type: 'string' } },
        },
    },
    secret: {
        type: String,
        index: {
            unique: true,
            partialFilterExpression: { secret: { $type: 'string' } },
        },
    },
    creator_id: { type: String },
    seller_id: { type: String },
    buyer_id: { type: String },
    buyer_invoice: { type: String },
    buyer_dispute: { type: Boolean, default: false },
    seller_dispute: { type: Boolean, default: false },
    buyer_cooperativecancel: { type: Boolean, default: false },
    seller_cooperativecancel: { type: Boolean, default: false },
    canceled_by: { type: String },
    action_by: { type: String },
    status: {
        type: String,
        enum: [
            'WAITING_PAYMENT',
            'WAITING_BUYER_INVOICE',
            'PENDING',
            'ACTIVE',
            'FIAT_SENT',
            'CLOSED',
            'DISPUTE',
            'CANCELED',
            'SUCCESS',
            'PAID_HOLD_INVOICE',
            'CANCELED_BY_ADMIN',
            'EXPIRED',
            'COMPLETED_BY_ADMIN',
            'FROZEN',
        ],
    },
    type: { type: String },
    fiat_amount: { type: Number, min: 1 },
    fiat_code: { type: String },
    payment_method: { type: String, required: true },
    created_at: { type: Date, default: Date.now },
    invoice_held_at: { type: Date },
    taken_at: { type: Date },
    tg_chat_id: { type: String },
    tg_order_message: { type: String },
    tg_channel_message1: { type: String },
    range_parent_id: { type: String },
    price_from_api: { type: Boolean },
    price_margin: { type: Number, default: 0 },
    calculated: { type: Boolean, default: false },
    admin_warned: { type: Boolean, default: false },
    paid_hold_buyer_invoice_updated: { type: Boolean, default: false },
    community_id: { type: String },
    is_public: { type: Boolean, default: true },
    is_frozen: { type: Boolean, default: false },
});
exports.default = mongoose_1.default.model('Order', orderSchema);
