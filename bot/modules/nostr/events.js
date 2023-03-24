const Nostr = require('nostr-tools');
const Config = require('./config');

const { Community } = require('../../../models');

const KIND = {
  ORDER_CREATED: 20100,
};

exports.orderCreated = async order => {
  const sk = Config.getPrivateKey();
  const pubkey = Config.getPublicKey();

  const event = Nostr.getBlankEvent();
  event.kind = KIND.ORDER_CREATED;
  event.pubkey = pubkey;
  event.created_at = Math.floor(Date.now() / 1000);
  const evData = (order => {
    const { id, type, amount, max_amount, min_amount, fiat_code, fiat_amount } =
      order;
    return {
      id,
      type,
      amount,
      max_amount,
      min_amount,
      fiat_code,
      fiat_amount,
    };
  })(order);
  event.content = JSON.stringify(evData);
  if (order.community_id) {
    const community = await Community.findById(order.community_id);
    if (community.public) {
      if (community.nostr_public_key) {
        event.tags.push(['p', community.nostr_public_key]);
      }
      event.tags.push(['com', order.community_id]);
    }
  }
  event.id = Nostr.getEventHash(event);
  event.sig = Nostr.signEvent(event, sk);
  return event;
};
