/**
 * Tests for getPaymentStatus in ln/pay_request.ts.
 *
 * The key security property: unknown/transient LND errors must FAIL CLOSED
 * (return is_pending: true) so the caller never attempts a double-pay when
 * LND is temporarily unreachable. Only a definitive "not found" (404 /
 * SentPaymentNotFound) should return all-false (safe to pay).
 */

import { getPaymentStatus } from '../../ln/pay_request';

const { expect } = require('chai');
const sinon = require('sinon');
const lightning = require('lightning');
const crypto = require('crypto');
const ecc = require('tiny-secp256k1');
const { createUnsignedRequest, createSignedRequest } = require('invoices');

function makeInvoice(tokens = 1000): string {
  const priv = crypto.randomBytes(32);
  const destination = Buffer.from(ecc.pointFromScalar(priv, true)).toString(
    'hex',
  );
  const id = crypto.randomBytes(32).toString('hex');
  const unsigned = createUnsignedRequest({
    network: 'bitcoin',
    id,
    tokens,
    description: 'test',
    created_at: new Date().toISOString(),
  });
  const { signature } = ecc.signRecoverable(
    Buffer.from(unsigned.hash, 'hex'),
    priv,
  );
  const signed = createSignedRequest({
    destination,
    hrp: unsigned.hrp,
    signature: Buffer.from(signature).toString('hex'),
    tags: unsigned.tags,
  });
  return signed.request;
}

describe('getPaymentStatus', () => {
  let getPaymentStub: any;
  let invoice: string;

  beforeEach(() => {
    invoice = makeInvoice();
    getPaymentStub = sinon.stub(lightning, 'getPayment');
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('not-found detection (safe to pay)', () => {
    it('returns all-false when LND throws [404, "SentPaymentNotFound"] array', async () => {
      getPaymentStub.rejects([404, 'SentPaymentNotFound', {}]);

      const result = await getPaymentStatus(invoice);

      expect(result.is_confirmed).to.equal(false);
      expect(result.is_pending).to.equal(false);
    });

    it('returns all-false when error code is 404 with different message', async () => {
      getPaymentStub.rejects([404, 'PaymentNotFound', {}]);

      const result = await getPaymentStatus(invoice);

      expect(result.is_confirmed).to.equal(false);
      expect(result.is_pending).to.equal(false);
    });

    it('returns all-false when error message contains SentPaymentNotFound (non-array error)', async () => {
      getPaymentStub.rejects(new Error('SentPaymentNotFound'));

      const result = await getPaymentStatus(invoice);

      expect(result.is_confirmed).to.equal(false);
      expect(result.is_pending).to.equal(false);
    });

    it('returns all-false when error message contains PaymentNotFound', async () => {
      getPaymentStub.rejects(new Error('PaymentNotFound: no such payment'));

      const result = await getPaymentStatus(invoice);

      expect(result.is_confirmed).to.equal(false);
      expect(result.is_pending).to.equal(false);
    });
  });

  describe('fail-closed on unknown errors (must NOT double-pay)', () => {
    it('returns is_pending: true on a 503 gRPC error', async () => {
      getPaymentStub.rejects([503, 'ServiceUnavailable', {}]);

      const result = await getPaymentStatus(invoice);

      expect(result.is_confirmed).to.equal(false);
      expect(result.is_pending).to.equal(
        true,
        'a 503 must be treated as pending so the caller skips the retry — ' +
          'returning false here would allow a double-pay when LND is momentarily unreachable',
      );
    });

    it('returns is_pending: true on a generic network error', async () => {
      getPaymentStub.rejects(new Error('connection refused'));

      const result = await getPaymentStatus(invoice);

      expect(result.is_pending).to.equal(true);
      expect(result.is_confirmed).to.equal(false);
    });

    it('returns is_pending: true on an unknown numeric code that is not 404', async () => {
      getPaymentStub.rejects([14, 'Unavailable', {}]);

      const result = await getPaymentStatus(invoice);

      expect(result.is_pending).to.equal(true);
      expect(result.is_confirmed).to.equal(false);
    });
  });

  describe('happy-path responses', () => {
    it('returns is_confirmed: true with payment object when LND confirms', async () => {
      const fakePayment = {
        confirmed_at: new Date().toISOString(),
        fee: 5,
        id: 'abc123',
        secret: 'deadsecret',
      };
      getPaymentStub.resolves({ is_confirmed: true, payment: fakePayment });

      const result = await getPaymentStatus(invoice);

      expect(result.is_confirmed).to.equal(true);
      expect(result.is_pending).to.equal(false);
      expect(result.payment).to.deep.include({ fee: 5, id: 'abc123' });
    });

    it('returns is_pending: true when LND says payment is in-flight', async () => {
      getPaymentStub.resolves({ is_pending: true });

      const result = await getPaymentStatus(invoice);

      expect(result.is_pending).to.equal(true);
      expect(result.is_confirmed).to.equal(false);
    });

    it('returns all-false for empty request without calling LND', async () => {
      const result = await getPaymentStatus('');

      expect(result.is_confirmed).to.equal(false);
      expect(result.is_pending).to.equal(false);
      expect(getPaymentStub.called).to.equal(false);
    });
  });
});

export {};
