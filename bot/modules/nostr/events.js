const Nostr = require('nostr-tools');

const KIND = {
  ORDER_CREATED: 1,
};

exports.orderCreated = order => {
  const sk = process.env.NOSTR_SK;
  const pubkey = process.env.NOSTR_PK;

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
    // todo: tag community's npub
  }
  event.id = Nostr.getEventHash(event);
  event.sig = Nostr.signEvent(event, sk);
  return event;
};
