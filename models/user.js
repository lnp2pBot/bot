const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  tg_id: { type: String, unique: true },
  username: { type: String },
  first_name: { type: String },
  last_name: { type: String },
  lang: { type: String, default: 'ESP' },
  balance: { type: Number, default: 0, min: 0 },
  tradesCompleted: { type: Number, default: 0 },
  created_at: { type: Date, default: Date.now },
});

module.exports = mongoose.model('User', UserSchema);
