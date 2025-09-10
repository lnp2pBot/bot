const { assert } = require('chai');
const sinon = require('sinon');
const proxyquire = require('proxyquire');

const getDetailedOrderStub = sinon.stub().returns('Mocked order detail');
const { disputeData } = proxyquire('../../../../bot/modules/dispute/messages', {
  '../../../util': { getDetailedOrder: getDetailedOrderStub },
});

// Mock dependencies
const mockTelegram = {
  sendMessage: sinon.stub(),
};

const mockI18n = {
  t: sinon.stub((key: string, params: any) => {
    switch (key) {
      case 'dispute_started_channel':
        return `User ${params.type} @${params.initiatorUser} TG ID: ${params.initiatorTgId}
                has started a dispute with @${params.counterPartyUser} TG ID: ${params.counterPartyUserTgId} for the order

                ${params.detailedOrder}

                Seller Token: ${params.sellerToken}
                Buyer Token: ${params.buyerToken}

                @${params.initiatorUser} has been involved in ${params.buyerDisputes} disputes
                @${params.counterPartyUser} has been involved in ${params.sellerDisputes} disputes`;
      case 'seller':
        return 'seller';
      case 'buyer':
        return 'buyer';
      case 'dispute_solver':
        return `Dispute taken by ${params.solver} with token ${params.token}`;
      default:
        return '';
    }
  }),
};

const mockCtx = {
  telegram: mockTelegram,
  i18n: mockI18n,
};

const mockOrder = {
  seller_dispute_token: 'seller_token',
  buyer_dispute_token: 'buyer_token',
};

const mockBuyerUnderscore = { username: 'buyer_user', tg_id: '246802' };
const mockBuyerNormal = { username: 'buyeruser', tg_id: '246802' };
const mockBuyerSpecial = { username: 'buyer-user', tg_id: '246802' };
const mockSeller = { username: 'seller_user', tg_id: '567890' };
const mockSolver = { username: 'solver', tg_id: '123456' };

describe('disputeData', () => {
  afterEach(() => {
    sinon.restore();
  });

  it('should send a message with escaped underscores in username', async () => {
    await disputeData(
      mockCtx,
      mockBuyerUnderscore,
      mockSeller,
      mockOrder,
      'buyer',
      mockSolver,
      5,
      3
    );

    assert.isTrue(
      mockTelegram.sendMessage.calledWith(
        mockSolver.tg_id,
        sinon.match(/buyer\\_user/),
        sinon.match({ parse_mode: 'MarkdownV2' })
      )
    );
  });

  it('should send a message with another escaped character in username', async () => {
    await disputeData(
      mockCtx,
      mockBuyerSpecial,
      mockSeller,
      mockOrder,
      'buyer',
      mockSolver,
      5,
      3
    );

    assert.isTrue(
      mockTelegram.sendMessage.calledWith(
        mockSolver.tg_id,
        sinon.match(/buyer\\-user/),
        sinon.match({ parse_mode: 'MarkdownV2' })
      )
    );
  });

  it('should send a message without underscores in usernames', async () => {
    await disputeData(
      mockCtx,
      mockBuyerNormal,
      mockSeller,
      mockOrder,
      'buyer',
      mockSolver,
      5,
      3
    );

    assert.isTrue(
      mockTelegram.sendMessage.calledWith(
        mockSolver.tg_id,
        sinon.match('buyeruser'),
        sinon.match({ parse_mode: 'MarkdownV2' })
      )
    );
  });

  it('should swap initiator and counterparty if initiator is seller', async () => {
    await disputeData(
      mockCtx,
      mockBuyerNormal,
      mockSeller,
      mockOrder,
      'seller',
      mockSolver,
      5,
      3
    );

    assert.isTrue(
      mockTelegram.sendMessage.calledWith(
        mockSolver.tg_id,
        sinon.match(/seller\\_user/),
        sinon.match({ parse_mode: 'MarkdownV2' })
      )
    );
  });
});
