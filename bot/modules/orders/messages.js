const { getOrderChannel } = require('../../../util');

exports.listOrdersResponse = async orders => {
  const response =
    '             Id          \\|     Status    \\|   sats amount  \\|  fiat amt  \\|  fiat\n';
  const tasks = orders.map(async order => {
    const channel = await getOrderChannel(order);
    let fiatAmount = '\\-';
    let amount = '\\-';
    const status = order.status.split('_').join('\\_');
    if (typeof order.fiat_amount !== 'undefined')
      fiatAmount = order.fiat_amount;
    if (typeof order.amount !== 'undefined') amount = order.amount;
    return `\`${order.id}\` \\| ${status} \\| ${amount} \\| ${fiatAmount} \\| ${order.fiat_code} \\| ${channel}`;
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
