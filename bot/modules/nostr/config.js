const Nostr = require('nostr-tools');

const sk = process.env.NOSTR_SK || Nostr.generatePrivateKey();
const pk = Nostr.getPublicKey(sk);

exports.getPrivateKey = () => sk;
exports.getPublicKey = () => pk;
