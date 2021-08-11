require('dotenv').config();
const { start } = require('./bot');
const mongoConnect = require('./db_connect');

mongoConnect();
start();
