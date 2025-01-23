require('websocket-polyfill');
import { logger } from '../../../logger';
import * as Config from './config';
import { createOrderEvent } from './events';
import * as Commands from './commands';
import { Telegraf } from 'telegraf';
import { MainContext } from '../../start';
import { IOrder } from '../../../models/order';
const CommunityEvents = require('../events/community');

export const configure = (bot: Telegraf<MainContext>) => {
  bot.command('/nostr', Commands.info);

  if (!Config.getRelays().length) {
    ['wss://nostr-pub.wellorder.net', 'wss://relay.damus.io'].map(
      Config.addRelay
    );
  }

  CommunityEvents.onCommunityUpdated(async (community: any) => {
    // todo: notify users
  });

  const OrderEvents = require('../events/orders');

  OrderEvents.onOrderUpdated(async (order: IOrder) => {
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
