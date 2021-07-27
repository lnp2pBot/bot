const mongoose = require('mongoose');

const OrderSchema = new mongoose.Schema({
  description: { type: String },
  amount: { // amount in satoshis
    type: Number,
    min: [100, 'Minimum amount is 100 sats'],
    validate : {
      validator : Number.isInteger,
      message   : '{VALUE} is not an integer value'
    }
  },
  hash: { type: String, unique: true }, // hold invoice hash
  secret: { type: String, unique: true }, // hold invoice secret
  creator_id: { type: String },
  seller_id: { type: String },
  buyer_id: { type: String },
  buyer_invoice: { type: String },
  buyer_dispute: { type: Boolean, default: false },
  seller_dispute: { type: Boolean, default: false },
  status: {
    type: String,
    enum: ['WAITING_PAYMENT', 'PENDING', 'ACTIVE', 'CLOSED', 'DISPUTE'],
    default: 'WAITING_PAYMENT',
  },
  type: { type: String },
  fiat_amount: { type: Number, min: 1 }, // amount in fiat
  fiat_code: { type: String },
  payment_method: { type: String },
  created_at: { type: Date, default: Date.now },
  tg_chat_id: { type: String },
  tg_order_message: { type: String },
  tg_channel_message1: { type: String },
  tg_channel_message2: { type: String },
  tg_group_message1: { type: String },
  tg_group_message2: { type: String },
});

module.exports = mongoose.model('Order', OrderSchema);
