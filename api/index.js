require('dotenv').config();
const cors = require('cors');
const express = require('express');
const mongoose = require('mongoose');
const logger = require('../logger');

const mongoString = process.env.DATABASE_URL;

mongoose.connect(mongoString);
const database = mongoose.connection;

database.on('error', error => {
  logger.error(`Error connecting to Mongo: ${error}`);
});

database.once('connected', () => {
  logger.error(`Connected to Mongo instance.`);
});
const app = express();
app.use(cors());
app.use(express.json());

const routes = require('./routes/routes');

app.use('/api', routes);

app.listen(3000, () => {
  logger.error(`Server Started at ${3000}`);
});
