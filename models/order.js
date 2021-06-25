const mongoose = require('mongoose');

const OrderSchema = new mongoose.Schema({
  description: { type: String },
  amount: { type: Number, min: 100 }, // amount in satoshis
  hash: { type: String, unique: true }, // hold invoice hash
  secret: { type: String, unique: true }, // hold invoice secret
  creatorId: { type: String },
  sellerId: { type: String },
  buyerId: { type: String },
  buyerInvoice: { type: String },
  status: {
    type: String,
    enum: ['WAITING_PAYMENT', 'PENDING', 'ACTIVE', 'CLOSED'],
    default: 'WAITING_PAYMENT',
  },
  type: { type: String },
  dispute: { type: Boolean, default: false },
  fiat_amount: { type: Number, min: 1 }, // amount in fiat
  fiat_code: { type: String },
  payment_method: { type: String },
  created_at: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Order', OrderSchema);
