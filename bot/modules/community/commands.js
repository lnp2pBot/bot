/* eslint-disable no-underscore-dangle */
// @ts-check
const logger = require('../../../logger');
const messages = require('../../messages');
const { Community, Order } = require('../../../models');
const { validateParams } = require('../../validations');

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
  return communities.map(comm => {
    comm.orders = orderCount[comm.id] || 0;
    return comm;
  });
}

exports.setComm = async ctx => {
  try {
    const { user } = ctx;

    const [groupName] = await validateParams(
      ctx,
      2,
      '\\<_@communityGroupName / off_\\>'
    );
    if (!groupName) {
      return;
    }

    if (groupName === 'off') {
      user.default_community_id = null;
      await user.save();
      await messages.noDefaultCommunityMessage(ctx);
      return;
    }
    // Allow find communities case insensitive
    const regex = new RegExp(['^', groupName, '$'].join(''), 'i');
    const community = await Community.findOne({ group: regex });
    if (!community) {
      await messages.communityNotFoundMessage(ctx);
      return;
    }

    user.default_community_id = community._id;
    await user.save();

    await messages.operationSuccessfulMessage(ctx);
  } catch (error) {
    logger.error(error);
  }
};

exports.myComms = async ctx => {
  try {
    const user = ctx.user;

    const communities = await Community.find({ creator_id: user._id });

    await messages.showUserCommunitiesMessage(ctx, communities);
  } catch (error) {
    logger.error(error);
  }
};

exports.findCommunity = async ctx => {
  try {
    const [fiatCode] = await validateParams(ctx, 2, '\\<_fiat code_\\>');
    if (!fiatCode) return;

    const communities = await findCommunities(fiatCode.toUpperCase());
    if (!communities.length) {
      return await messages.communityNotFoundMessage(ctx);
    }

    communities.sort((a, b) => a.orders - b.orders);

    const inlineKeyboard = [];
    while (communities.length > 0) {
      const lastTwo = communities.splice(-2);
      const lineBtn = lastTwo.reverse().map(comm => ({
        text: `${comm.name}`,
        callback_data: `communityInfo_${comm._id}`,
      }));
      inlineKeyboard.push(lineBtn);
    }

    await ctx.reply(ctx.i18n.t('select_community'), {
      reply_markup: { inline_keyboard: inlineKeyboard },
    });
  } catch (error) {
    logger.error(error);
  }
};
