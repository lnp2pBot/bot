/* eslint-disable no-underscore-dangle */
// @ts-check
const logger = require('../../../logger');
const { Community, Order } = require('../../../models');
const { getCurrency } = require('../../../util');
const { validateUser, validateParams } = require('../../validations');

async function getOrderCountByCommunity() {
  const data = await Order.aggregate([
    { $group: { _id: '$community_id', total: { $count: {} } } },
  ]);
  return data.reduce((sum, item) => {
    sum[item._id] = item.total;
    return sum;
  }, {});
}

async function findCommunities(currency) {
  const communities = await Community.find({ currencies: currency });
  const orderCount = await getOrderCountByCommunity();
  return communities.map((comm) => {
    comm.orders = orderCount[comm.id] || 0;
    return comm;
  });
}

exports.findCommunity = async (ctx) => {
  try {
    const user = await validateUser(ctx, false);
    if (!user) return;

    const [fiatCode] = await validateParams(ctx, 2, '\\<_fiat code_\\>');
    if (!fiatCode) return;
    const currency = getCurrency(fiatCode.toUpperCase());

    if (!currency) {
      await ctx.reply('InvalidCurrencyCode');
      return;
    }

    const communities = await findCommunities(currency.code);
    communities.sort((a, b) => a.orders - b.orders);

    const inlineKeyboard = [];
    while (communities.length > 0) {
      const lastTwo = communities.splice(-2);
      const lineBtn = lastTwo.reverse().map((comm) => ({
        text: `${comm.name}`,
        callback_data: `communityInfo_${comm._id}`,
      }));
      inlineKeyboard.push(lineBtn);
    }
    const text = 'Selecciona la comunidad';
    await ctx.reply(text, {
      reply_markup: { inline_keyboard: inlineKeyboard },
    });
  } catch (error) {
    logger.error(error);
  }
};
