require('dotenv').config();
const { start } = require('./bot');
const mongoConnect = require('./db_connect');
const { resubscribeInvoices } = require('./ln');

(async () => {
    process.on('unhandledRejection', e => { console.log (e); });

    process.on('uncaughtException', e => { console.log (e); });

    mongoose = mongoConnect();
    mongoose.connection
    .once('open', async () => {
        console.log('Connected to Mongo instance.');
        const bot = start(process.env.BOT_TOKEN);
        await resubscribeInvoices(bot);
    })
    .on('error', error => console.log('Error connecting to Mongo:', error))
})();
