const { getPublicKey, generateSecretKey } = require('nostr-tools/pure');
const { SimplePool } = require('nostr-tools/pool');

const sk = process.env.NOSTR_SK || generateSecretKey();
const pk = getPublicKey(sk);

exports.getPrivateKey = () => sk;
exports.getPublicKey = () => pk;

const pool = (exports.pool = new SimplePool());
const relays = (env => {
  if (!env.RELAYS) return [];
  return env.RELAYS.split(',');
})(process.env);

exports.addRelay = relay => {
  relays.push(relay);
  relays.map(relay => pool.ensureRelay(relay));
};
exports.getRelays = () => relays;
