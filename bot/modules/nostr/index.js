//@ts-check
const Nostr = require('nostr-tools');
const logger = require('../../../logger');
const { userMiddleware } = require('../../middleware/user');
const { orderCreated } = require('./events');

const pool = new Nostr.SimplePool();
const relays = ['wss://nostr-pub.wellorder.net', 'wss://relay.damus.io'];

exports.addRelay = relay => relays.push(relay);
exports.getRelays = () => relays;

exports.configure = bot => {
  if (!process.env.NOSTR_SK || !process.env.NOSTR_PK) {
    console.warn('env.NOSTR_SK/env.NOSTR_PK not set');
    return;
  }
  bot.command('nostr', async ctx => {
    const publicKey = process.env.NOSTR_PK;
    if (!publicKey) return;
    const info = {
      publicKey,
      npub: Nostr.nip19.npubEncode(publicKey),
      relays,
    };
    await ctx.reply(JSON.stringify(info));
  });
  bot.command('setnpub', userMiddleware, async ctx => {
    try {
      const npub = ctx.message.text.trim();
      const { type, data } = Nostr.nip19.decode(npub);
      if (type !== 'npub') throw new Error('InvalidNpub');
      ctx.user.nostrPublicKey = data;
      await ctx.user.save();
      await ctx.reply(`user.npub = ${npub}`);
    } catch (err) {
      logger.error(err);
      return ctx.reply('Error');
    }
  });
};

async function publish(relays, event) {
  const p = new Promise(resolve => {
    const pub = pool.publish(relays, event);
    pub.on('ok', () => resolve(event));
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
