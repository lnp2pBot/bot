const logger = require('../../../logger');

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
    await ctx.reply(ctx.i18n.t('what_modify'), {
      reply_markup: {
        inline_keyboard: [
          [
            { text: ctx.i18n.t('name'), callback_data: `editNameBtn_${id}` },
            {
              text: ctx.i18n.t('currencies'),
              callback_data: `editCurrenciesBtn_${id}`,
            },
          ],
          [
            { text: ctx.i18n.t('group'), callback_data: `editGroupBtn_${id}` },
            {
              text: ctx.i18n.t('channels'),
              callback_data: `editChannelsBtn_${id}`,
            },
          ],
          [
            { text: ctx.i18n.t('fee'), callback_data: `editFeeBtn_${id}` },
            {
              text: ctx.i18n.t('dispute_solvers'),
              callback_data: `editSolversBtn_${id}`,
            },
          ],
          [
            {
              text: ctx.i18n.t('dispute_channel'),
              callback_data: `editDisputeChannelBtn_${id}`,
            },
            {
              text: ctx.i18n.t('earnings'),
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
