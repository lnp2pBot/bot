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
var PendingPaymentSchema = new mongoose_1.Schema({
    description: { type: String },
    amount: {
        // amount in satoshis
        type: Number,
        min: [1, 'Minimum amount is 1 sat'],
        validate: {
            validator: Number.isInteger,
            message: '{VALUE} is not an integer value',
        },
    },
    attempts: { type: Number, min: 0, default: 0 },
    paid: { type: Boolean, default: false },
    is_invoice_expired: { type: Boolean, default: false },
    payment_request: { type: String },
    hash: { type: String },
    created_at: { type: Date, default: Date.now },
    paid_at: { type: Date },
    user_id: { type: String },
    order_id: { type: String },
    community_id: { type: String },
});
exports.default = mongoose_1.default.model('PendingPayment', PendingPaymentSchema);
