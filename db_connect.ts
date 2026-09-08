import mongoose, { ConnectOptions } from 'mongoose';
import { logger } from './logger';

mongoose.set('strictQuery', false);

const buildMongoUri = (): string => {
  if (process.env.MONGO_URI) return process.env.MONGO_URI;

  if (!process.env.DB_HOST) {
    throw new Error('You must provide a MongoDB URI');
  }

  const credentials = process.env.DB_USER
    ? `${process.env.DB_USER}:${process.env.DB_PASS}@`
    : '';

  return `mongodb://${credentials}${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}?authSource=admin`;
};

// The connection settings are resolved lazily so that modes that don't need a
// database (like sunset mode) can start without any DB_* / MONGO_URI variable
const connect = () => {
  const MONGO_URI = buildMongoUri();
  logger.info(`Connecting to MongoDB`);
  mongoose.connect(MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  } as ConnectOptions);
  return mongoose;
};

export { connect, buildMongoUri };
