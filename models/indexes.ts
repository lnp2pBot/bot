import mongoose from 'mongoose';
import { logger } from '../logger';

/**
 * Checks if an equivalent index already exists for the given index specification
 */
const checkIndexExists = async (
  collection: mongoose.Collection,
  indexSpec: Record<string, number>,
): Promise<boolean> => {
  try {
    const existingIndexes = await collection.indexes();

    // Convert our index spec to a comparable format
    const targetKeys = JSON.stringify(indexSpec);

    // Check if any existing index matches our specification
    for (const existingIndex of existingIndexes) {
      const existingKeys = JSON.stringify(existingIndex.key);
      if (existingKeys === targetKeys) {
        return true;
      }
    }

    return false;
  } catch (error) {
    logger.error(`Error checking existing indexes: ${error}`);
    return false;
  }
};

/**
 * Creates a single index with graceful handling of existing indexes
 */
const createIndexSafely = async (
  collection: mongoose.Collection,
  indexSpec: Record<string, number>,
  options: mongoose.IndexOptions & { name: string },
  collectionName: string,
): Promise<void> => {
  try {
    // Check if equivalent index already exists
    const indexExists = await checkIndexExists(collection, indexSpec);

    if (indexExists) {
      logger.info(
        `Index on ${JSON.stringify(indexSpec)} already exists in ${collectionName} collection`,
      );
      return;
    }

    // Create the index
    await collection.createIndex(indexSpec, options);
    logger.info(
      `Created index: ${options.name} on ${collectionName} collection`,
    );
  } catch (error: any) {
    // Handle specific "index already exists" errors gracefully
    if (error?.message?.includes('already exists')) {
      logger.info(
        `Index ${options.name} already exists in ${collectionName} collection (with different name)`,
      );
    } else {
      logger.error(
        `Error creating index ${options.name} on ${collectionName}: ${error.message}`,
      );
    }
  }
};

/**
 * Creates database indexes for optimized query performance
 * This should be called once during application startup
 */
export const createIndexes = async (): Promise<void> => {
  try {
    logger.info(
      'Checking and creating database indexes for performance optimization...',
    );

    // Order collection indexes
    const orderCollection = mongoose.connection.collection('orders');

    // Index for pending orders count: { creator_id: 1, status: 1 }
    await createIndexSafely(
      orderCollection,
      { creator_id: 1, status: 1 },
      {
        name: 'creator_status_idx',
        background: true,
      },
      'orders',
    );

    // Index for order lookups by ID and status: { _id: 1, status: 1 }
    await createIndexSafely(
      orderCollection,
      { _id: 1, status: 1 },
      {
        name: 'id_status_idx',
        background: true,
      },
      'orders',
    );

    // Community collection indexes
    const communityCollection = mongoose.connection.collection('communities');

    // Index for community lookups by group name (case insensitive)
    await createIndexSafely(
      communityCollection,
      { group: 1 },
      {
        name: 'group_idx',
        background: true,
        collation: { locale: 'en', strength: 2 }, // Case insensitive
      },
      'communities',
    );

    // Index for banned users lookup: { _id: 1, 'banned_users.id': 1 }
    await createIndexSafely(
      communityCollection,
      { _id: 1, 'banned_users.id': 1 },
      {
        name: 'community_banned_users_idx',
        background: true,
      },
      'communities',
    );

    // User collection index for default community lookups
    const userCollection = mongoose.connection.collection('users');

    // Index for user lookups by telegram ID: { tg_id: 1 }
    await createIndexSafely(
      userCollection,
      { tg_id: 1 },
      {
        name: 'tg_id_idx',
        background: true,
        unique: true,
      },
      'users',
    );

    logger.info('Database index creation check completed successfully');
  } catch (error) {
    logger.error(`Error in database index creation process: ${error}`);
    // Don't throw error to prevent app startup failure
  }
};
