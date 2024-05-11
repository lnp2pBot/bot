const { finalizeEvent, verifyEvent } = require('nostr-tools/pure');
const Config = require('./config');

const { Community } = require('../../../models');
const { toKebabCase } = require('../../../util');

/// All events broadcasted are Parameterized Replaceable Events,
/// the event kind must be between 30000 and 39999
const kind = 38383;

const orderToTags = async order => {
  const expiration =
    Math.floor(Date.now() / 1000) +
    parseInt(process.env.ORDER_PUBLISHED_EXPIRATION_WINDOW);
  let fiat_amount = order.fiat_amount;
  if (order.amount === 0) {
    fiat_amount = `${order.min_amount}-${order.max_amount}`;
  }
  const tags = [];
  tags.push(['d', order.id]);
  tags.push(['k', order.type]);
  tags.push(['f', order.fiat_code]);
  tags.push(['s', toKebabCase(order.status)]);
  tags.push(['amt', order.amount.toString()]);
  tags.push(['fa', fiat_amount.toString()]);
  tags.push(['pm', order.payment_method]);
  tags.push(['premium', order.price_margin.toString()]);
  tags.push(['y', 'lnp2pbot']);
  tags.push(['z', 'order']);
  tags.push(['expiration', expiration.toString()]);
  if (order.community_id) {
    const community = await Community.findById(order.community_id);
    if (community.public) {
      tags.push(['community_id', order.community_id]);
    }
  }

  return tags;
};

exports.createOrderEvent = async order => {
  const myPrivKey = Config.getPrivateKey();

  const created_at = Math.floor(Date.now() / 1000);
  const tags = await orderToTags(order);

  const event = finalizeEvent(
    {
      kind,
      created_at,
      tags,
      content: '',
    },
    myPrivKey
  );

  const ok = verifyEvent(event);
  if (!ok) {
    console.log('Event not verified');
    return;
  }

  return event;
};
