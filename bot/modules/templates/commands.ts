import { OrderTemplate, User } from '../../../models';
import { IOrderTemplate } from '../../../models/order_template';
import * as ordersActions from '../../ordersActions';
import * as messages from './messages';
import {
  publishBuyOrderMessage,
  publishSellOrderMessage,
  tooManyPendingOrdersMessage,
} from '../../messages';
import { MainContext, HasTelegram } from '../../start';
import { isMaxPending } from '../orders/commands';
import { logger } from '../../../logger';
import { delay } from '../../../util';

export const renderTemplateList = async (
  ctx: MainContext,
  userId: string,
): Promise<number[]> => {
  try {
    const templates = await OrderTemplate.find({ creator_id: userId });
    const messageIds: number[] = [];

    if (templates.length === 0) {
      const text = ctx.i18n.t('no_templates');
      const { keyboard } = messages.newTemplateButtonData(ctx.i18n);
      const res = await ctx.reply(text, keyboard);
      if (res) messageIds.push(res.message_id);
    } else {
      for (const template of templates) {
        const { text, keyboard } = messages.singleTemplateData(
          ctx.i18n,
          template,
        );
        const res = await ctx.reply(text, keyboard);
        if (res) messageIds.push(res.message_id);
        await delay(100);
      }
      const { text, keyboard } = messages.newTemplateButtonData(ctx.i18n);
      const res = await ctx.reply(text, keyboard);
      if (res) messageIds.push(res.message_id);
    }

    return messageIds;
  } catch (error) {
    logger.error('Error in renderTemplateList:', error);
    return [];
  }
};

export const listTemplates = async (ctx: MainContext) => {
  try {
    await renderTemplateList(ctx, ctx.user._id);
  } catch (error) {
    logger.error(error);
  }
};

export const publishFromTemplate = async (ctx: MainContext, template: IOrderTemplate) => {
  try {
    const user = ctx.user || (await User.findOne({ tg_id: ctx.from?.id }));
    if (!user) return;

    if (await isMaxPending(user)) {
      return await tooManyPendingOrdersMessage(ctx, user, ctx.i18n);
    }

    const order = await ordersActions.createOrder(
      ctx.i18n,
      ctx as any as HasTelegram,
      user,
      {
        type: template.type,
        amount: template.amount || 0,
        fiatAmount: template.fiat_amount,
        fiatCode: template.fiat_code,
        paymentMethod: template.payment_method,
        status: 'PENDING',
        priceMargin: template.price_margin,
        community_id: user.default_community_id,
      },
    );

    if (order) {
      const publishFn =
        template.type === 'buy'
          ? publishBuyOrderMessage
          : publishSellOrderMessage;
      await publishFn(ctx as any, user, order, ctx.i18n, true);
    }
  } catch (error) {
    logger.error(error);
    await ctx.reply(ctx.i18n.t('generic_error'));
  }
};

