const mongoose = require('mongoose');

const OrderChannelSchema = new mongoose.Schema({
  name: String,
  type: {
    type: String,
    enum: { values: ['buy', 'sell', 'mixed'], message: '{VALUE} is not supported' }
   }
});

const arrayLimits = (val) => {
  return val.length > 0 && val.length <= 2;
}

const CommunitySchema = new mongoose.Schema({
  name: { type: String, unique: true, maxlength: 20, trim: true, required: true },
  creator_id: { type: String },
  group: { type: String }, // group Id or public name
  order_channels: { // array of Id or public name of channels
    type: [OrderChannelSchema],
    validate: [arrayLimits, '{PATH} is not within limits']
  },
  dispute_channel: { type: String }, // Id or public name, channel to send new disputes
  solvers: [String], // users that are dispute solvers
  public: { type: Boolean, default: true },
  created_at: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Community', CommunitySchema);
