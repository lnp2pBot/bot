const sinon = require('sinon');
const { expect } = require('chai');
import lightning from 'lightning';
const { parsePaymentRequest } = require('invoices');
import { mockCreateHodlResponseForLightning } from './mocks/lightningResponse';
const { createHoldInvoice } = require('../../ln');

describe('Lighting network', () => {
  it('Should create hold invoice', async () => {
    // We spy on the lighting service call
    const stub = sinon.stub(lightning, 'createHodlInvoice') as any;
    // Then we test our internal lightning call
    stub.returns(mockCreateHodlResponseForLightning);
    const createHoldInvoiceResult = await createHoldInvoice({
      description: 'Holis',
      amount: 200,
    });
    if(createHoldInvoiceResult == null) throw new Error("createHoldInvoiceResult is null");
    const { hash, request } = createHoldInvoiceResult;
    const invoice = parsePaymentRequest({ request });

    expect(hash).to.be.equal(mockCreateHodlResponseForLightning.id);
    expect(invoice.tokens).to.be.equal(mockCreateHodlResponseForLightning.tokens);
  });
});
