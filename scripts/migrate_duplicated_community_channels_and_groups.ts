import 'dotenv/config';
import { connect as mongoConnect } from '../db_connect';
import { Community, User } from '../models';
import { Telegraf } from 'telegraf';
import { isGroupAdmin } from '../util';
import * as readline from 'readline';
import { logger } from '../logger';

const { BOT_TOKEN, MONGO_URI } = process.env;

if (!BOT_TOKEN) {
  console.error('BOT_TOKEN is missing');
  process.exit(1);
}

if (!MONGO_URI) {
  console.error('MONGO_URI is missing');
  process.exit(1);
}

const bot = new Telegraf(BOT_TOKEN);

export const runMigration = async () => {
  const mongoose = mongoConnect();
  await new Promise((resolve, reject) => {
    mongoose.connection.once('open', resolve);
    mongoose.connection.on('error', reject);
  });
  logger.info('Connected to database.');

  const communities = await Community.find({});
  const groupCounts: Record<string, number> = {};
  const disputeCounts: Record<string, number> = {};
  const orderChannelCounts: Record<string, number> = {};

  // Count occurrences
  communities.forEach(c => {
    if (c.group) {
      groupCounts[c.group] = (groupCounts[c.group] || 0) + 1;
    }
    if (c.dispute_channel) {
      disputeCounts[c.dispute_channel] =
        (disputeCounts[c.dispute_channel] || 0) + 1;
    }
    c.order_channels.forEach(ch => {
      if (ch.name) {
        orderChannelCounts[ch.name] = (orderChannelCounts[ch.name] || 0) + 1;
      }
    });
  });

  const duplicateGroups = Object.keys(groupCounts).filter(
    k => groupCounts[k] > 1,
  );
  const duplicateDispute = Object.keys(disputeCounts).filter(
    k => disputeCounts[k] > 1,
  );
  const duplicateOrderChannels = Object.keys(orderChannelCounts).filter(
    k => orderChannelCounts[k] > 1,
  );

  console.log(`Found ${duplicateGroups.length} duplicated groups.`);
  console.log(`Found ${duplicateDispute.length} duplicated dispute channels.`);
  console.log(
    `Found ${duplicateOrderChannels.length} duplicated order channels.`,
  );

  const affectedCommunities = new Set<string>();

  for (const c of communities) {
    const creator = await User.findById(c.creator_id);

    let modified = false;

    if (c.group && duplicateGroups.includes(c.group)) {
      const isAdmin = creator
        ? await isGroupAdmin(c.group, creator, bot.telegram)
        : { success: false };
      if (!isAdmin.success) {
        console.log(`Community ${c.name} (${c._id}) loses group ${c.group}`);
        c.group = undefined as any;
        modified = true;
      }
    }

    if (c.dispute_channel && duplicateDispute.includes(c.dispute_channel)) {
      const isAdmin = creator
        ? await isGroupAdmin(c.dispute_channel, creator, bot.telegram)
        : { success: false };
      if (!isAdmin.success) {
        console.log(
          `Community ${c.name} (${c._id}) loses dispute_channel ${c.dispute_channel}`,
        );
        c.dispute_channel = undefined as any;
        modified = true;
      }
    }

    let channelsModified = false;
    for (const ch of c.order_channels) {
      if (ch.name && duplicateOrderChannels.includes(ch.name)) {
        const isAdmin = creator
          ? await isGroupAdmin(ch.name, creator, bot.telegram)
          : { success: false };
        if (!isAdmin.success) {
          channelsModified = true;
          break;
        }
      }
    }

    if (channelsModified) {
      console.log(
        `Community ${c.name} (${c._id}) loses all order_channels due to conflict in one of them`,
      );
      for (const ch of c.order_channels) {
        ch.name = undefined as any;
      }
      modified = true;
    }

    if (modified) {
      affectedCommunities.add(c._id.toString());
    }
  }

  if (affectedCommunities.size === 0) {
    console.log('No modifications needed. Exiting.');
    process.exit(0);
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  rl.question(
    `\nType 'YES' to save changes to ${affectedCommunities.size} communities: `,
    async answer => {
      if (answer === 'YES') {
        console.log('Saving changes...');
        for (const c of communities) {
          if (affectedCommunities.has(c._id.toString())) {
            await c.save();
          }
        }
        console.log('Done.');
      } else {
        console.log('Aborted.');
      }
      rl.close();
      process.exit(0);
    },
  );
};

if (require.main === module) {
  runMigration().catch(console.error);
}
