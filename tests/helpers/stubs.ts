export {};

const sinon = require('sinon');

/**
 * Shared test doubles for the pending-payment job specs. These specs load the
 * jobs through proxyquire with the same infrastructure stubs (logger, i18n),
 * so they live here instead of being copy-pasted per spec file.
 */

// Installs PAYMENT_ATTEMPTS for a suite and restores the previous value on
// teardown. The `delete` branch matters: assigning `undefined` to a process.env
// property coerces it to the *string* "undefined", which makes
// `process.env.PAYMENT_ATTEMPTS !== undefined` true and `parseInt` return NaN
// for every spec that runs later in the same mocha process.
export function usePaymentAttempts(value: string) {
  const original = process.env.PAYMENT_ATTEMPTS;

  beforeEach(() => {
    process.env.PAYMENT_ATTEMPTS = value;
  });

  afterEach(() => {
    if (original === undefined) delete process.env.PAYMENT_ATTEMPTS;
    else process.env.PAYMENT_ATTEMPTS = original;
    sinon.restore();
  });
}

// Silences winston so a failing assertion is not buried in job logs.
export function loggerStub() {
  return {
    logger: {
      info: sinon.stub(),
      error: sinon.stub(),
      warning: sinon.stub(),
      warn: sinon.stub(),
    },
  };
}

// Minimal i18n context: every key resolves to itself.
export function utilStub() {
  return {
    getUserI18nContext: sinon.stub().resolves({ t: (k: string) => k }),
  };
}
