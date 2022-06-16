const mongoose = require('mongoose');

const PendingPaymentSchema = new mongoose.Schema({
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

module.exports = mongoose.model('PendingPayment', PendingPaymentSchema);
