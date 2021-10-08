const axios = require('axios');
const currencies = require('./fiat.json');
const { Order } = require('../models');

// ISO 4217, all ISO currency codes are 3 letters but users can trade shitcoins
const isIso4217 = (code) => {
  if (code.length < 3 || code.length > 5) {
    return false;
  }
  const alphabet = 'abcdefghijklmnopqrstuvwxyz'.split('');
  code = code.toLowerCase().split('');
  code.forEach(letter => {
    if (alphabet.indexOf(letter) === -1) {
      return false;
    }
  });

  return true;
};

const getCurrency = (code) => {
  if (!isIso4217(code)) return false;
  const currency = currencies[code];
  if (!currency) return false;

  return currency;
};

const plural = (n) => {
    if (n == 1) {
        return '';
    }
    return 's';
};

// This function checks if the current buyer and seller were doing circular operations
// In order to increase their trades_completed and volume_traded.
// If we found those trades in the last 24 hours we decrease both variables to both users
const handleReputationItems = async (buyer, seller, amount) => {
  try {
    const yesterday = new Date(Date.now() - 86400000).toISOString();
    const orders = await Order.find({
      status: 'SUCCESS',
      seller_id: buyer._id,
      buyer_id: seller._id,
      taken_at: { $gte: yesterday },
    });
    if (orders.length > 0) {
      let totalAmount = 0;
      orders.forEach((order) => {
        totalAmount += order.amount;
      });
      const lastAmount = orders[orders.length-1].amount;
      let buyerTradesCompleted;
      let sellerTradesCompleted;
      let buyerVolumeTraded;
      let sellerVolumeTraded;
      if (amount > lastAmount) {
        buyerTradesCompleted = (buyer.trades_completed - orders.length <= 0) ? 0 : buyer.trades_completed - orders.length;
        sellerTradesCompleted = (seller.trades_completed - orders.length <= 0) ? 0 : seller.trades_completed - orders.length;
        buyerVolumeTraded = (buyer.volume_traded - totalAmount <= 0) ? 0 : buyer.volume_traded - totalAmount;
        sellerVolumeTraded = (seller.volume_traded - totalAmount <= 0) ? 0 : seller.volume_traded - totalAmount;
      } else {
        buyerTradesCompleted = (buyer.trades_completed <= 1) ? 0 : buyer.trades_completed - 1;
        sellerTradesCompleted = (seller.trades_completed <= 1) ? 0 : seller.trades_completed - 1;
        buyerVolumeTraded = (buyer.volume_traded - amount <= 0) ? 0 : buyer.volume_traded - amount;
        sellerVolumeTraded = (seller.volume_traded - amount <= 0) ? 0 : seller.volume_traded - amount;
      }
      buyer.trades_completed = buyerTradesCompleted;
      seller.trades_completed = sellerTradesCompleted;
      buyer.volume_traded = buyerVolumeTraded;
      seller.volume_traded = sellerVolumeTraded;
    } else {
      buyer.trades_completed++;
      seller.trades_completed++;
      buyer.volume_traded += amount;
      seller.volume_traded += amount;
    }
    await buyer.save();
    await seller.save();
  } catch (error) {
    console.log(error);
  }
};

const getBtcFiatPrice = async (fiatCode, fiatAmount) => {
  try {
    const currency = getCurrency(fiatCode);
    if (!currency.price) return;
    // Before hit the endpoint we make sure the code have only 3 chars
    const code = currency.code.substring(0, 3);
    const response = await axios.get(`${process.env.FIAT_RATE_EP}/${code}`);
    if (!!response.data.error) {
      return 0;
    }
    const sats = (fiatAmount / response.data.btc) * 100000000;

    return parseInt(sats);
  } catch (error) {
    console.log(error);
  }
};

// Convers a string to an array of arguments
// Source: https://stackoverflow.com/a/39304272
const parseArgs = (cmdline) => {
  var re_next_arg = /^\s*((?:(?:"(?:\\.|[^"])*")|(?:'[^']*')|\\.|\S)+)\s*(.*)$/;
  var next_arg = ['', '', cmdline];
  var args = [];
  while (next_arg = re_next_arg.exec(next_arg[2])) {
      var quoted_arg = next_arg[1];
      var unquoted_arg = "";
      while (quoted_arg.length > 0) {
          if (/^"/.test(quoted_arg)) {
              var quoted_part = /^"((?:\\.|[^"])*)"(.*)$/.exec(quoted_arg);
              unquoted_arg += quoted_part[1].replace(/\\(.)/g, "$1");
              quoted_arg = quoted_part[2];
          } else if (/^'/.test(quoted_arg)) {
              var quoted_part = /^'([^']*)'(.*)$/.exec(quoted_arg);
              unquoted_arg += quoted_part[1];
              quoted_arg = quoted_part[2];
          } else if (/^\\/.test(quoted_arg)) {
              unquoted_arg += quoted_arg[1];
              quoted_arg = quoted_arg.substring(2);
          } else {
              unquoted_arg += quoted_arg[0];
              quoted_arg = quoted_arg.substring(1);
          }
      }
      args[args.length] = unquoted_arg;
  }
  return args;
}

const objectToArray = (object) => {
  const array = [];

  for (let i in object)
    array.push(object[i]);

  return array;
};

const getCurrenciesWithPrice = () => {
  const currenciesArr = objectToArray(currencies);
  const withPrice = currenciesArr.filter((currency) => currency.price);

  return withPrice;
};

module.exports = {
  isIso4217,
  plural,
  getCurrency,
  handleReputationItems,
  getBtcFiatPrice,
  parseArgs,
  getCurrenciesWithPrice,
};
