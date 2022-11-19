require('dotenv').config();
const { SocksProxyAgent } = require('socks-proxy-agent');
const { start } = require('./bot');
const mongoConnect = require('./db_connect');
const calculateResponse = require('./jobs/calculate_users_response');
const { resubscribeInvoices } = require('./ln');
const logger = require('./logger');

(async () => {
  process.on('unhandledRejection', e => {
    logger.error(`Unhandled Rejection: ${e.message}`);
  });

  process.on('uncaughtException', e => {
    logger.error(`Uncaught Exception: ${e.message}`);
  });

  calculateResponse('637431192228f634827629ab').then(orders => {
    const average = orders.reduce((a, b) => a + b, 0) / orders.length;
    logger.info(`Average Time: ${average}`);
  });

  const mongoose = mongoConnect();
  mongoose.connection
    .once('open', async () => {
      logger.info('Connected to Mongo instance.');
      let options = { handlerTimeout: 60000 };
      if (process.env.SOCKS_PROXY_HOST) {
        const agent = new SocksProxyAgent(process.env.SOCKS_PROXY_HOST);
        options = {
          telegram: {
            agent,
          },
        };
      }

      const bot = start(process.env.BOT_TOKEN, options);
      await resubscribeInvoices(bot);
    })
    .on('error', error => logger.error(`Error connecting to Mongo: ${error}`));
})();
