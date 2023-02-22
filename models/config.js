const mongoose = require('mongoose');

const ConfigSchema = new mongoose.Schema({
  maintenance: { type: Boolean, default: false },
});

module.exports = mongoose.model('Config', ConfigSchema);
