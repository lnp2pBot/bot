const axios = require('axios');
const { I18n } = require('@grammyjs/i18n');
const currencies = require('./fiat.json');
const { Order, Community } = require('../models');
const logger = require('../logger');

// ISO 4217, all ISO currency codes are 3 letters but users can trade shitcoins
const isIso4217 = code => {
  if (code.length < 3 || code.length > 5) {
    return false;
  }
  const alphabet = 'abcdefghijklmnopqrstuvwxyz'.split('');
  code = code.toLowerCase().split('');
  return code.every(letter => {
    if (alphabet.indexOf(letter) == -1) {
      return false;
    }
    return true;
  });
};

const getCurrency = code => {
  if (!isIso4217(code)) return false;
  const currency = currencies[code];
  if (!currency) return false;

  return currency;
};

const plural = n => {
  if (n === 1) {
    return '';
  }
  return 's';
};

// This function formats a number to locale strings.
// If Iso code or locale code doesn´t exist, the function will return a number without format.
const numberFormat = (code, number) => {
  if (!isIso4217(code)) return false;

  if (!currencies[code]) return number;

  const locale = currencies[code].locale;
  const numberToLocaleString = Intl.NumberFormat(locale);

  if (!locale || isNaN(number)) return number;

  return numberToLocaleString.format(number);
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
      orders.forEach(order => {
        totalAmount += order.amount;
      });
      const lastAmount = orders[orders.length - 1].amount;
      let buyerTradesCompleted;
      let sellerTradesCompleted;
      let buyerVolumeTraded;
      let sellerVolumeTraded;
      if (amount > lastAmount) {
        buyerTradesCompleted =
          buyer.trades_completed - orders.length <= 0
            ? 0
            : buyer.trades_completed - orders.length;
        sellerTradesCompleted =
          seller.trades_completed - orders.length <= 0
            ? 0
            : seller.trades_completed - orders.length;
        buyerVolumeTraded =
          buyer.volume_traded - totalAmount <= 0
            ? 0
            : buyer.volume_traded - totalAmount;
        sellerVolumeTraded =
          seller.volume_traded - totalAmount <= 0
            ? 0
            : seller.volume_traded - totalAmount;
      } else {
        buyerTradesCompleted =
          buyer.trades_completed <= 1 ? 0 : buyer.trades_completed - 1;
        sellerTradesCompleted =
          seller.trades_completed <= 1 ? 0 : seller.trades_completed - 1;
        buyerVolumeTraded =
          buyer.volume_traded - amount <= 0 ? 0 : buyer.volume_traded - amount;
        sellerVolumeTraded =
          seller.volume_traded - amount <= 0
            ? 0
            : seller.volume_traded - amount;
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
    logger.error(error);
  }
};

const getBtcFiatPrice = async (fiatCode, fiatAmount) => {
  try {
    const currency = getCurrency(fiatCode);
    if (!currency.price) return;
    // Before hit the endpoint we make sure the code have only 3 chars
    const code = currency.code.substring(0, 3);
    const response = await axios.get(`${process.env.FIAT_RATE_EP}/${code}`);
    if (response.data.error) {
      return 0;
    }
    const sats = (fiatAmount / response.data.btc) * 100000000;

    return parseInt(sats);
  } catch (error) {
    logger.error(error);
  }
};

const getBtcExchangePrice = (fiatAmount, satsAmount) => {
  try {
    const satsPerBtc = 1e8;
    const feeRate = (satsPerBtc * fiatAmount) / satsAmount;

    return feeRate;
  } catch (error) {
    logger.error(error);
  }
};

const objectToArray = object => {
  const array = [];

  for (const i in object) array.push(object[i]);

  return array;
};

const getCurrenciesWithPrice = () => {
  const currenciesArr = objectToArray(currencies);
  const withPrice = currenciesArr.filter(currency => currency.price);

  return withPrice;
};

const getEmojiRate = rate => {
  const star = '⭐';
  const roundedRate = Math.round(rate);
  const output = [];
  for (let i = 0; i < roundedRate; i++) output.push(star);

  return output.join('');
};

// Round number to exp decimal digits
// Source: https://developer.mozilla.org/es/docs/Web/JavaScript/Reference/Global_Objects/Math/round#redondeo_decimal
const decimalRound = (value, exp) => {
  if (typeof exp === 'undefined' || +exp === 0) {
    return Math.round(value);
  }
  value = +value;
  exp = +exp;

  if (isNaN(value) || !(typeof exp === 'number' && exp % 1 === 0)) {
    return NaN;
  }
  // Shift
  value = value.toString().split('e');
  value = Math.round(+(value[0] + 'e' + (value[1] ? +value[1] - exp : -exp)));
  // Shift back
  value = value.toString().split('e');
  return +(value[0] + 'e' + (value[1] ? +value[1] + exp : exp));
};

const extractId = text => {
  const matches = text.match(/:([a-f0-9]{24}):$/);

  return matches[1];
};

// Clean strings that are going to be rendered with markdown
const sanitizeMD = text => {
  if (!text) return '';

  return text.toString().replace(/(?=[|(){}[\]\-_#.`=+])/g, '\\');
};

const secondsToTime = secs => {
  const hours = Math.floor(secs / (60 * 60));

  const divisor = secs % (60 * 60);
  const minutes = Math.floor(divisor / 60);

  return {
    hours,
    minutes,
  };
};

const isGroupAdmin = async (groupId, user, telegram) => {
  try {
    const member = await telegram.getChatMember(groupId, parseInt(user.tg_id));
    if (
      member &&
      (member.status === 'creator' || member.status === 'administrator')
    ) {
      return true;
    }

    return false;
  } catch (error) {
    logger.error(error);
    return false;
  }
};

const deleteOrderFromChannel = async (order, telegram) => {
  try {
    let channel = process.env.CHANNEL;
    if (order.community_id) {
      const community = await Community.findOne({ _id: order.community_id });
      if (!community) {
        return channel;
      }
      if (community.order_channels.length === 1) {
        channel = community.order_channels[0].name;
      } else {
        for await (const c of community.order_channels) {
          if (c.type === order.type) {
            channel = c.name;
          }
        }
      }
    }
    await telegram.deleteMessage(channel, order.tg_channel_message1);
  } catch (error) {
    logger.error(error);
  }
};

const getOrderChannel = async order => {
  let channel = process.env.CHANNEL;
  if (order.community_id) {
    const community = await Community.findOne({ _id: order.community_id });
    if (!community) {
      return channel;
    }
    if (community.order_channels.length === 1) {
      channel = community.order_channels[0].name;
    } else {
      community.order_channels.forEach(async c => {
        if (c.type === order.type) {
          channel = c.name;
        }
      });
    }
  }

  return channel;
};

const getDisputeChannel = async order => {
  let channel = process.env.DISPUTE_CHANNEL;
  if (order.community_id) {
    const community = await Community.findOne({ _id: order.community_id });
    channel = community.dispute_channel;
  }

  return channel;
};

/**
 * Returns a i18n context
 * @param {*} user
 * @returns i18n context
 */
const getUserI18nContext = async user => {
  const language = user.language || 'en';
  const i18n = new I18n({
    locale: language,
    defaultLanguageOnMissing: true,
    directory: 'locales',
  });

  return i18n.createContext(user.lang);
};

const getDetailedOrder = (i18n, order, buyer, seller) => {
  try {
    const buyerUsername = buyer ? sanitizeMD(buyer.username) : '';
    const sellerUsername = seller ? sanitizeMD(seller.username) : '';
    const buyerId = buyer ? buyer._id : '';
    const paymentMethod = sanitizeMD(order.payment_method);
    const priceMargin = sanitizeMD(order.price_margin.toString());
    let createdAt = order.created_at.toISOString();
    let takenAt = order.taken_at ? order.taken_at.toISOString() : '';
    createdAt = sanitizeMD(createdAt);
    takenAt = sanitizeMD(takenAt);
    const status = sanitizeMD(order.status);
    const fee = order.fee ? parseInt(order.fee) : '';
    const creator =
      order.creator_id === buyerId ? buyerUsername : sellerUsername;
    const message = i18n.t('order_detail', {
      order,
      creator,
      buyerUsername,
      sellerUsername,
      createdAt,
      takenAt,
      status,
      fee,
      paymentMethod,
      priceMargin,
    });

    return message;
  } catch (error) {
    logger.error(error);
  }
};

// We need to know if this user is a dispute solver for this community
const isDisputeSolver = async (community, user) => {
  if (!community || !user) {
    return false;
  }
  return community.solvers.some(solver => solver.id == user._id);
};

// Return the fee the bot will charge to the seller
// this fee is a combination from the global bot fee and the community fee
const getFee = async (amount, communityId) => {
  const maxFee = Math.round(amount * parseFloat(process.env.MAX_FEE));
  if (!communityId) return maxFee;

  const botFee = maxFee * parseFloat(process.env.FEE_PERCENT);
  let communityFee = Math.round(maxFee - botFee);
  const community = await Community.findOne({ _id: communityId });
  communityFee = communityFee * (community.fee / 100);

  return botFee + communityFee;
};

const itemsFromMessage = str => {
  return str
    .split(' ')
    .map(e => e.trim())
    .filter(e => !!e);
};

// Check if a number is int
const isInt = n => parseInt(n) === n;

// Check if a number is float
const isFloat = n => typeof n === 'number' && !isInt(n);

module.exports = {
  isIso4217,
  plural,
  getCurrency,
  handleReputationItems,
  getBtcFiatPrice,
  getBtcExchangePrice,
  getCurrenciesWithPrice,
  getEmojiRate,
  decimalRound,
  extractId,
  sanitizeMD,
  secondsToTime,
  isGroupAdmin,
  deleteOrderFromChannel,
  getOrderChannel,
  getUserI18nContext,
  numberFormat,
  getDisputeChannel,
  getDetailedOrder,
  isDisputeSolver,
  getFee,
  itemsFromMessage,
  isInt,
  isFloat,
};
