/* eslint-disable no-underscore-dangle */
// @ts-check
const logger = require('../../../logger');
const { showUserCommunitiesMessage } = require('./messages');
const { Community, Order } = require('../../../models');
const { validateParams, validateObjectId } = require('../../validations');

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
  const communities = await Community.find({
    currencies: currency,
    public: true,
  });
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
      '\\<_@communityGroupName \\| telegram\\-group\\-id / off_\\>'
    );
    if (!groupName) {
      return;
    }

    if (groupName === 'off') {
      user.default_community_id = null;
      await user.save();
      return await ctx.reply(ctx.i18n.t('no_default_community'));
    }
    let community;
    if (groupName[0] == '@') {
      // Allow find communities case insensitive
      const regex = new RegExp(['^', groupName, '$'].join(''), 'i');
      community = await Community.findOne({ group: regex });
    } else if (groupName[0] == '-') {
      community = await Community.findOne({ group: groupName });
    }
    if (!community) {
      return await ctx.reply(ctx.i18n.t('community_not_found'));
    }

    user.default_community_id = community._id;
    await user.save();

    await ctx.reply(ctx.i18n.t('operation_successful'));
  } catch (error) {
    logger.error(error);
  }
};

exports.communityAdmin = async ctx => {
  try {
    const [group] = await validateParams(ctx, 2, '\\<_community_\\>');
    if (!group) return;
    const creator_id = ctx.user.id;
    const [community] = await Community.find({ group, creator_id });
    if (!community) throw new Error('CommunityNotFound');
    await ctx.scene.enter('COMMUNITY_ADMIN', { community });
  } catch (err) {
    switch (err.message) {
      case 'CommunityNotFound': {
        return ctx.reply(ctx.i18n.t('community_not_found'));
      }
      default: {
        return ctx.reply(ctx.i18n.t('generic_error'));
      }
    }
  }
};

exports.myComms = async ctx => {
  try {
    const { user } = ctx;

    const communities = await Community.find({ creator_id: user._id });

    if (!communities.length)
      return await ctx.reply(ctx.i18n.t('you_dont_have_communities'));

    await showUserCommunitiesMessage(ctx, communities);
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
      return await ctx.reply(ctx.i18n.t('community_not_found'));
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

exports.updateCommunity = async (ctx, id, field, bot) => {
  try {
    ctx.deleteMessage();
    if (!id) return;
    const tgUser = ctx.update.callback_query.from;
    if (!tgUser) return;
    const { user } = ctx;

    if (!(await validateObjectId(ctx, id))) return;
    const community = await Community.findOne({
      _id: id,
      creator_id: user._id,
    });

    if (!community) {
      throw new Error(
        'Community not found in UPDATE_NAME_COMMUNITY_WIZARD_SCENE_ID'
      );
    }

    if (field === 'name') {
      ctx.scene.enter('UPDATE_NAME_COMMUNITY_WIZARD_SCENE_ID', {
        id,
        user,
        community,
      });
    } else if (field === 'currencies') {
      ctx.scene.enter('UPDATE_CURRENCIES_COMMUNITY_WIZARD_SCENE_ID', {
        id,
        user,
        community,
      });
    } else if (field === 'group') {
      ctx.scene.enter('UPDATE_GROUP_COMMUNITY_WIZARD_SCENE_ID', {
        id,
        bot,
        user,
        community,
      });
    } else if (field === 'channels') {
      ctx.scene.enter('UPDATE_CHANNELS_COMMUNITY_WIZARD_SCENE_ID', {
        id,
        bot,
        user,
        community,
      });
    } else if (field === 'fee') {
      ctx.scene.enter('UPDATE_FEE_COMMUNITY_WIZARD_SCENE_ID', {
        id,
        user,
        community,
      });
    } else if (field === 'solvers') {
      ctx.scene.enter('UPDATE_SOLVERS_COMMUNITY_WIZARD_SCENE_ID', {
        id,
        user,
        community,
      });
    } else if (field === 'disputeChannel') {
      ctx.scene.enter('UPDATE_DISPUTE_CHANNEL_COMMUNITY_WIZARD_SCENE_ID', {
        id,
        bot,
        user,
        community,
      });
    }
  } catch (error) {
    logger.error(error);
  }
};

exports.deleteCommunity = async ctx => {
  try {
    ctx.deleteMessage();
    const id = ctx.match[1];

    if (!(await validateObjectId(ctx, id))) return;
    const community = await Community.findOne({
      _id: id,
      creator_id: ctx.user._id,
    });

    if (!community) {
      return ctx.reply(ctx.i18n.t('no_permission'));
    }
    await community.remove();

    return ctx.reply(ctx.i18n.t('operation_successful'));
  } catch (error) {
    logger.error(error);
  }
};

exports.changeVisibility = async ctx => {
  try {
    ctx.deleteMessage();
    const id = ctx.match[1];

    if (!(await validateObjectId(ctx, id))) return;
    const community = await Community.findOne({
      _id: id,
      creator_id: ctx.user._id,
    });

    if (!community) {
      return ctx.reply(ctx.i18n.t('no_permission'));
    }
    community.public = !community.public;
    await community.save();

    return ctx.reply(ctx.i18n.t('operation_successful'));
  } catch (error) {
    logger.error(error);
  }
};
