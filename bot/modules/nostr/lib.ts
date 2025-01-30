import { nip19 } from 'nostr-tools';

export const decodeNpub = (npub: string) => {
  try {
    const { type, data } = nip19.decode(npub);
    if (type === 'npub') return data;
  } catch (err) {}
};
export const encodeNpub = (hex: string) => {
  return nip19.npubEncode(hex);
};
