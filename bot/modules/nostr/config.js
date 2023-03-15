const Nostr = require('nostr-tools');

const sk = process.env.NOSTR_SK || Nostr.generatePrivateKey();
const pk = Nostr.getPublicKey(sk);

exports.getPrivateKey = () => sk;
exports.getPublicKey = () => pk;

const pool = (exports.pool = new Nostr.SimplePool());
const relays = (env => {
  if (!env.RELAYS) return [];
  return env.RELAYS.split(',');
})(process.env);

exports.addRelay = relay => {
  relays.push(relay);
  relays.map(relay => pool.ensureRelay(relay));
};
exports.getRelays = () => relays;
