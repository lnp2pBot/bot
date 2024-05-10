require('websocket-polyfill');
const { logger } = require('../../../logger');
const Config = require('./config');
const { createOrderEvent } = require('./events');
const Commands = require('./commands');

exports.configure = bot => {
  bot.command('/nostr', Commands.info);

  if (!Config.getRelays().length) {
    ['wss://nostr-pub.wellorder.net', 'wss://relay.damus.io'].map(
      Config.addRelay
    );
  }

  const CommunityEvents = require('../events/community');
  CommunityEvents.onCommunityUpdated(async community => {
    // todo: notify users
  });

  const OrderEvents = require('../events/orders');

  OrderEvents.onOrderUpdated(async order => {
    try {
      const event = await createOrderEvent(order);
      if (event) {
        await Promise.any(Config.pool.publish(Config.getRelays(), event));
      }

      return event;
    } catch (err) {
      logger.error(err);
    }
  });
};
