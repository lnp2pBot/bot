const { getOrderChannel, sanitizeMD } = require('../../../util');

exports.listOrdersResponse = async orders => {
  const response =
    '             Id          \\|     Status    \\|   sats amount  \\|  fiat amt  \\|  fiat\n';
  const tasks = orders.map(async order => {
    const channel = await getOrderChannel(order);
    let fiatAmount = '\\-';
    let amount = '\\-';
    const status = order.status.split('_').join('\\_');
    if (typeof order.fiat_amount !== 'undefined')
      fiatAmount = sanitizeMD(order.fiat_amount);
    if (typeof order.amount !== 'undefined') amount = order.amount;
    return `\`${order.id}\` \\| ${status} \\| ${amount} \\| ${fiatAmount} \\| ${
      order.fiat_code
    } \\| ${sanitizeMD(channel)}`;
  });
  const lines = await Promise.all(tasks);
  const body = lines.join('\n');
  return {
    text: response + body,
    extra: {
      parse_mode: 'MarkdownV2',
    },
  };
};

exports.createOrderWizardStatus = (i18n, state) => {
  const { type, priceMargin } = state;
  const action = type === 'sell' ? i18n.t('selling') : i18n.t('buying');
  const sats = state.sats ? state.sats + ' ' : '';
  const paymentAction =
    type === 'sell' ? i18n.t('receive_payment') : i18n.t('pay');
  const fiatAmount =
    undefined === state.fiatAmount ? '?' : state.fiatAmount.join('-');
  const currency = state.currency || '?';

  const text = [
    `${action} ${sats}${i18n.t('sats')}`,
    `${i18n.t('for')} ${fiatAmount} ${currency}.`,
    `${paymentAction} ${i18n.t('by')} ${state.method || '?'}`,
    priceMargin
      ? `${i18n.t('rate')}: ${process.env.FIAT_RATE_NAME} ${priceMargin}%`
      : ``,
    state.error && `Error: ${state.error}`,
  ]
    .filter(e => e)
    .join('\n');
  return { text };
};
