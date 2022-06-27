const { Scenes } = require('telegraf');
const logger = require('../../../logger');

exports.addEarningsInvoiceWizard = new Scenes.WizardScene(
  'SELECT_LANGUAGE_WIZARD_SCENE_ID',
  async ctx => {
    try {
      const { community } = ctx.wizard.state;
      if (community.earnings === 0) return ctx.scene.leave();

      await ctx.reply(
        ctx.i18n.t('send_me_lninvoice', { amount: community.earnings })
      );

      return ctx.wizard.next();
    } catch (error) {
      logger.error(error);
    }
  },
  async ctx => {
    try {
      if (ctx.message === undefined) return ctx.scene.leave();

      await ctx.reply(ctx.i18n.t('invoice_updated_and_will_be_paid'));

      return ctx.scene.leave();
    } catch (error) {
      logger.error(error);
      ctx.scene.leave();
    }
  }
);
