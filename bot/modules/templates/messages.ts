import { Markup } from 'telegraf';
import { I18nContext } from '@grammyjs/i18n';
import { IOrderTemplate } from '../../../models/order_template';

export const singleTemplateData = (
  i18n: I18nContext,
  template: IOrderTemplate,
) => {
  const action = template.type === 'buy' ? i18n.t('buying') : i18n.t('selling');
  const fiatAmount =
    template.fiat_amount.length === 2
      ? `${template.fiat_amount[0]}-${template.fiat_amount[1]}`
      : `${template.fiat_amount[0]}`;

  const amountStr =
    template.amount > 0
      ? `${template.amount} ${i18n.t('sats')}`
      : i18n.t('sats');

  const isPremium = template.price_margin > 0;
  const margin =
    template.price_margin === 0
      ? '0'
      : isPremium
        ? `+${template.price_margin}`
        : `${template.price_margin}`;
  const rateStr =
    template.amount > 0 ? '' : i18n.t('template_rate', { margin });

  const text = i18n.t('template_card', {
    action,
    amountStr,
    fiatAmount,
    fiatCode: template.fiat_code,
    paymentMethod: template.payment_method,
    rateStr,
  });

  const keyboard = Markup.inlineKeyboard([
    Markup.button.callback(
      i18n.t('template_publish_btn'),
      `tpl_list_publish_${template._id}`,
    ),
    Markup.button.callback(
      i18n.t('template_delete_btn'),
      `tpl_list_delete_${template._id}`,
    ),
  ]);

  return { text, keyboard };
};

export const newTemplateButtonData = (i18n: I18nContext) => {
  return {
    text: i18n.t('template_new_prompt'),
    keyboard: Markup.inlineKeyboard([
      Markup.button.callback(
        `➕ ${i18n.t('create_new_template')}`,
        'tpl_list_create',
      ),
    ]),
  };
};

export const templateSavedMessage = (i18n: I18nContext) => {
  return i18n.t('template_saved');
};

export const templateDeletedMessage = (i18n: I18nContext) => {
  return i18n.t('template_deleted');
};

export const confirmDeleteTemplateData = (
  i18n: I18nContext,
  templateId: string,
) => {
  const keyboard = Markup.inlineKeyboard([
    Markup.button.callback(
      i18n.t('yes'),
      `tpl_list_confirm_delete_${templateId}`,
    ),
    Markup.button.callback(i18n.t('no'), 'tpl_list_back'),
  ]);
  return { text: i18n.t('confirm_delete_template'), keyboard };
};
