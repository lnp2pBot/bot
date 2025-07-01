import { I18nContext } from "@grammyjs/i18n";
import { ICommunity, IOrderChannel } from "../models/community";
import { IOrder } from "../models/order";
import { UserDocument } from "../models/user";
import { IFiatCurrencies, IFiat } from "./fiatModel";
import { ILanguage, ILanguages } from "./languagesModel";
import { Telegram } from "telegraf";
import axios from "axios";
import fiatJson from './fiat.json';
import languagesJson from './languages.json';
import { Order, Community } from "../models";
import { logger } from "../logger";
import QRCode from "qrcode";
import { Image, createCanvas } from 'canvas';

const { I18n } = require('@grammyjs/i18n');

// ISO 639-1 language codes

const languages: ILanguages = languagesJson;
const currencies: IFiatCurrencies = fiatJson;

// ISO 4217, all ISO currency codes are 3 letters but users can trade shitcoins
const isIso4217 = (code: string): boolean => {
  if (code.length < 3 || code.length > 5) {
    return false;
  }
  const alphabet = 'abcdefghijklmnopqrstuvwxyz'.split('');
  code = code.toLowerCase()
  return code.split('').every(letter => {
    if (alphabet.indexOf(letter) == -1) {
      return false;
    }
    return true;
  });
};

const isOrderCreator = (user: UserDocument, order: IOrder) => {
  try {
    return user._id == order.creator_id;
  } catch (error) {
    logger.error(error);
    return false;
  }
};

const getCurrency = (code: string): (IFiat | null) => {
  if (!isIso4217(code)) return null;
  const currency = currencies[code];
  if (!currency) return null;

  return currency;
};

const plural = (n: number): string => {

  if (n === 1) {
    return '';
  }
  return 's';
};

exports.plural = plural;

// This function formats a number to locale strings.
// If Iso code or locale code doesn´t exist, the function will return a number without format.
const numberFormat = (code: string, number: number) => {
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
const handleReputationItems = async (buyer: UserDocument, seller: UserDocument, amount: number) => {
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
      orders.forEach((order: IOrder) => {
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

const getBtcFiatPrice = async (fiatCode: string, fiatAmount: number) => {
  try {
    const currency = getCurrency(fiatCode);
    if (currency === null) throw Error("Currency not found");
    if (!currency.price) return;
    // Before hit the endpoint we make sure the code have only 3 chars
    const code = currency.code.substring(0, 3);
    const response = await axios.get(`${process.env.FIAT_RATE_EP}/${code}`);
    if (response.data.error) {
      return 0;
    }
    const sats = (fiatAmount / response.data.btc) * 100000000;

    return Number(sats);
  } catch (error) {
    logger.error(error);
  }
};

const getBtcExchangePrice = (fiatAmount: number, satsAmount: number) => {
  try {
    const satsPerBtc = 1e8;
    const feeRate = (satsPerBtc * fiatAmount) / satsAmount;

    return feeRate;
  } catch (error) {
    logger.error(error);
  }
};

const objectToArray = (object: any): any[] => {
  const array: any[] = [];

  for (const i in object) array.push(object[i]);

  return array;
};

exports.objectToArray = objectToArray;

const getCurrenciesWithPrice = () => {
  const currenciesArr = objectToArray(currencies);
  const withPrice = currenciesArr.filter(currency => currency.price);

  return withPrice;
};

const toKebabCase = (string: string) =>
  string
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/[\s_]+/g, '-')
    .toLowerCase();

const getEmojiRate = (rate: number) => {
  const star = '⭐';
  const roundedRate = Math.round(rate);
  const output = [];
  for (let i = 0; i < roundedRate; i++) output.push(star);

  return output.join('');
};

// Round number to exp decimal digits
// Source: https://developer.mozilla.org/es/docs/Web/JavaScript/Reference/Global_Objects/Math/round#redondeo_decimal
const decimalRound = (value: number, exp: number): number => {
  if (typeof exp === 'undefined' || +exp === 0) {
    return Math.round(value);
  }
  value = +value;
  exp = +exp;

  if (isNaN(value) || !(typeof exp === 'number' && exp % 1 === 0)) {
    return NaN;
  }
  // Shift
  let valueArr = value.toString().split('e');
  value = Math.round(+(valueArr[0] + 'e' + (valueArr[1] ? +valueArr[1] - exp : -exp)));
  // Shift back
  valueArr = value.toString().split('e');
  return +(valueArr[0] + 'e' + (valueArr[1] ? +valueArr[1] + exp : exp));
};

const extractId = (text: string): (string | null) => {
  const matches = text.match(/:([a-f0-9]{24}):$/);
  if (matches !== null) {
    return matches?.[1];
  }
  return null;
};

// Clean strings that are going to be rendered with markdown
const sanitizeMD = (text: any) => {
  if (!text) return '';

  return String(text).replace(/(?=[|<>(){}[\]\-_!#.`=+])/g, '\\');
};

const secondsToTime = (secs: number) => {
  const hours = Math.floor(secs / (60 * 60));

  const divisor = secs % (60 * 60);
  const minutes = Math.floor(divisor / 60);

  return {
    hours,
    minutes,
  };
};

const isGroupAdmin = async (groupId: string, user: UserDocument, telegram: Telegram) => {
  try {
    const member = await telegram.getChatMember(groupId, Number(user.tg_id));
    if (
      member &&
      (member.status === 'creator' || member.status === 'administrator')
    ) {
      return {
        success: true,
        message: `@${user.username} is ${member.status}`,
      };
    } else if (member.status === 'left') {
      return {
        success: false,
        message: `@${user.username} is not a member of this chat`,
      };
    }

    return {
      success: false,
      message: `@${user.username} is not an admin`,
    };
  } catch (error) {
    logger.error(error);
    return {
      success: false,
      message: String(error),
    };
  }
};

const deleteOrderFromChannel = async (order: IOrder, telegram: Telegram) => {
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
    await telegram.deleteMessage(channel!, Number(order.tg_channel_message1!));
  } catch (error) {
    logger.error(error);
  }
};

const getOrderChannel = async (order: IOrder) => {
  let channel = process.env.CHANNEL;
  if (order.community_id) {
    const community = await Community.findOne({ _id: order.community_id });
    if (!community) {
      return channel;
    }
    if (community.order_channels.length === 1) {
      channel = community.order_channels[0].name;
    } else {
      community.order_channels.forEach(async (c: IOrderChannel) => {
        if (c.type === order.type) {
          channel = c.name;
        }
      });
    }
  }

  return channel;
};

const getDisputeChannel = async (order: IOrder) => {
  let channel = process.env.DISPUTE_CHANNEL;
  if (order.community_id) {
    const community = await Community.findOne({ _id: order.community_id });
    if (community === null) throw Error("Community was not found in DB");
    channel = community.dispute_channel;
  }

  return channel;
};

/**
 * Returns a i18n context
 * @param {*} user
 * @returns i18n context
 */
const getUserI18nContext = async (user: UserDocument) => {
  let language = null;
  if (!('language' in user)) {
    language = 'en';
  } else {
    language = user.language;
  }
  const i18n = new I18n({
    locale: language,
    defaultLanguageOnMissing: true,
    directory: 'locales',
  });

  return i18n.createContext(user.lang);
};

const getDetailedOrder = (i18n: I18nContext, order: IOrder, buyer: UserDocument | null, seller: UserDocument | null) => {
  try {
    const buyerUsername = buyer ? sanitizeMD(buyer.username) : '';
    const buyerReputation = buyer
      ? sanitizeMD(buyer.total_rating.toFixed(2))
      : '';
    const sellerUsername = seller ? sanitizeMD(seller.username) : '';
    const sellerReputation = seller
      ? sanitizeMD(seller.total_rating.toFixed(2))
      : '';
    const buyerId = buyer ? buyer._id : '';
    const paymentMethod = sanitizeMD(order.payment_method);
    const priceMargin = sanitizeMD(order.price_margin.toString());
    let createdAt = order.created_at.toISOString();
    let takenAt = order.taken_at ? order.taken_at.toISOString() : '';
    createdAt = sanitizeMD(createdAt);
    takenAt = sanitizeMD(takenAt);
    const previousDisputeStatus = sanitizeMD(order.previous_dispute_status);
    const status = sanitizeMD(order.status);
    const fee = order.fee ? sanitizeMD(Number(order.fee)) : '';
    const creator =
      order.creator_id === buyerId ? buyerUsername : sellerUsername;
    const buyerAge = buyer ? getUserAge(buyer) : '';
    const sellerAge = seller ? getUserAge(seller) : '';
    const buyerTrades = buyer ? buyer.trades_completed : 0;
    const sellerTrades = seller ? seller.trades_completed : 0;
    const message = i18n.t('order_detail', {
      order,
      creator,
      buyerUsername,
      sellerUsername,
      createdAt,
      takenAt,
      previousDisputeStatus,
      status,
      fee,
      paymentMethod,
      priceMargin,
      buyerReputation,
      sellerReputation,
      buyerAge,
      sellerAge,
      buyerTrades,
      sellerTrades,
    });

    return message;
  } catch (error) {
    logger.error(error);
  }
};

// We need to know if this user is a dispute solver for this community
const isDisputeSolver = (community: ICommunity | null, user: UserDocument) => {
  if (!community || !user) {
    return false;
  }

  return community.solvers.some(solver => solver.id == user._id);
};

// Return the fee the bot will charge to the seller
// this fee is a combination from the global bot fee and the community fee
// When isGoldenHoneyBadger=true, only the community fee is charged (botFee=0)
const getFee = async (amount: number, communityId: string, isGoldenHoneyBadger = false) => {
  const maxFee = Math.round(amount * Number(process.env.MAX_FEE));
  if (!communityId) {
    // if no community, return 0 if golden honey badger, otherwise return max fee
    return isGoldenHoneyBadger ? 0 : maxFee;
  }

  // Calculate fees
  const botFee = maxFee * Number(process.env.FEE_PERCENT);
  let communityFee = Math.round(maxFee - botFee);
  const community = await Community.findOne({ _id: communityId });
  if (community === null) throw Error("Community was not found in DB");
  communityFee = communityFee * (community.fee / 100);


  if (isGoldenHoneyBadger) {
    return communityFee; 
  } else {
    return botFee + communityFee; 
  }
};

const itemsFromMessage = (str: string) => {
  return str
    .split(' ')
    .map(e => e.trim())
    .filter(e => !!e);
};

// Check if a number is float
const isFloat = (n: number) => typeof n === 'number' && !Number.isInteger(n);

// Returns an emoji flag for a language
const getLanguageFlag = (code: string): ILanguage => {
  return languages[code];
};

const delay = (time: number) => {
  return new Promise(resolve => setTimeout(resolve, time));
};

// Returns the hold invoice expiration time in seconds,
// and the hold invoice safety window in seconds
const holdInvoiceExpirationInSecs = () => {
  const expirationTimeInSecs =
    Number(process.env.HOLD_INVOICE_CLTV_DELTA) * 10 * 60;
  const safetyWindowInSecs =
    Number(process.env.HOLD_INVOICE_CLTV_DELTA_SAFETY_WINDOW) * 10 * 60;
  return {
    expirationTimeInSecs,
    safetyWindowInSecs,
  };
};

// Returns the user age in days
const getUserAge = (user: UserDocument) => {
  const userCreationDate = new Date(user.created_at);
  const today = new Date();
  const ageInDays = Math.floor(
    (today.getTime() - userCreationDate.getTime()) / (1000 * 3600 * 24)
  );
  return ageInDays;
};

/**
 * Returns order expiration time text
 * @param {*} order order object
 * @param {*} i18n context
 * @returns String with the remaining time to expiration in format '1 hours 30 minutes'
 */
const getTimeToExpirationOrder = (order: IOrder, i18n: I18nContext) => {
  const initialDateObj = new Date(order.created_at);
  const timeToExpire = Number(process.env.ORDER_PUBLISHED_EXPIRATION_WINDOW);
  initialDateObj.setSeconds(initialDateObj.getSeconds() + timeToExpire);

  const currentDateObj = new Date();
  const timeDifferenceMs = initialDateObj.valueOf() - currentDateObj.valueOf();
  const totalSecondsRemaining = Math.floor(timeDifferenceMs / 1000);
  const textHour = i18n.t('hours');
  const textMin = i18n.t('minutes');

  if (totalSecondsRemaining <= 0) {
    return `0 ${textHour} 0 ${textMin}`; // If the date has already passed, show remaining time as 00 hours 00 minutes
  }
  // Calculate hours, minutes, and seconds
  const hours = Math.floor(totalSecondsRemaining / 3600);
  const minutes = Math.floor((totalSecondsRemaining % 3600) / 60);
  return `${hours} ${textHour} ${minutes} ${textMin}`;
};

export const getStars = (rate: number, totalReviews: number) => {
  const stars = getEmojiRate(rate);
  const roundedRating = decimalRound(rate, -1);

  return `${roundedRating} ${stars} (${totalReviews})`;
};

export const removeAtSymbol = (text: string) => {
  return text[0] === '@' ? text.slice(1) : text;
}

export const removeLightningPrefix = (invoice: string) => {
  const prefix = 'lightning:';

  // Check if the invoice starts with the prefix
  if (invoice.startsWith(prefix)) {
    return invoice.substring(prefix.length);
  }

  // Return the invoice as is if no prefix is found
  return invoice;
};

const generateRandomImage = (nonce: string) => {
  // Import imageCache here to avoid circular dependency
  const { imageCache } = require('./imageCache');
  return imageCache.generateRandomImage(nonce);
};

const generateQRWithImage = async (request: string, randomImage: string) => {
  const canvas = createCanvas(400, 400);
  await QRCode.toCanvas(canvas, request, {
    margin: 2,
    width: 400,
  });

  const ctx = canvas.getContext('2d');
  const centerImage = new Image();
  centerImage.src = `data:image/png;base64,${randomImage}`;

  const rawRatio = process.env.IMAGE_TO_QR_RATIO ?? '0.2';
  let imageToQrRatio = parseFloat(rawRatio);
  
  // Validate ratio is a valid number between 0.1 and 0.5
  if (isNaN(imageToQrRatio) || imageToQrRatio < 0.1 || imageToQrRatio > 0.5) {
    logger.warning(`Invalid IMAGE_TO_QR_RATIO value: ${rawRatio}, using default 0.2`);
    imageToQrRatio = 0.2;
  }
  
  const imageSize = canvas.width * imageToQrRatio;
  const imagePos = (canvas.width - imageSize) / 2;

  ctx.drawImage(centerImage, imagePos, imagePos, imageSize, imageSize);

  return canvas.toBuffer();
};

export {
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
  isFloat,
  getLanguageFlag,
  delay,
  holdInvoiceExpirationInSecs,
  getUserAge,
  getTimeToExpirationOrder,
  toKebabCase,
  isOrderCreator,
  generateRandomImage,
  generateQRWithImage,
};