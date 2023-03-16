const mongoose = require('mongoose');

const UserReviewSchema = new mongoose.Schema({
  rating: { type: Number, min: 0, max: 5, default: 0 },
  reviewed_at: { type: Date, default: Date.now },
});

const UserSchema = new mongoose.Schema({
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

module.exports = mongoose.model('User', UserSchema);
