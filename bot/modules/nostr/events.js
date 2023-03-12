const Nostr = require('nostr-tools');

const KIND = {
  ORDER_CREATED: 20100,
};

exports.orderCreated = order => {
  const sk = process.env.NOSTR_SK;
  const pubkey = process.env.NOSTR_PK;

  const event = Nostr.getBlankEvent();
  event.kind = KIND.ORDER_CREATED;
  event.pubkey = pubkey;
  event.created_at = Math.floor(Date.now() / 1000);
  event.content = JSON.stringify({
    orderId: order.id,
    type: order.type,
    fiat_code: order.fiat_code,
    description: order.description,
  });
  if (order.community_id) {
    // todo: tag community's npub
  }
  event.id = Nostr.getEventHash(event);
  event.sig = Nostr.signEvent(event, sk);
  return event;
};
