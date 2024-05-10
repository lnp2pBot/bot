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
var UserReviewSchema = new mongoose_1.Schema({
    rating: { type: Number, min: 0, max: 5, default: 0 },
    reviewed_at: { type: Date, default: Date.now },
});
var UserSchema = new mongoose_1.Schema({
    tg_id: { type: String, unique: true },
    username: { type: String },
    lang: { type: String, default: 'en' },
    trades_completed: { type: Number, min: 0, default: 0 },
    total_reviews: { type: Number, min: 0, default: 0 },
    last_rating: { type: Number, min: 0, max: 5, default: 0 },
    total_rating: { type: Number, min: 0, max: 5, default: 0 },
    reviews: [UserReviewSchema],
    volume_traded: { type: Number, min: 0, default: 0 },
    admin: { type: Boolean, default: false },
    banned: { type: Boolean, default: false },
    show_username: { type: Boolean, default: false },
    show_volume_traded: { type: Boolean, default: false },
    lightning_address: { type: String },
    nostr_public_key: { type: String },
    disputes: { type: Number, min: 0, default: 0 },
    created_at: { type: Date, default: Date.now },
    default_community_id: { type: String },
});
exports.default = mongoose_1.default.model('User', UserSchema);
