import { generateSecretKey, getPublicKey as nostrGetPublicKey } from 'nostr-tools';
import { SimplePool } from 'nostr-tools';

const nostrSkEnvVar = process.env.NOSTR_SK;
const sk = nostrSkEnvVar ? Buffer.from(nostrSkEnvVar, 'hex') : generateSecretKey();
const pk = nostrGetPublicKey(sk);

export const getPrivateKey = () => sk;
export const getPublicKey = () => pk;

export const pool = new SimplePool();
const relays = (env => {
  if (!env.RELAYS) return [];
  return env.RELAYS.split(',');
})(process.env);

export const addRelay = (relay: string) => {
  relays.push(relay);
  relays.map(relay => pool.ensureRelay(relay));
};
export const getRelays = () => relays;
