const sinon = require("sinon");
const expect = require("chai").expect;
const lightning = require('lightning');
const { parsePaymentRequest } = require("invoices");
const { createHodlInvoiceResponse } = require("./lightningResponse");
const { createHoldInvoice } = require("../ln");

describe("Testing lighting network", () => {
    it("Should create hold invoice", async () => {
        // We spy on the lighting service call
        const stub = sinon.stub(lightning, "createHodlInvoice");
        // Then we test our internal lightning call
        stub.returns(createHodlInvoiceResponse);
        const { hash, request } = await createHoldInvoice({
            description: "Holis",
            amount: 200,
        });
        const invoice = parsePaymentRequest({ request });

        expect(hash).to.be.equal(createHodlInvoiceResponse.id);
        expect(invoice.tokens).to.be.equal(createHodlInvoiceResponse.tokens);
    });
});