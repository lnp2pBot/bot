const sinon = require('sinon');
const { expect } = require('chai');
const lightning = require('lightning');
const { parsePaymentRequest } = require('invoices');
const { mockCreateHodlResponseForLightning } = require('./mocks/lightningResponse');
const { createHoldInvoice } = require('../../ln');

describe('Lighting network', () => {
  it('Should create hold invoice', async () => {
    // We spy on the lighting service call
    const stub = sinon.stub(lightning, 'createHodlInvoice');
    // Then we test our internal lightning call
    stub.returns(mockCreateHodlResponseForLightning);
    const { hash, request } = await createHoldInvoice({
      description: 'Holis',
      amount: 200,
    });
    const invoice = parsePaymentRequest({ request });

    expect(hash).to.be.equal(mockCreateHodlResponseForLightning.id);
    expect(invoice.tokens).to.be.equal(mockCreateHodlResponseForLightning.tokens);
  });
});
