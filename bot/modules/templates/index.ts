import { Telegraf } from 'telegraf';
import { CommunityContext } from '../community/communityContext';
import { userMiddleware } from '../../middleware';
import * as templatesScenes from './scenes';

export const configure = (bot: Telegraf<CommunityContext>) => {
  bot.command('templates', userMiddleware, async ctx => {
    await ctx.scene.enter(templatesScenes.TEMPLATES_WIZARD, {
      user: ctx.user,
    });
  });

  // Note: Actions like 'create_template', 'publish_tpl_', etc.
  // are now handled locally within the TEMPLATES_WIZARD scene.
};
