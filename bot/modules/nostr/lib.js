const Nostr = require('nostr-tools');

exports.decodeNpub = npub => {
  try {
    const { type, data } = Nostr.nip19.decode(npub);
    if (type === 'npub') return data;
  } catch (err) {}
};
