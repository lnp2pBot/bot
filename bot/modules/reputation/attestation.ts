// Building a reputation attestation (kind 38388): a Nostr event the bot signs
// with its dedicated issuer key, stating the reputation a user earned here and
// addressed to one Mostro identity. It is never published to relays; the user
// carries it to a Mostro instance. Rules:
// https://mostro.network/protocol/reputation_attestation.html
import { finalizeEvent, VerifiedEvent } from 'nostr-tools';

export const ATTESTATION_KIND = 38388;
export const ATTESTATION_DOCUMENT = 'reputation-attestation';

const MIN_REVIEWS = 5;
const MIN_SINCE = 1577836800; // 2020-01-01
const SECONDS_PER_DAY = 24 * 60 * 60;
const SUBJECT = /^[0-9A-Za-z_-]{1,64}$/;
const HEX_KEY = /^[0-9a-f]{64}$/;
const BASE64URL_KEY = /^[A-Za-z0-9_-]{43}$/;

/**
 * A destination identity as it travels in the Telegram start parameter: 32
 * bytes as 43 characters of unpadded base64url. Returns the key as 64
 * lowercase hex characters, or `null` when the text is not one.
 */
export const decodeIdentity = (text: string): string | null => {
  if (!BASE64URL_KEY.test(text)) return null;
  const bytes = Buffer.from(text, 'base64url');
  if (bytes.length !== 32 || bytes.toString('base64url') !== text) return null;
  return bytes.toString('hex');
};

/** The inverse of {@link decodeIdentity}. */
export const encodeIdentity = (hex: string): string =>
  Buffer.from(hex, 'hex').toString('base64url');

/**
 * The `rating` written for an internal average, in hundredths:
 * `clamp(round(average × 100), 100, 500)` on the double, rounding half away
 * from zero (`Math.round` does, for the non-negative values a rating takes).
 * `null` for a non-finite average.
 */
export const ratingHundredths = (average: number): number | null => {
  if (!Number.isFinite(average)) return null;
  return Math.min(500, Math.max(100, Math.round(average * 100)));
};

/** A rating in hundredths, written with exactly two decimals. */
export const formatRating = (hundredths: number): string =>
  `${Math.floor(hundredths / 100)}.${String(hundredths % 100).padStart(2, '0')}`;

export interface AttestationInput {
  /** Destination identity, 64 lowercase hex characters. */
  destination: string;
  /** The source account: the user's internal id, never the Telegram id. */
  subject: string;
  /** Ratings received. */
  reviews: number;
  /** Their average. */
  average: number;
  /** UTC day start of the first completed trade, in Unix seconds. */
  since: number;
  /** Signing time, in Unix seconds. */
  createdAt: number;
  /** Seconds until it expires. */
  lifetime: number;
}

/**
 * Sign an attestation. Throws on an argument that would produce an event a
 * Mostro instance refuses, so a returned attestation is always importable
 * while it lives.
 */
export const buildAttestation = (
  issuerKey: Uint8Array,
  input: AttestationInput,
): VerifiedEvent => {
  const { destination, subject, reviews, average, since, createdAt, lifetime } =
    input;
  if (!HEX_KEY.test(destination)) throw new Error('invalid destination');
  if (!SUBJECT.test(subject)) throw new Error('invalid subject');
  if (
    !Number.isInteger(reviews) ||
    reviews < MIN_REVIEWS ||
    reviews > 0xffffffff
  )
    throw new Error('invalid reviews');
  const hundredths = ratingHundredths(average);
  if (hundredths === null) throw new Error('invalid average');
  if (
    !Number.isInteger(since) ||
    since % SECONDS_PER_DAY !== 0 ||
    since < MIN_SINCE ||
    since > createdAt
  )
    throw new Error('invalid since');
  if (!Number.isInteger(lifetime) || lifetime <= 0)
    throw new Error('invalid lifetime');
  return finalizeEvent(
    {
      kind: ATTESTATION_KIND,
      created_at: createdAt,
      tags: [
        ['p', destination],
        ['subject', subject],
        ['reviews', String(reviews)],
        ['rating', formatRating(hundredths)],
        ['since', String(since)],
        ['expiration', String(createdAt + lifetime)],
        ['z', ATTESTATION_DOCUMENT],
      ],
      content: '',
    },
    issuerKey,
  );
};
