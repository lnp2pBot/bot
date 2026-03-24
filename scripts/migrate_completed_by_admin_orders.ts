import 'dotenv/config';
import { connect as mongoConnect } from '../db_connect';
import Order from '../models/order';
import { logger } from '../logger';

const migrate = async () => {
  try {
    const mongoose = mongoConnect();
    await new Promise((resolve, reject) => {
      mongoose.connection.once('open', resolve);
      mongoose.connection.on('error', reject);
    });

    logger.info('Connected to MongoDB for migration.');

    const query = { status: 'COMPLETED_BY_ADMIN' };
    const update = {
      $set: {
        status: 'SUCCESS',
        settled_by_admin: true,
      },
    };

    const result = await Order.updateMany(query, update);

    logger.info(`Migration completed.`);
    logger.info(`Matched: ${result.matchedCount} orders.`);
    logger.info(`Modified: ${result.modifiedCount} orders.`);

    await mongoose.connection.close();
    logger.info('Database connection closed.');
    process.exit(0);
  } catch (error) {
    logger.error(`Migration failed: ${error}`);
    process.exit(1);
  }
};

migrate();
