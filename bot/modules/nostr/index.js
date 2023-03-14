require('websocket-polyfill');
const Nostr = require('nostr-tools');
const logger = require('../../../logger');
const { userMiddleware } = require('../../middleware/user');
const { orderCreated } = require('./events');
const Config = require('./config');

const pool = new Nostr.SimplePool();
const relays = (env => {
  if (!env.RELAYS)
    return ['wss://nostr-pub.wellorder.net', 'wss://relay.damus.io'];
  return env.RELAYS.split(',');
})(process.env);
relays.map(relay => pool.ensureRelay(relay));

exports.addRelay = relay => {
  relays.push(relay);
  relays.map(relay => pool.ensureRelay(relay));
};
exports.getRelays = () => relays;

exports.configure = bot => {
  bot.command('nostr', async ctx => {
    try {
      const publicKey = Config.getPublicKey();
      if (!publicKey) return;
      const info = {
        publicKey,
        npub: Nostr.nip19.npubEncode(publicKey),
        relays: relays.map(r => `<code>${r}</code>`).join('\n'),
      };
      const str = ctx.i18n.t('nostr_info', info);
      await ctx.reply(str, { parse_mode: 'HTML' });
    } catch (err) {
      logger.error(err);
      return ctx.reply('Error');
    }
  });
  bot.command('setnpub', userMiddleware, async ctx => {
    try {
      const [, npub] = ctx.message.text.trim().split(' ');
      const { type, data } = Nostr.nip19.decode(npub);
      if (type !== 'npub') throw new Error('NpubNotValid');
      ctx.user.nostr_public_key = data;
      await ctx.user.save();
      await ctx.reply(ctx.i18n.t('user_npub_updated', { npub }));
    } catch (err) {
      return ctx.reply(ctx.i18n.t('npub_not_valid'), {
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      });
    }
  });
};

async function publish(relays, event) {
  const p = new Promise((resolve, reject) => {
    const pub = pool.publish(relays, event);
    pub.on('ok', () => resolve(event));
    pub.on('failed', reject);
  });
  return p;
}

exports.orderCreated = async order => {
  try {
    const event = orderCreated(order);
    await publish(relays, event);
    return event;
  } catch (err) {
    logger.warn(err);
  }
};
