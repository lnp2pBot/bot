const logger = require('../../../logger');

exports.showFlagsMessage = async (ctx, flags) => {
  try {
    const buttons = [];
    while (flags.length > 0) {
      const lastTwo = flags.splice(-2);
      const lineBtn = lastTwo.map(c => {
        return {
          text: c.name + ' ' + c.emoji,
          callback_data: `setLanguage_${c.code}`,
        };
      });
      buttons.push(lineBtn);
    }

    await ctx.reply(ctx.i18n.t('select_language'), {
      reply_markup: {
        inline_keyboard: buttons,
      },
    });
  } catch (error) {
    logger.error(error);
  }
};
