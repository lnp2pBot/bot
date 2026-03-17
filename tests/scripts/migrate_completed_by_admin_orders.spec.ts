const { expect } = require('chai');
const sinon = require('sinon');
const proxyquire = require('proxyquire');

describe('Migration Script: migrate_completed_by_admin_orders', () => {
    let sandbox: any;
    let updateManyStub: any;
    let exitStub: any;
    let infoStub: any;
    let errorStub: any;

    beforeEach(() => {
        sandbox = sinon.createSandbox();

        updateManyStub = sandbox.stub().resolves({
            matchedCount: 2,
            modifiedCount: 2,
        });

        // Mock logger
        infoStub = sandbox.stub();
        errorStub = sandbox.stub();

        // Mock process.exit
        exitStub = sandbox.stub(process, 'exit');
    });

    afterEach(() => {
        sandbox.restore();
    });

    it('should migrate COMPLETED_BY_ADMIN orders to PAID_HOLD_INVOICE + settled_by_admin', async () => {
        // We proxyquire the script to inject mocks
        proxyquire('../../scripts/migrate_completed_by_admin_orders', {
            '../db_connect': {
                connect: sandbox.stub().returns({
                    connection: {
                        once: sandbox.stub().callsFake((event: any, cb: any) => {
                            if (event === 'open') cb();
                        }),
                        on: sandbox.stub(),
                        close: sandbox.stub().resolves(),
                    },
                }),
            },
            '../models/order': {
                default: {
                    updateMany: updateManyStub,
                },
            },
            '../logger': {
                logger: {
                    info: infoStub,
                    error: errorStub,
                },
            },
        });

        // We need to wait a tick for the async immediately-invoked function to resolve
        await new Promise(resolve => setTimeout(resolve, 10));

        expect(updateManyStub.calledOnce).to.equal(true);

        const [query, update] = updateManyStub.firstCall.args;

        // Verify query
        expect(query).to.deep.equal({ status: 'COMPLETED_BY_ADMIN' });

        // Verify update
        expect(update).to.deep.equal({
            $set: {
                status: 'PAID_HOLD_INVOICE',
                settled_by_admin: true,
            },
        });

        expect(exitStub.calledWith(0)).to.equal(true);
    });
});

export { };
