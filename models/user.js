const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  tg_id: { type: String, unique: true },
  username: { type: String },
  first_name: { type: String },
  last_name: { type: String },
  lang: { type: String, default: 'ESP' },
  trades_completed: { type: Number, min: 0, default: 0 },
  volume_traded: { type: Number, min: 0, default: 0 },
  admin: { type: Boolean, default: false },
  banned: { type: Boolean, default: false },
  show_username: { type: Boolean, default: false },
  show_volume_traded: { type: Boolean, default: false },
  disputes: { type: Number, min: 0, default: 0 },
  created_at: { type: Date, default: Date.now },
});

module.exports = mongoose.model('User', UserSchema);
