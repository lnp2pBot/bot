const mongoose = require('mongoose');

const UserReviewSchema = new mongoose.Schema({
  rating: { type: Number, min: 0, max: 5, default: 0 },
  review: { type: String, trim: true, maxlength: 140 },
  reviewed_at: { type: Date, default: Date.now },
})

const UserSchema = new mongoose.Schema({
  tg_id: { type: String, unique: true },
  username: { type: String },
  first_name: { type: String },
  last_name: { type: String },
  lang: { type: String, default: 'ESP' },
  trades_completed: { type: Number, min: 0, default: 0 },
  total_rating: { type: Number, min: 0, max: 5, default: 0 },
  reviews: [UserReviewSchema],
  volume_traded: { type: Number, min: 0, default: 0 },
  admin: { type: Boolean, default: false },
  banned: { type: Boolean, default: false },
  show_username: { type: Boolean, default: false },
  show_volume_traded: { type: Boolean, default: false },
  lightning_address: { type: String },
  disputes: { type: Number, min: 0, default: 0 },
  created_at: { type: Date, default: Date.now },
});

module.exports = mongoose.model('User', UserSchema);
