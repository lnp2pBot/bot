import 'dotenv/config';
import dns from 'node:dns';
import https from 'node:https';
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
  dns.setDefaultResultOrder('ipv4first');

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
      try {
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
        const socksProxyHost = process.env.SOCKS_PROXY_HOST?.trim();
        const telegramAgent = socksProxyHost
          ? (() => {
              const proxyUrl = /^socks[45]?:\/\//i.test(socksProxyHost)
                ? socksProxyHost
                : `socks5://${socksProxyHost}`;
              logger.info(`Using SOCKS proxy for Telegram API: ${proxyUrl}`);
              return new SocksProxyAgent(proxyUrl) as any;
            })()
          : (() => {
              logger.info('Using direct HTTPS agent for Telegram API (IPv4 forced)');
              return new https.Agent({
                family: 4,
                keepAlive: true,
                timeout: 60000,
              }) as any;
            })();

        options = {
          ...options,
          telegram: {
            agent: telegramAgent,
          },
        };
        const bot = await start(String(process.env.BOT_TOKEN), options);
        // Wait 1 seconds before try to resubscribe hold invoices
        await delay(1000);
        await resubscribeInvoices(bot);

        // Start external monitoring heartbeats (non-blocking, fails gracefully)
        startMonitoring();
      } catch (error) {
        logger.error(`Startup failed: ${error}`);
        process.exit(1);
      }
    })
    .on('error', (error: Error) =>
      logger.error(`Error connecting to Mongo: ${error}`),
    );
})();
