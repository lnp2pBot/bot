const Nostr = require('nostr-tools');
const logger = require('../../../logger');
const Config = require('./config');
const { decodeNpub } = require('./lib');

exports.info = async ctx => {
  try {
    const publicKey = Config.getPublicKey();
    if (!publicKey) return;
    const info = {
      publicKey,
      npub: Nostr.nip19.npubEncode(publicKey),
      relays: Config.getRelays()
        .map(r => `<code>${r}</code>`)
        .join('\n'),
    };
    const str = ctx.i18n.t('nostr_info', info);
    await ctx.reply(str, { parse_mode: 'HTML' });
  } catch (err) {
    logger.error(err);
    return ctx.reply('Error');
  }
};

exports.setUserNpub = async ctx => {
  try {
    const [, npub] = ctx.message.text.trim().split(' ');
    const hex = decodeNpub(npub);
    if (!hex) throw new Error('NpubNotValid');
    ctx.user.nostr_public_key = hex;
    await ctx.user.save();
    await ctx.reply(ctx.i18n.t('user_npub_updated', { npub }));
  } catch (err) {
    return ctx.reply(ctx.i18n.t('npub_not_valid'), {
      parse_mode: 'HTML',
      disable_web_page_preview: true,
    });
  }
};
