const { Config } = require('../models');
const { getInfo } = require('../ln');
const logger = require('../logger');

const info = async bot => {
  try {
    const config = await Config.findOne({});
    const info = await getInfo();
    if (info.is_synced_to_chain) {
      config.node_status = 'up';
    }
    config.node_uri = info.uris[0];
    await config.save();
  } catch (error) {
    const message = error.toString();
    logger.error(`node info catch error: ${message}`);
  }
};

module.exports = info;
