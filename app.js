require('dotenv').config();
const { Telegraf } = require('telegraf');
const botStart = require('./bot');
const mongoConnect = require('./db_connect');

mongoConnect();
botStart();
