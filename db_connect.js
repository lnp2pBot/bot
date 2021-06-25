const mongoose = require('mongoose');

// connect to database
const credentials = !!process.env.DB_USER ? `${process.env.DB_USER}:${process.env.DB_PASS}@`: '';
const MONGO_URI = `mongodb://${credentials}${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}?authSource=admin`;
if (!MONGO_URI) {
  throw new Error('You must provide a MongoDB URI');
}

const connect = () => {
  mongoose.connect(MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });
  mongoose.connection
    .once('open', () => console.log('Connected to Mongo instance.'))
    .on('error', error => console.log('Error connecting to Mongo:', error));
};

module.exports = connect;
