const mongoose = require('mongoose');

const DisputeSchema = new mongoose.Schema({
  initiator_id: { type: String, required: true },
  seller_id: { type: String, required: true },
  buyer_id: { type: String, required: true },
  community_id: { type: String, default: null },
  solver_id: { type: String, required: true },
  solved: { type: Boolean, default: false },
  created_at: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Dispute', DisputeSchema);
