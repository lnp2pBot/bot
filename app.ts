import 'dotenv/config';
import { SocksProxyAgent } from 'socks-proxy-agent';
import { start } from './bot/start';
import { connect as mongoConnect } from './db_connect';
import { resubscribeInvoices } from './ln';
import { logger } from './logger';
import { Telegraf } from 'telegraf';
import { delay } from './util';
import { imageCache } from './util/imageCache';
import { createIndexes } from './models/indexes';
import { CommunityContext } from './bot/modules/community/communityContext';
import { startMonitoring } from './monitoring';

(async () => {
  process.on('unhandledRejection', e => {
    if (e) {
      logger.error(`Unhandled Rejection: ${e}`);
    }
  });

  process.on('uncaughtException', e => {
    if (e) {
      logger.error(`Uncaught Exception: ${e}`);
    }
  });

  const mongoose = mongoConnect();
  mongoose.connection
    .once('open', async () => {
      logger.info('Connected to Mongo instance.');

      // Create database indexes for optimized queries
      await createIndexes();

      // Initialize image cache for faster order creation
      await imageCache.initialize();

      // Use configurable bot handler timeout, default to 60 seconds
      const handlerTimeout = parseInt(
        process.env.BOT_HANDLER_TIMEOUT || '60000',
      );
      let options: Partial<Telegraf.Options<CommunityContext>> = {
        handlerTimeout,
      };
      if (process.env.SOCKS_PROXY_HOST) {
        const agent = new SocksProxyAgent(process.env.SOCKS_PROXY_HOST);
        options = {
          ...options,
          telegram: {
            agent: agent as any,
          },
        };
      }
      const bot = start(String(process.env.BOT_TOKEN), options);
      // Wait 1 seconds before try to resubscribe hold invoices
      await delay(1000);
      await resubscribeInvoices(bot);

      // Start external monitoring heartbeats (non-blocking, fails gracefully)
      startMonitoring();
    })
    .on('error', (error: Error) =>
      logger.error(`Error connecting to Mongo: ${error}`),
    );
})();
