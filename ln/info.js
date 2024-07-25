const lightning = require('lightning');
const lnd = require('./connect');
const { logger } = require('../logger');

const getInfo = async () => {
  try {
    return await lightning.getWalletInfo({ lnd });
  } catch (error) {
    logger.error(error);
  }
};

module.exports = { getInfo };
