const mongoose = require('mongoose');

const CommunitySchema = new mongoose.Schema({
  name: { type: String, unique: true, maxlength: 20, trim: true, required: true },
  creator_id: { type: String },
  group: { type: String }, // group Id or public name
  channel1: { type: String }, // channel 1 Id or public name, usually buy, if only one channel is used then buy/sell
  channel2: { type: String }, // channel 2 Id or public name, usually sell
  channel3: { type: String }, // channel 3 Id or public name, we use this channel to admin the community
  solvers: [String], // users that are dispute solvers
  created_at: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Community', CommunitySchema);
