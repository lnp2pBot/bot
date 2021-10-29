require('dotenv').config();
const { start } = require('./bot');
const mongoConnect = require('./db_connect');

process.on('unhandledRejection', e => { console.log (e); });

process.on('uncaughtException', e => { console.log (e); });

mongoConnect();
start(process.env.BOT_TOKEN);
