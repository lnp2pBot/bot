import { Community, User } from '../models';
import { Telegraf } from 'telegraf';
import { MainContext } from '../bot/start';
import { logger } from '../logger';

const MAX_MESSAGES = 5; // Number of messages before disabling the community

exports.checkSolvers = async (bot: Telegraf<MainContext>): Promise<void> => {
    try {
        const communities = await Community.find({ isDisabled: false });

        for (const community of communities) {
            const solvers = await User.find({ default_community_id: community._id, role: 'solver' });

            if (solvers.length === 0) {
                community.messagesSent += 1;

                if (community.messagesSent >= MAX_MESSAGES) {
                    community.isDisabled = true;
                    await community.save();
                    logger.info(`Community ${community._id} has been disabled due to lack of solvers.`);
                } else {
                    await community.save();
                    const admin = await User.findOne({ tg_id: community.creator_id, admin: true });
                    if (admin) {
                        await bot.telegram.sendMessage(
                            admin.tg_id,
                            `Your community ${community.name} doesn't have any solvers. Please add at least one solver.`
                        );
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
