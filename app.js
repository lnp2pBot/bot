require('dotenv').config();
const { start } = require('./bot');
const mongoConnect = require('./db_connect');
const { resubscribeInvoices } = require('./ln');
const { SocksProxyAgent } = require('socks-proxy-agent');

(async () => {
  process.on('unhandledRejection', e => {
    console.log(e);
  });

  process.on('uncaughtException', e => {
    console.log(e);
  });

  mongoose = mongoConnect();
  mongoose.connection
    .once('open', async () => {
      console.log('Connected to Mongo instance.');
      var options = null;
      if (!!process.env.SOCKS_PROXY_HOST) {
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
    .on('error', error => console.log('Error connecting to Mongo:', error));
})();
