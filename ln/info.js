const lightning = require('lightning');
const lnd = require('./connect');

const getInfo = async () => {
  try {
    return await lightning.getWalletInfo({ lnd });
  } catch (e) {
    console.log(e);
    return e;
  }
};

module.exports = { getInfo };
