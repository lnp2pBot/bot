const currencies = require('./fiat.json');
const { Order } = require('../models');

// ISO 4217, all ISO currency codes are 3 letters but users can trade shitcoins
const isIso4217 = (code) => {
    if (code.length < 3 || code.length > 4) {
        return false;
    }
    alphabet = 'abcdefghijklmnopqrstuvwxyz'.split('');
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

const parseArguments = (argsString) => {
    let args = [];
    let amount, fiatAmount, fiatCode, paymentMethod;
    // We check if we have a param between ""
    args = argsString.split('"');
    if (args.length > 1) {
      args = args.filter(el => el != '');
      args = args.filter(el => el != ' ');
      paymentMethod = args[args.length-1];
    }
    if (!!paymentMethod) {
      // We remove the paymentMethod from the string param
      argsString = argsString.replace(`"${paymentMethod}"`, '');
      args = argsString.split(' ');
      args = args.filter(el => el != '');
      if (args.length != 4) {
        return false;
      }
      [_, amount, fiatAmount, fiatCode] = args;
    } else {
      args = argsString.split(' ');
      args = args.filter(el => el != '');
      if (args.length != 5) {
        return false;
      }
      [_, amount, fiatAmount, fiatCode, paymentMethod] = args;
    }
    return { amount, fiatAmount, fiatCode, paymentMethod };
};

const handleReputationItems = async (buyer, seller, amount) => {
  try {
    const yesterday = new Date(Date.now() - 86400000).toISOString();
    const orders = await Order.find({
      status: 'SUCCESS',
      seller_id: buyer._id,
      buyer_id: seller._id,
      taken_at: { $gte: yesterday },
    });
    if (orders.length > 0) return;
    buyer.trades_completed++;
    seller.trades_completed++;
    buyer.volume_traded += amount;
    seller.volume_traded += amount;
    await buyer.save();
    await seller.save();
  } catch (error) {
    console.log(error);
  }
};

module.exports = { isIso4217, plural, parseArguments, getCurrency, handleReputationItems };
