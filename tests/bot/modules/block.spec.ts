const { expect } = require('chai');
const sinon = require('sinon');
const proxyquire = require('proxyquire');

describe('Block Module block query', () => {
    let sandbox: any;
    let orderExistsStub: any;
    let blockExistsStub: any;
    let blockSaveStub: any;
    let userFindOneStub: any;
    let blockCmd: any;

    beforeEach(() => {
        sandbox = sinon.createSandbox();

        orderExistsStub = sandbox.stub();
        blockExistsStub = sandbox.stub();
        blockSaveStub = sandbox.stub().resolves();

        userFindOneStub = sandbox.stub().resolves({
            id: '2',
            tg_id: 2,
            username: 'badguy'
        });

        const blockModule = proxyquire('../../../bot/modules/block/commands', {
            '../../../models': {
                Order: { exists: orderExistsStub },
                Block: {
                    exists: blockExistsStub,
                },
                User: { findOne: userFindOneStub }
            },
            './messages': {
                ordersInProcess: sandbox.stub().resolves(),
                userAlreadyBlocked: sandbox.stub().resolves(),
                userBlocked: sandbox.stub().resolves(),
                blocklistEmptyMessage: sandbox.stub().resolves(),
                blocklistMessage: sandbox.stub().resolves(),
            },
            '../../messages': {
                notFoundUserMessage: sandbox.stub().resolves(),
            }
        });

        // We need to proxyquire the Block model constructor too, since `const block = new Block(...)` is used.
        // Instead of full proxyquire, let's just test the `Order.exists` query passed to it, as requested by the review.
        blockCmd = blockModule.block;
    });

    afterEach(() => {
        sandbox.restore();
    });

    it('should exclude settled orders from pending count when blocking', async () => {
        const ctx = {
            user: {
                id: '1',
                tg_id: 1,
                username: 'goodguy'
            }
        };

        orderExistsStub.resolves(false);
        blockExistsStub.resolves(false);

        // We stub Block constructor for the `new Block` call at the end
        const BlockMock = function (this: any) {
            this.save = blockSaveStub;
        };
        BlockMock.exists = blockExistsStub;

        const blockModuleFixed = proxyquire('../../../bot/modules/block/commands', {
            '../../../models': {
                Order: { exists: orderExistsStub },
                Block: BlockMock,
                User: { findOne: userFindOneStub }
            },
            './messages': {
                ordersInProcess: sandbox.stub().resolves(),
                userBlocked: sandbox.stub().resolves(),
            }
        });

        await blockModuleFixed.block(ctx, '@badguy');

        expect(orderExistsStub.calledOnce).to.be.true;

        const queryArgs = orderExistsStub.firstCall.args[0];

        // The review requires that we verify the query excludes settled orders from pending count
        // The query excludes these statuses using $nin. 
        // PAID_HOLD_INVOICE is one of them, which now represents completed orders along with settled_by_admin: true.
        expect(queryArgs.status.$nin).to.include('PAID_HOLD_INVOICE');
        expect(queryArgs.status.$nin).to.not.include('COMPLETED_BY_ADMIN');
    });
});
export { };
