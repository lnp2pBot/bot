export {};

const { expect } = require('chai');

const PendingPayment = require('../../models/pending_payment').default;

/**
 * Schema-level tests for issue #867. The job specs assert against plain
 * objects, so they cannot tell whether the field the code assigns actually
 * exists on the schema: mongoose silently drops unknown paths in strict mode,
 * which would make the job specs pass while nothing is persisted. These tests
 * close that gap by exercising the real model. No connection is opened —
 * instantiating a document and calling validateSync() is entirely in-memory.
 */
describe('PendingPayment.routing_fee (issue #867)', () => {
  it('is declared on the schema, so assignments are persisted', () => {
    expect(PendingPayment.schema.path('routing_fee')).to.not.equal(undefined);
  });

  it('defaults to 0 so documents created before the field read as free', () => {
    const pending = new PendingPayment({ amount: 500 });

    expect(pending.routing_fee).to.equal(0);
  });

  it('keeps an assigned fee and validates it', () => {
    const pending = new PendingPayment({ amount: 500 });
    pending.routing_fee = 9;

    expect(pending.routing_fee).to.equal(9);
    expect(pending.validateSync()).to.equal(undefined);
  });

  it('rejects a negative fee', () => {
    const pending = new PendingPayment({ amount: 500 });
    pending.routing_fee = -1;

    const error = pending.validateSync();
    expect(error).to.not.equal(undefined);
    expect(error.errors).to.have.property('routing_fee');
  });

  it('does not answer to `fee`, which means the platform commission elsewhere', () => {
    // Order.fee is the platform commission and Order.routing_fee is the
    // Lightning cost. Reusing `fee` here would give one name two meanings, so
    // the path must not exist: strict mode drops it.
    const pending = new PendingPayment({ amount: 500, fee: 9 });

    expect(PendingPayment.schema.path('fee')).to.equal(undefined);
    expect(pending.get('fee')).to.equal(undefined);
  });
});
