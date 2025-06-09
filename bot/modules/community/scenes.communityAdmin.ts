import { Scenes } from 'telegraf';
import { CommunityContext } from './communityContext';

import * as CommunityEvents from '../events/community';

const communityAdmin = () => {
  const scene = new Scenes.WizardScene(
    'COMMUNITY_ADMIN',
    async (ctx: CommunityContext) => {
      const { community } = ctx.scene.state as any;
      const str = ctx.i18n.t('community_admin', { community });
      await ctx.reply(str, { parse_mode: 'HTML' });
    },
  );

  scene.command('/help', async ctx => {
    const str = ctx.i18n.t('community_admin_help');
    await ctx.reply(str, { parse_mode: 'HTML' });
  });

  scene.command('/setnpub', async (ctx: CommunityContext) => {
    try {
      const NostrLib = require('../nostr/lib');
      const [, npub] = ctx.message!.text.trim().split(' ');
      const hex = NostrLib.decodeNpub(npub);
      if (!hex) throw new Error('NpubNotValid');
      const { community } = ctx.scene.state as any;
      community.nostr_public_key = hex;
      await community.save();
      await ctx.reply(ctx.i18n.t('community_npub_updated', { npub }));
      CommunityEvents.communityUpdated(community);
    } catch (err) {
      return ctx.reply(ctx.i18n.t('npub_not_valid'), {
        parse_mode: 'HTML',
        link_preview_options: { is_disabled: true },
      } as any);
    }
  });

  scene.command('/setlanguage', async (ctx: CommunityContext) => {
    try {
      const [, language] = ctx.message!.text.trim().split(' ');
      const lang = language?.toLowerCase();
      
      // Check if language is valid
      const validLanguages = ['en', 'es', 'fr', 'de', 'it', 'pt', 'ru', 'uk', 'ko', 'fa'];
      if (!lang || !validLanguages.includes(lang)) {
        return ctx.reply(ctx.i18n.t('wizard_community_invalid_language'));
      }
      
      const { community } = ctx.scene.state as any;
      community.language = lang;
      await community.save();
      await ctx.reply(ctx.i18n.t('community_language_updated', { language: lang }));
      CommunityEvents.communityUpdated(community);
    } catch (err) {
      return ctx.reply(ctx.i18n.t('generic_error'));
    }
  });

  return scene;
};

export { communityAdmin };
