const { Scenes } = require('telegraf');
module.exports = () => {
  const scene = new Scenes.WizardScene('COMMUNITY_ADMIN', async ctx => {
    const { community } = ctx.scene.state;
    const str = ctx.i18n.t('community_admin', { community });
    await ctx.reply(str, { parse_mode: 'HTML' });
  });

  scene.command('/help', async ctx => {
    const str = ctx.i18n.t('community_admin_help');
    await ctx.reply(str, { parse_mode: 'HTML' });
  });

  scene.command('/setnpub', async ctx => {
    try {
      const NostrLib = require('../nostr/lib');
      const [, npub] = ctx.message.text.trim().split(' ');
      const hex = NostrLib.decodeNpub(npub);
      if (!hex) throw new Error('NpubNotValid');
      const { community } = ctx.scene.state;
      community.nostr_public_key = hex;
      await community.save();
      await ctx.reply(ctx.i18n.t('community_npub_updated', { npub }));
    } catch (err) {
      return ctx.reply(ctx.i18n.t('npub_not_valid'), {
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      });
    }
  });

  return scene;
};
