const Nostr = require('nostr-tools');
const { logger } = require('../../../logger');
const Config = require('./config');

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
