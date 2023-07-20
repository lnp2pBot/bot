const mongoose = require('mongoose');

const ConfigSchema = new mongoose.Schema({
  maintenance: { type: Boolean, default: false },
  node_status: { type: String, default: 'down' },
  node_uri: { type: String },
});

module.exports = mongoose.model('Config', ConfigSchema);
