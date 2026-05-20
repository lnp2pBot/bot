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
      c.order_channels = [] as any;
      modified = true;
    }

    if (modified) {
      affectedCommunities.add(c._id.toString());
    }
  }
  // Re-check for remaining duplicates
  const finalGroupCounts: Record<string, typeof communities> = {};
  const finalDisputeCounts: Record<string, typeof communities> = {};
  const finalOrderChannelCounts: Record<string, typeof communities> = {};

  for (const c of communities) {
    if (c.group) {
      if (!finalGroupCounts[c.group]) finalGroupCounts[c.group] = [];
      finalGroupCounts[c.group].push(c);
    }
    if (c.dispute_channel) {
      if (!finalDisputeCounts[c.dispute_channel])
        finalDisputeCounts[c.dispute_channel] = [];
      finalDisputeCounts[c.dispute_channel].push(c);
    }
    for (const ch of c.order_channels) {
      if (ch.name) {
        if (!finalOrderChannelCounts[ch.name])
          finalOrderChannelCounts[ch.name] = [];
        finalOrderChannelCounts[ch.name].push(c);
      }
    }
  }

  const remainingDuplicateGroups = Object.entries(finalGroupCounts).filter(
    ([_, comms]) => comms.length > 1,
  );
  const remainingDuplicateDisputes = Object.entries(finalDisputeCounts).filter(
    ([_, comms]) => comms.length > 1,
  );
  const remainingDuplicateOrderChannels = Object.entries(
    finalOrderChannelCounts,
  ).filter(([_, comms]) => comms.length > 1);

  if (
    affectedCommunities.size === 0 &&
    remainingDuplicateGroups.length === 0 &&
    remainingDuplicateDisputes.length === 0 &&
    remainingDuplicateOrderChannels.length === 0
  ) {
    console.log('No modifications needed. Exiting.');
    process.exit(0);
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const question = (query: string): Promise<string> =>
    new Promise(resolve => rl.question(query, resolve));

  if (
    remainingDuplicateGroups.length > 0 ||
    remainingDuplicateDisputes.length > 0 ||
    remainingDuplicateOrderChannels.length > 0
  ) {
    console.log('\n--- Manual Resolution for Remaining Duplicates ---');
  }

  for (const [group, comms] of remainingDuplicateGroups) {
    console.log(`\nGroup ${group} is still duplicated in communities:`);
    comms.forEach((c, idx) => console.log(`${idx + 1}. ${c.name} (${c._id})`));
    const answer = await question(
      `Enter the number of the community that should KEEP the group ${group} (or press Enter to make all loose the group): `,
    );
    const keepIdx = parseInt(answer) - 1;
    if (!isNaN(keepIdx) && comms[keepIdx]) {
      comms.forEach((c, idx) => {
        if (idx !== keepIdx) {
          console.log(`Community ${c.name} (${c._id}) loses group ${group}`);
          c.group = undefined as any;
          affectedCommunities.add(c._id.toString());
        }
      });
    } else {
      comms.forEach(c => {
        console.log(`Community ${c.name} (${c._id}) loses group ${group}`);
        c.group = undefined as any;
        affectedCommunities.add(c._id.toString());
      });
    }
  }

  for (const [channel, comms] of remainingDuplicateDisputes) {
    console.log(
      `\nDispute channel ${channel} is still duplicated in communities:`,
    );
    comms.forEach((c, idx) => console.log(`${idx + 1}. ${c.name} (${c._id})`));
    const answer = await question(
      `Enter the number of the community that should KEEP the dispute channel ${channel} (or press Enter to make all loose the channel): `,
    );
    const keepIdx = parseInt(answer) - 1;
    if (!isNaN(keepIdx) && comms[keepIdx]) {
      comms.forEach((c, idx) => {
        if (idx !== keepIdx) {
          console.log(
            `Community ${c.name} (${c._id}) loses dispute_channel ${channel}`,
          );
          c.dispute_channel = undefined as any;
          affectedCommunities.add(c._id.toString());
        }
      });
    } else {
      comms.forEach(c => {
        console.log(
          `Community ${c.name} (${c._id}) loses dispute_channel ${channel}`,
        );
        c.dispute_channel = undefined as any;
        affectedCommunities.add(c._id.toString());
      });
    }
  }

  for (const [channel, comms] of remainingDuplicateOrderChannels) {
    console.log(
      `\nOrder channel ${channel} is still duplicated in communities:`,
    );
    comms.forEach((c, idx) => console.log(`${idx + 1}. ${c.name} (${c._id})`));
    const answer = await question(
      `Enter the number of the community that should KEEP the order channel ${channel} (or press Enter make all loose the channels): `,
    );
    const keepIdx = parseInt(answer) - 1;
    if (!isNaN(keepIdx) && comms[keepIdx]) {
      comms.forEach((c, idx) => {
        if (idx !== keepIdx) {
          console.log(
            `Community ${c.name} (${c._id}) loses all order_channels due to conflict in ${channel}`,
          );
          c.order_channels = [] as any;
          affectedCommunities.add(c._id.toString());
        }
      });
    } else {
      comms.forEach(c => {
        console.log(
          `Community ${c.name} (${c._id}) loses all order_channels due to conflict in ${channel}`,
        );
        c.order_channels = [] as any;
        affectedCommunities.add(c._id.toString());
      });
    }
  }


  const answer = await question(
    `\nType 'YES' to save changes to ${affectedCommunities.size} communities: `,
  );
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
};

if (require.main === module) {
  runMigration().catch(console.error);
}
