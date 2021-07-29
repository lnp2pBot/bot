const mongoose = require('mongoose');

const PendingPaymentSchema = new mongoose.Schema({
  description: { type: String },
  amount: { // amount in satoshis
    type: Number,
    min: [100, 'Minimum amount is 100 sats'],
    validate : {
      validator : Number.isInteger,
      message   : '{VALUE} is not an integer value'
    }
  },
  attempts: { type: Number, min: 1, default: 0 },
  payment_request: { type: String },
  hash: { type: String },
  created_at: { type: Date, default: Date.now },
  user_id: { type: String },
  order_id: { type: String },
});

module.exports = mongoose.model('PendingPayment', PendingPaymentSchema);
