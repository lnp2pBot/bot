import mongoose, { ConnectOptions } from 'mongoose';
import { logger } from './logger';

mongoose.set('strictQuery', false);

// connect to database
const credentials = process.env.DB_USER
  ? `${process.env.DB_USER}:${process.env.DB_PASS}@`
  : '';
let MONGO_URI = `mongodb://${credentials}${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}?authSource=admin`;
MONGO_URI = process.env.MONGO_URI ? process.env.MONGO_URI : MONGO_URI;

if (!MONGO_URI) {
  throw new Error('You must provide a MongoDB URI');
}
logger.info(`Connecting to MongoDB`);
const connect = () => {
  mongoose.connect(MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  } as ConnectOptions);
  return mongoose;
};

export { connect };
