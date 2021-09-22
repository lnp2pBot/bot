const mongoose = require('mongoose');

const OrderSchema = new mongoose.Schema({
  description: { type: String },
  amount: { // amount in satoshis
    type: Number,
    min: 0,
  },
  fee: { type: Number, min: 0 },
  hash: {
    type: String,
    index: {
      unique: true,
      partialFilterExpression: { hash: { $type: 'string' } },
    },
  }, // hold invoice hash
  secret: {
    type: String,
    index: {
      unique: true,
      partialFilterExpression: { secret: { $type: 'string' } },
    },
  }, // hold invoice secret
  creator_id: { type: String },
  seller_id: { type: String },
  buyer_id: { type: String },
  buyer_invoice: { type: String },
  buyer_dispute: { type: Boolean, default: false },
  seller_dispute: { type: Boolean, default: false },
  buyer_cooperativecancel: { type: Boolean, default: false },
  seller_cooperativecancel: { type: Boolean, default: false },
  canceled_by: { type: String },
  status: {
    type: String,
    enum: [
      'WAITING_PAYMENT',// sell order waiting for user pay hold invoice
      'PENDING', // order published on CHANNEL but not taken yet
      'ACTIVE', //  order taken
      'FIAT_SENT', // buyer indicates the fiat payment is already done
      'CLOSED', // order closed
      'DISPUTE', // one of the parties started a dispute
      'CANCELED',
      'SUCCESS',
      'PAID_HOLD_INVOICE', // seller released funds
      'CANCELED_BY_ADMIN',
      'EXPIRED', // Expired orders, stated changed by a job
      'COMPLETED_BY_ADMIN',
    ],
  },
  type: { type: String },
  fiat_amount: { type: Number, min: 1 }, // amount in fiat
  fiat_code: { type: String },
  payment_method: { type: String },
  created_at: { type: Date, default: Date.now },
  invoice_held_at: { type: Date },
  taken_at: { type: Date },
  tg_chat_id: { type: String },
  tg_order_message: { type: String },
  tg_channel_message1: { type: String },
  tg_channel_message2: { type: String },
  tg_group_message1: { type: String },
  tg_group_message2: { type: String },
});

module.exports = mongoose.model('Order', OrderSchema);
