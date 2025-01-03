import { Telegraf } from 'telegraf';
import { MainContext } from '../bot/start';

import { Community, User, } from '../models';
import { ICommunity } from '../models/community';
import { logger } from '../logger';
import { I18nContext } from '@grammyjs/i18n';
import { getUserI18nContext } from '../util';


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
  if (community.messages_sent_count >= Number(process.env.MAX_MESSAGES)) {
    community.is_disabled = true;
    await community.save();

    logger.info(`Community: ${community.name} has been disabled due to lack of solvers.`);
    return;
  }

  await community.save();
  const admin = await User.findById(community.creator_id);

  if (admin) {
    const i18nCtx: I18nContext = await getUserI18nContext(admin);

    await bot.telegram.sendMessage(
      admin.tg_id,
      i18nCtx.t('check_solvers', { communityName: community.name })
    );
  }
}

export default checkSolvers;
