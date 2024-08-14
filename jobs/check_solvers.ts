import { Community, User } from '../models';
import { Telegraf } from 'telegraf';
import { MainContext } from '../bot/start';
import { logger } from '../logger';

const MESSAGES: number = parseInt(process.env.COMMUNITY_MESSAGES || '5');

exports.checkSolvers = async (ctx: MainContext, bot: Telegraf<MainContext>): Promise<void> => {
    try {
        const communities = await Community.find({ isDisabled: false });

        for (const community of communities) {
            const solvers = await User.find({ default_community_id: community._id, role: 'solver' });

            if (solvers.length === 0) {
                community.messagesSent += 1;

                if (community.messagesSent >= MESSAGES) {
                    community.isDisabled = true;
                    await community.save();
                    logger.info(`Community ${community._id} has been disabled due to lack of solvers.`);
                } else {
                    await community.save();
                    const admin = await User.findOne({ tg_id: community.creator_id, admin: true });
                    if (admin) {
                        await bot.telegram.sendMessage(admin.tg_id, ctx.i18n.t('check_solvers'));
                    }
                }
            } else {
                community.messagesSent = 0; // Reset the counter if solvers are added
                await community.save();
            }
        }
    } catch (error) {
        logger.error(error);
    }
};
