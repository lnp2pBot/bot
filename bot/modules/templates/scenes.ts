import { Scenes, Markup } from 'telegraf';
import { OrderTemplate } from '../../../models';
import { getCurrency } from '../../../util';
import {
  CommunityContext,
  CommunityWizardState,
} from '../community/communityContext';
import { logger } from '../../../logger';
import { createOrderWizardStatus } from '../orders/messages';
import * as templatesMessages from './messages';
import * as templatesCommands from './commands';
import { Message } from 'telegraf/typings/core/types/typegram';

export const TEMPLATES_WIZARD = 'TEMPLATES_WIZARD';

interface TemplateWizardState extends Scenes.WizardSessionData {
  user: any;
  listMessageIds?: number[];
  statusMessage?: Message.TextMessage;
  currentStatusText?: string;
  type?: 'buy' | 'sell';
  currency?: string;
  fiatAmount?: number[];
  amount?: number;
  priceMargin?: number;
  method?: string;
  error?: string | null;
  promptId?: number;
  isUpdatingUI?: boolean;
  updateUI?: () => Promise<void>;
}

const resetCreationState = (state: TemplateWizardState) => {
  delete state.statusMessage;
  delete state.currentStatusText;
  delete state.type;
  delete state.currency;
  delete state.fiatAmount;
  delete state.amount;
  delete state.priceMargin;
  delete state.method;
  delete state.error;
  delete state.promptId;
  delete state.isUpdatingUI;
  delete state.updateUI;
};

export const templatesWizard = new Scenes.WizardScene<CommunityContext>(
  TEMPLATES_WIZARD,
  // Step 0: List View & Management
  async ctx => {
    const state = ctx.wizard.state as unknown as TemplateWizardState;

    if (!state.user) {
      logger.error('Templates wizard entered without user in state');
      return ctx.scene.leave();
    }

    resetCreationState(state);

    try {
      if (state.listMessageIds) {
        for (const msgId of state.listMessageIds) {
          await ctx.telegram.deleteMessage(ctx.chat!.id, msgId).catch(() => {});
        }
      }

      state.listMessageIds = await templatesCommands.renderTemplateList(
        ctx as any,
        state.user._id,
      );

      return ctx.wizard.next();
    } catch (err) {
      logger.error('Error in templates list step:', err);
      return ctx.scene.leave();
    }
  },
  // Step 1: List Handler
  async ctx => {
    const state = ctx.wizard.state as unknown as TemplateWizardState;

    if (ctx.callbackQuery) {
      const data = (ctx.callbackQuery as any).data as string;

      if (data === 'tpl_list_create') {
        await ctx.answerCbQuery().catch(() => {});
        // Cleanup list messages to avoid confusion

        if (state.listMessageIds) {
          for (const msgId of state.listMessageIds) {
            await ctx.telegram
              .deleteMessage(ctx.chat!.id, msgId)
              .catch(() => {});
          }
          state.listMessageIds = [];
        }
        ctx.wizard.cursor = 2;
        return (ctx.wizard as any).steps[2](ctx);
      }

      if (data.startsWith('tpl_list_publish_')) {
        await ctx.answerCbQuery().catch(() => {});
        const id = data.replace('tpl_list_publish_', '');

        // Clear all template messages to clean the UI
        if (state.listMessageIds && state.listMessageIds.length > 0) {
          for (const msgId of state.listMessageIds) {
            await ctx.telegram
              .deleteMessage(ctx.chat!.id, msgId)
              .catch(() => {});
          }
          state.listMessageIds = [];
        }

        const template = await OrderTemplate.findOne({
          _id: id,
          creator_id: state.user._id,
        });
        if (!template) {
          await ctx.reply(ctx.i18n.t('template_not_found'));
          return ctx.scene.leave();
        }

        await templatesCommands.publishFromTemplate(ctx as any, template);

        // EXIT WIZARD completely
        return ctx.scene.leave();
      }

      if (data.startsWith('tpl_list_delete_')) {
        await ctx.answerCbQuery().catch(() => {});
        const id = data.replace('tpl_list_delete_', '');
        const { text, keyboard } = templatesMessages.confirmDeleteTemplateData(
          ctx.i18n,
          id,
        );
        if (ctx.callbackQuery.message) {
          await ctx.telegram
            .editMessageText(
              ctx.chat!.id,
              ctx.callbackQuery.message.message_id,
              undefined,
              text,
              keyboard,
            )
            .catch(() => {});
        }
        return;
      }

      if (data.startsWith('tpl_list_confirm_delete_')) {
        await ctx.answerCbQuery().catch(() => {});
        const id = data.replace('tpl_list_confirm_delete_', '');
        await OrderTemplate.deleteOne({ _id: id, creator_id: state.user._id });
        await ctx.reply(templatesMessages.templateDeletedMessage(ctx.i18n));
        ctx.wizard.cursor = 0;
        return (ctx.wizard as any).steps[0](ctx);
      }

      if (data === 'tpl_list_back') {
        await ctx.answerCbQuery().catch(() => {});
        ctx.wizard.cursor = 0;
        return (ctx.wizard as any).steps[0](ctx);
      }
    }

    if (ctx.message) {
      await ctx.deleteMessage().catch(() => {});
    }
  },
  // Step 2: Setup Creation UI
  async ctx => {
    const state = ctx.wizard.state as unknown as TemplateWizardState;

    // Show first choice
    const keyboard = Markup.inlineKeyboard([
      Markup.button.callback(ctx.i18n.t('buy'), 'tpl_type_buy'),
      Markup.button.callback(ctx.i18n.t('sell'), 'tpl_type_sell'),
    ]);
    const prompt = await ctx.reply(ctx.i18n.t('enter_template_type'), keyboard);
    state.promptId = prompt.message_id;
    return ctx.wizard.next();
  },
  // Step 3: Type Handler
  async ctx => {
    const state = ctx.wizard.state as unknown as TemplateWizardState;
    if (ctx.callbackQuery) {
      const data = (ctx.callbackQuery as any).data as string;
      if (!data.startsWith('tpl_type_')) return;
      await ctx.answerCbQuery().catch(() => {});
      state.type = data === 'tpl_type_buy' ? 'buy' : 'sell';

      if (state.promptId) {
        await ctx.telegram
          .deleteMessage(ctx.chat!.id, state.promptId)
          .catch(() => {});
        delete state.promptId;
      }

      if (!state.statusMessage) {
        const { text } = createOrderWizardStatus(
          ctx.i18n,
          state as unknown as CommunityWizardState,
        );
        const res = await ctx.reply(text);
        state.currentStatusText = text;
        state.statusMessage = res as Message.TextMessage;

        // Robust updateUI with lock to avoid race conditions
        state.updateUI = async () => {
          if (state.isUpdatingUI || !state.statusMessage) return;
          const { text: newText } = createOrderWizardStatus(
            ctx.i18n,
            state as unknown as CommunityWizardState,
          );
          if (state.currentStatusText === newText) return;

          state.isUpdatingUI = true;
          try {
            await ctx.telegram.editMessageText(
              state.statusMessage.chat.id,
              state.statusMessage.message_id,
              undefined,
              newText,
            );
            state.currentStatusText = newText;
          } catch (err: any) {
            if (!err.description?.includes('message is not modified')) {
              logger.warn('Failed to update template status UI:', err.message);
            }
          } finally {
            state.isUpdatingUI = false;
          }
        };
      }

      await state.updateUI?.();

      const buttons = ['USD', 'EUR', 'ARS', 'VES', 'COP', 'BRL'].map(c =>
        Markup.button.callback(c, `tpl_cur_${c}`),
      );
      const rows = [];
      for (let i = 0; i < buttons.length; i += 3) {
        rows.push(buttons.slice(i, i + 3));
      }
      const prompt = await ctx.reply(
        ctx.i18n.t('choose_currency'),
        Markup.inlineKeyboard(rows),
      );
      state.promptId = prompt.message_id;
      return ctx.wizard.next();
    }
    if (ctx.message) await ctx.deleteMessage().catch(() => {});
  },
  // Step 4: Currency Handler
  async ctx => {
    const state = ctx.wizard.state as unknown as TemplateWizardState;
    let currencyCode: string | undefined;

    if (ctx.callbackQuery) {
      const data = (ctx.callbackQuery as any).data as string;
      if (!data.startsWith('tpl_cur_')) return;
      await ctx.answerCbQuery().catch(() => {});
      currencyCode = data.replace('tpl_cur_', '');
    } else if (ctx.message && 'text' in ctx.message) {
      currencyCode = ctx.message.text.toUpperCase();
      await ctx.deleteMessage().catch(() => {});
    }

    if (!currencyCode) return;

    const currency = getCurrency(currencyCode);
    if (!currency) {
      state.error = ctx.i18n.t('invalid_currency');
      await state.updateUI?.();
      return;
    }

    state.currency = currency.code;
    state.error = null;
    if (state.promptId) {
      await ctx.telegram
        .deleteMessage(ctx.chat!.id, state.promptId)
        .catch(() => {});
      delete state.promptId;
    }
    await state.updateUI?.();

    const prompt = await ctx.reply(
      ctx.i18n.t('enter_currency_amount', { currency: state.currency }),
    );
    state.promptId = prompt.message_id;
    return ctx.wizard.next();
  },
  // Step 5: Amount Handler
  async ctx => {
    const state = ctx.wizard.state as unknown as TemplateWizardState;
    if (!ctx.message || !('text' in ctx.message)) return;
    const text = ctx.message.text;
    await ctx.deleteMessage().catch(() => {});

    const tokens = text.split('-').map(s => s.trim());
    // Reject if any token is empty (e.g. "100-", "-100", "--")
    if (tokens.some(t => t === '') || tokens.length > 2) {
      state.error = ctx.i18n.t('must_be_number_or_range');
      await state.updateUI?.();
      return;
    }
    const inputs = tokens.map(Number);
    // Reject non-finite values
    if (inputs.some(n => !Number.isFinite(n))) {
      state.error = ctx.i18n.t('not_number');
      await state.updateUI?.();
      return;
    }
    // Reject zeros
    if (inputs.some(n => n === 0)) {
      state.error = ctx.i18n.t('not_zero');
      await state.updateUI?.();
      return;
    }
    // For ranges enforce min < max
    if (inputs.length === 2 && inputs[1] <= inputs[0]) {
      state.error = ctx.i18n.t('must_be_number_or_range');
      await state.updateUI?.();
      return;
    }

    state.fiatAmount = inputs;
    state.error = null;
    if (state.promptId) {
      await ctx.telegram
        .deleteMessage(ctx.chat!.id, state.promptId)
        .catch(() => {});
      delete state.promptId;
    }
    await state.updateUI?.();

    if (inputs.length > 1) {
      // Market price forced for range
      state.amount = 0;
      // Proceed to Margin directly
      const margin = [
        '-5',
        '-4',
        '-3',
        '-2',
        '-1',
        '+1',
        '+2',
        '+3',
        '+4',
        '+5',
      ];
      const buttons = margin.map(m =>
        Markup.button.callback(m + '%', `tpl_margin_${m}`),
      );
      const rows = [];
      for (let i = 0; i < buttons.length; i += 5) {
        rows.push(buttons.slice(i, i + 5));
      }
      rows.push([
        Markup.button.callback(
          ctx.i18n.t('no_premium_or_discount'),
          'tpl_margin_0',
        ),
      ]);
      const prompt = await ctx.reply(
        ctx.i18n.t('enter_premium_discount'),
        Markup.inlineKeyboard(rows),
      );
      state.promptId = prompt.message_id;
      // Jump to margin handler (Index 7)
      ctx.wizard.selectStep(7);
    } else {
      // Proceed to Sats Amount prompt
      const button = Markup.button.callback(
        ctx.i18n.t('market_price'),
        'marketPrice',
      );
      const prompt = await ctx.reply(
        ctx.i18n.t('enter_sats_amount'),
        Markup.inlineKeyboard([button]),
      );
      state.promptId = prompt.message_id;
      return ctx.wizard.next(); // Index 6
    }
  },
  // Step 6: Sats Handler
  async ctx => {
    const state = ctx.wizard.state as unknown as TemplateWizardState;

    if (ctx.callbackQuery) {
      const data = (ctx.callbackQuery as any).data as string;
      if (data === 'marketPrice') {
        await ctx.answerCbQuery().catch(() => {});
        state.amount = 0;
      } else {
        return;
      }
    } else if (ctx.message && 'text' in ctx.message) {
      const input = Number(ctx.message.text);
      await ctx.deleteMessage().catch(() => {});

      if (!Number.isFinite(input)) {
        state.error = ctx.i18n.t('not_number');
        await state.updateUI?.();
        return;
      }
      if (input < 0) {
        state.error = ctx.i18n.t('not_negative');
        await state.updateUI?.();
        return;
      }
      state.amount = Math.floor(input);
    } else {
      return;
    }

    state.error = null;
    if (state.promptId) {
      await ctx.telegram
        .deleteMessage(ctx.chat!.id, state.promptId)
        .catch(() => {});
      delete state.promptId;
    }
    await state.updateUI?.();

    if (state.amount > 0) {
      // Fixed sats: bypass margin logic
      state.priceMargin = 0;
      const prompt = await ctx.reply(ctx.i18n.t('enter_payment_method'));
      state.promptId = prompt.message_id;
      ctx.wizard.selectStep(8); // Index 8: Method Handler
    } else {
      // Market price: need margin
      const margin = [
        '-5',
        '-4',
        '-3',
        '-2',
        '-1',
        '+1',
        '+2',
        '+3',
        '+4',
        '+5',
      ];
      const buttons = margin.map(m =>
        Markup.button.callback(m + '%', `tpl_margin_${m}`),
      );
      const rows = [];
      for (let i = 0; i < buttons.length; i += 5) {
        rows.push(buttons.slice(i, i + 5));
      }
      rows.push([
        Markup.button.callback(
          ctx.i18n.t('no_premium_or_discount'),
          'tpl_margin_0',
        ),
      ]);
      const prompt = await ctx.reply(
        ctx.i18n.t('enter_premium_discount'),
        Markup.inlineKeyboard(rows),
      );
      state.promptId = prompt.message_id;
      return ctx.wizard.next(); // Index 7: Margin Handler
    }
  },

  // Step 7: Margin Handler
  async ctx => {
    const state = ctx.wizard.state as unknown as TemplateWizardState;
    let marginText: string | undefined;

    if (ctx.callbackQuery) {
      const data = (ctx.callbackQuery as any).data as string;
      if (!data.startsWith('tpl_margin_')) return;
      await ctx.answerCbQuery().catch(() => {});
      marginText = data.replace('tpl_margin_', '');
    } else if (ctx.message && 'text' in ctx.message) {
      marginText = ctx.message.text;
      await ctx.deleteMessage().catch(() => {});
    }

    if (marginText === undefined) return;

    const marginVal = parseInt(marginText);
    if (isNaN(marginVal)) {
      state.error = ctx.i18n.t('not_number');
      await state.updateUI?.();
      return;
    }

    state.priceMargin = marginVal;
    state.error = null;
    if (state.promptId) {
      await ctx.telegram
        .deleteMessage(ctx.chat!.id, state.promptId)
        .catch(() => {});
      delete state.promptId;
    }
    await state.updateUI?.();

    const prompt = await ctx.reply(ctx.i18n.t('enter_payment_method'));
    state.promptId = prompt.message_id;
    return ctx.wizard.next();
  },
  // Step 8: Method Handler & Completion
  async ctx => {
    const state = ctx.wizard.state as unknown as TemplateWizardState;
    if (!ctx.message || !('text' in ctx.message)) return;
    const text = ctx.message.text;
    await ctx.deleteMessage().catch(() => {});

    state.method = text.trim();
    if (!state.method) {
      state.error = ctx.i18n.t('enter_payment_method');
      await state.updateUI?.();
      return;
    }
    if (state.promptId) {
      await ctx.telegram
        .deleteMessage(ctx.chat!.id, state.promptId)
        .catch(() => {});
      delete state.promptId;
    }
    await state.updateUI?.();

    try {
      const templateData = {
        creator_id: state.user._id,
        type: state.type,
        fiat_code: state.currency,
        fiat_amount: state.fiatAmount,
        amount: state.amount || 0,
        payment_method: state.method,
        price_from_api: !state.amount,
        price_margin: state.priceMargin,
      };
      const template = new OrderTemplate(templateData);
      await template.save();

      if (state.statusMessage) {
        await ctx.telegram
          .deleteMessage(ctx.chat!.id, state.statusMessage.message_id)
          .catch(() => {});
      }
      await ctx.reply(templatesMessages.templateSavedMessage(ctx.i18n));
    } catch (err) {
      logger.error('Failed to save template:', err);
      await ctx.reply(ctx.i18n.t('generic_error'));
    }

    resetCreationState(state);
    ctx.wizard.cursor = 0;
    return (ctx.wizard as any).steps[0](ctx);
  },
);

/**
 * CRITICAL: Middleware registered to intercept commands.
 *
 * We block all commands EXCEPT:
 *   - /exit and /help (handled explicitly)
 *   - /templates (allowed to pass so it doesn't loop on entry)
 *
 * This ensures that if the user types /sell while looking at the templates list,
 * they get the "wizard help" message and the message is deleted.
 */
templatesWizard.use(async (ctx, next) => {
  if (
    ctx.message &&
    'text' in ctx.message &&
    ctx.message.text.startsWith('/')
  ) {
    const text = ctx.message.text;
    const state = ctx.wizard.state as unknown as TemplateWizardState;

    if (text === '/exit') {
      if (state.statusMessage) {
        await ctx.telegram
          .deleteMessage(ctx.chat!.id, state.statusMessage.message_id)
          .catch(() => {});
      }
      if (state.promptId) {
        await ctx.telegram
          .deleteMessage(ctx.chat!.id, state.promptId)
          .catch(() => {});
      }
      if (state.listMessageIds) {
        for (const msgId of state.listMessageIds) {
          await ctx.telegram.deleteMessage(ctx.chat!.id, msgId).catch(() => {});
        }
      }
      await ctx.scene.leave();
      return ctx.reply(ctx.i18n.t('wizard_exit'));
    }

    if (text === '/help') {
      return ctx.reply(ctx.i18n.t('wizard_help'));
    }

    // Allow entry command to avoid infinite loop on scene enter
    if (text === '/templates') {
      return next();
    }

    await ctx.reply(ctx.i18n.t('wizard_help'));
    await ctx.deleteMessage().catch(() => {});
    return;
  }
  return next();
});
