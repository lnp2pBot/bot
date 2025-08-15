import { Scenes } from 'telegraf';
import { validateObjectId } from '../../validations';
import { logger } from '../../../logger';
import * as messages from './messages';
import { CommunityContext } from '../community/communityContext';
import { dispute } from './commands';

export const DISPUTE_WIZARD = 'DISPUTE_WIZARD';

export const middleware = () => {
  const stage = new Scenes.Stage([disputeWizard]);
  return stage.middleware();
};

export const disputeWizard = new Scenes.WizardScene(
  DISPUTE_WIZARD,
  async (ctx: CommunityContext) => {
    try {
      const { text } = messages.disputeWizardStatus(ctx.i18n, ctx.wizard.state);
      const res = await ctx.reply(text);
      ctx.wizard.state.currentStatusText = text;
      ctx.wizard.state.statusMessage = res;
      ctx.wizard.state.updateUI = async () => {
        try {
          const { text } = messages.disputeWizardStatus(ctx.i18n, ctx.wizard.state);
          if (ctx.wizard.state.currentStatusText === text) return;
          await ctx.telegram.editMessageText(
            res.chat.id,
            res.message_id,
            undefined,
            text
          );
          ctx.wizard.state.currentStatusText = text;
        } catch (err) {
          logger.error(err);
        }
      };
      return ctx.wizard.next();
    } catch (err) {
      logger.error(err);
      return ctx.scene.leave();
    }
  },
  async (ctx) => {
    try {
      if (!ctx.message?.text) return;
      const orderId = ctx.message.text.trim();
      await ctx.deleteMessage();
      if (!orderId || !(await validateObjectId(ctx, orderId))) {
        await ctx.wizard.state.updateUI();
        return;
      }
      ctx.user = ctx.wizard.state.user;
      ctx.message.text = `/dispute ${orderId}`;
      await dispute(ctx);
      return ctx.scene.leave();
    } catch (err) {
      logger.error(err);
      return ctx.scene.leave();
    }
  }
);


