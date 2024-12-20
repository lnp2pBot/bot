import { Telegraf } from 'telegraf';
import { MainContext } from '../bot/start';

import { Community, User, } from '../models';
import { ICommunity } from '../models/community';
import { logger } from '../logger';

const MAX_MESSAGES = 5; // Number of messages before disabling the community

const checkSolvers = async (bot: Telegraf<MainContext>) => {
  try {
    const communities = await Community.find({ is_disabled: false });

    for (const community of communities) {
        if (community.solvers.length > 0) {
            continue;
        } else {
            await notifyAdmin(community, bot);
        }
    }
  } catch (error) {
    const message = String(error);
    logger.error(`checkSolvers catch error: ${message}`);
  }
};

const notifyAdmin = async (community: ICommunity, bot: Telegraf<MainContext>) => {
  community.messages_sent_count += 1;
  // The community is disabled if the admin has received the maximum notification message to add a solver
  if (community.messages_sent_count >= MAX_MESSAGES) {
    community.is_disabled = true;
    await community.save();

    logger.info(`Community: ${community.name} has been disabled due to lack of solvers.`);
    return;
  }

  await community.save();
  const admin = await User.findOne({ tg_id: community.creator_id });

  if (admin) {
    await bot.telegram.sendMessage(
        admin.tg_id,
        `Your community ${community.name} doesn't have any solvers. Please add at least one solver to avoid being disabled.`
    );
  }
}

export default checkSolvers;
