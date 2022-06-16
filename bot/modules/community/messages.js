const logger = require('../../../logger');
const { Community, PendingPayment } = require('../../../models');

exports.createCommunityWizardStatus = (i18n, state) => {
  try {
    let { name, currencies, group, channels, fee, solvers } = state;
    name = state.name || '__';
    currencies = state.currencies && state.currencies.join(', ');
    currencies = currencies || '__';
    group = state.group || '__';
    channels =
      state.channels && state.channels.map(channel => channel.name).join(', ');
    channels = channels || '__';
    fee = state.fee || '__';
    solvers =
      state.solvers && state.solvers.map(solver => solver.username).join(', ');
    solvers = solvers || '__';
    const text = [
      `Nombre: ${name}`,
      `Moneda: ${currencies}`,
      `Grupo: ${group}`,
      `Canales: ${channels}`,
      `Comisión: ${fee}%`,
      `Solvers: ${solvers}`,

      state.error && `Error: ${state.error}`,
      ``,
      i18n.t('wizard_to_exit'),
    ].join('\n');

    return { text };
  } catch (error) {
    logger.error(error);
  }
};

exports.updateCommunityMessage = async (ctx, id) => {
  try {
    const community = await Community.findById(id);
    let text = ctx.i18n.t('community') + `: ${community.name}\n`;
    text += ctx.i18n.t('what_to_do');
    await ctx.reply(text, {
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: '✏️ ' + ctx.i18n.t('name'),
              callback_data: `editNameBtn_${id}`,
            },
            {
              text: '✏️ ' + ctx.i18n.t('currencies'),
              callback_data: `editCurrenciesBtn_${id}`,
            },
          ],
          [
            {
              text: '✏️ ' + ctx.i18n.t('group'),
              callback_data: `editGroupBtn_${id}`,
            },
            {
              text: '✏️ ' + ctx.i18n.t('channels'),
              callback_data: `editChannelsBtn_${id}`,
            },
          ],
          [
            {
              text: '✏️ ' + ctx.i18n.t('fee'),
              callback_data: `editFeeBtn_${id}`,
            },
            {
              text: '✏️ ' + ctx.i18n.t('dispute_solvers'),
              callback_data: `editSolversBtn_${id}`,
            },
          ],
          [
            {
              text: '✏️ ' + ctx.i18n.t('dispute_channel'),
              callback_data: `editDisputeChannelBtn_${id}`,
            },
            {
              text: '💰 ' + ctx.i18n.t('earnings'),
              callback_data: `earningsBtn_${id}`,
            },
          ],
        ],
      },
    });
  } catch (error) {
    logger.error(error);
  }
};

exports.listCommunitiesMessage = async (ctx, communities) => {
  try {
    let message = '';
    communities.forEach(community => {
      message += `ID: #${community.id}\n`;
      message += ctx.i18n.t('name') + `: ${community.name}\n`;
      message += ctx.i18n.t('group') + `: ${community.group}\n`;
      community.order_channels.forEach(channel => {
        message +=
          ctx.i18n.t('channel') + ` ${channel.type}: ${channel.name}\n`;
      });
      community.solvers.forEach(solver => {
        message += ctx.i18n.t('solver') + `: ${solver.username}\n`;
      });
      message +=
        ctx.i18n.t('published') +
        `: ${community.public ? ctx.i18n.t('yes') : ctx.i18n.t('no')}\n`;
      message += ctx.i18n.t('created') + `: ${community.created_at}\n\n`;
    });
    await ctx.reply(message);
  } catch (error) {
    logger.error(error);
  }
};

exports.earningsMessage = async (ctx, communityId) => {
  try {
    // We check if there is a payment scheduled for this community
    const isScheduled = await PendingPayment.findOne({
      community_id: communityId,
      attempts: { $lt: process.env.PAYMENT_ATTEMPTS },
      paid: false,
    });
    if (isScheduled)
      return await ctx.reply(ctx.i18n.t('invoice_already_being_paid'));

    const community = await Community.findById(communityId);
    const button =
      community.earnings > 0
        ? {
            reply_markup: {
              inline_keyboard: [
                [
                  {
                    text: ctx.i18n.t('withdraw_earnings'),
                    callback_data: `withdrawEarnings_${community._id}`,
                  },
                ],
              ],
            },
          }
        : null;
    await ctx.reply(
      ctx.i18n.t('current_earnings', {
        ordersToRedeem: community.orders_to_redeem,
        earnings: community.earnings,
      }),
      button
    );
  } catch (error) {
    logger.error(error);
  }
};

exports.showUserCommunitiesMessage = async (ctx, communities) => {
  try {
    const buttons = [];
    while (communities.length > 0) {
      const lastTwo = communities.splice(-2);
      const lineBtn = lastTwo.map(c => {
        return {
          text: c.name,
          callback_data: `updateCommunity_${c._id}`,
        };
      });
      buttons.push(lineBtn);
    }

    await ctx.reply(ctx.i18n.t('select_community'), {
      reply_markup: {
        inline_keyboard: buttons,
      },
    });
  } catch (error) {
    logger.error(error);
  }
};

exports.wizardCommunityWrongPermission = async (ctx, user, channel) => {
  try {
    await ctx.reply(
      ctx.i18n.t('wizard_community_you_are_not_admin', {
        username: user.username,
        channel,
      })
    );
  } catch (error) {
    logger.error(error);
  }
};
