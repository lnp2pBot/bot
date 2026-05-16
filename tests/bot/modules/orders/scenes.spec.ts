const { expect } = require('chai');
const sinon = require('sinon');
const proxyquire = require('proxyquire');

// Mock models
const CommunityMock = {
  findById: sinon.stub(),
};

// Load scenes with mocked Community
const { createOrder } = proxyquire('../../../../bot/modules/orders/scenes', {
  '../../../models': {
    Community: CommunityMock,
  },
});

describe('Order Creation Wizard - Payment Methods', () => {
  let ctx: any;
  let sandbox: any;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    ctx = {
      i18n: {
        t: sandbox.stub().callsFake((key: string) => key),
      },
      wizard: {
        state: {
          user: { tg_id: '123' },
          community: null,
          updateUI: sandbox.stub().resolves(),
          // To reach 'method' step in step 0:
          currency: 'USD',
          fiatAmount: [100],
          sats: 1000,
          priceMargin: 0,
          method: undefined,
        },
        next: sandbox.stub(),
        selectStep: sandbox.stub(),
        cursor: 0,
      },
      scene: {
        leave: sandbox.stub().resolves(),
      },
      reply: sandbox.stub().resolves({ chat: { id: 1 }, message_id: 111 }),
      telegram: {
        deleteMessage: sandbox.stub().resolves(),
        editMessageReplyMarkup: sandbox.stub().resolves(),
        editMessageText: sandbox.stub().resolves(),
      },
      answerCbQuery: sandbox.stub().resolves(),
      deleteMessage: sandbox.stub().resolves(),
    };
    CommunityMock.findById.reset();
  });

  afterEach(() => {
    sandbox.restore();
  });

  const runStep0 = async (ctx: any) => {
    await createOrder.steps[0](ctx);
  };

  it('should prompt for custom text if community has no payment methods', async () => {
    // Community with no payment methods
    const community = {
      id: 'comm123',
      payment_methods: [],
    };
    ctx.wizard.state.community = community;

    await runStep0(ctx);

    expect(ctx.reply.calledWith('enter_payment_method')).to.equal(true);
    expect(ctx.wizard.next.calledOnce).to.equal(true);
    expect(ctx.wizard.state.handler).to.be.a('function');

    // Test the handler
    const handler = ctx.wizard.state.handler;
    const testCtx = {
      message: { text: 'Custom Method' },
      deleteMessage: sandbox.stub().resolves(),
      wizard: ctx.wizard,
      telegram: ctx.telegram,
    };

    await handler(testCtx);
    expect(ctx.wizard.state.method).to.equal('Custom Method');
  });

  it('should show keyboard if community has payment methods', async () => {
    const community = {
      id: 'comm123',
      payment_methods: ['Zelle', 'Bank Transfer'],
    };
    ctx.wizard.state.community = community;

    await runStep0(ctx);

    expect(ctx.reply.calledWith('select_payment_methods')).to.equal(true);
    expect(ctx.wizard.next.calledOnce).to.equal(true);
    expect(ctx.wizard.state.selectedMethods).to.deep.equal([]);
  });

  it('should handle multi-select and confirmation', async () => {
    const community = {
      id: 'comm123',
      payment_methods: ['Zelle', 'Bank Transfer'],
    };
    ctx.wizard.state.community = community;

    await runStep0(ctx);
    const handler = ctx.wizard.state.handler;

    // Simulate toggling Zelle
    await handler({
      callbackQuery: { data: 'pm_toggle_0' },
      answerCbQuery: ctx.answerCbQuery,
      telegram: ctx.telegram,
      wizard: ctx.wizard,
    });
    expect(ctx.wizard.state.selectedMethods).to.deep.equal(['Zelle']);

    // Simulate toggling Bank Transfer
    await handler({
      callbackQuery: { data: 'pm_toggle_1' },
      answerCbQuery: ctx.answerCbQuery,
      telegram: ctx.telegram,
      wizard: ctx.wizard,
    });
    expect(ctx.wizard.state.selectedMethods).to.deep.equal([
      'Zelle',
      'Bank Transfer',
    ]);

    // Confirm
    await handler({
      callbackQuery: { data: 'pm_confirm' },
      answerCbQuery: ctx.answerCbQuery,
      telegram: ctx.telegram,
      wizard: ctx.wizard,
      i18n: ctx.i18n,
    });
    expect(ctx.wizard.state.method).to.equal('Zelle, Bank Transfer');
  });

  it('should show error if confirmation with no selection', async () => {
    const community = {
      id: 'comm123',
      payment_methods: ['Zelle', 'Bank Transfer'],
    };
    ctx.wizard.state.community = community;

    await runStep0(ctx);
    const handler = ctx.wizard.state.handler;

    await handler({
      callbackQuery: { data: 'pm_confirm' },
      answerCbQuery: ctx.answerCbQuery,
      telegram: ctx.telegram,
      wizard: ctx.wizard,
      i18n: ctx.i18n,
    });

    expect(ctx.answerCbQuery.calledWith('no_payment_method_selected')).to.equal(
      true,
    );
    expect(ctx.wizard.state.method).to.equal(undefined);
  });

  it('should handle custom free-text fallback and clear selectedMethods', async () => {
    const community = {
      id: 'comm123',
      payment_methods: ['Zelle', 'Bank Transfer'],
    };
    ctx.wizard.state.community = community;

    await runStep0(ctx);
    const handler = ctx.wizard.state.handler;

    // First select something
    ctx.wizard.state.selectedMethods = ['Zelle'];

    // Then click custom
    await handler({
      callbackQuery: { data: 'pm_custom' },
      answerCbQuery: ctx.answerCbQuery,
      telegram: ctx.telegram,
      wizard: ctx.wizard,
      i18n: ctx.i18n,
      reply: ctx.reply,
    });

    expect(ctx.reply.calledWith('enter_payment_method')).to.equal(true);
    const customHandler = ctx.wizard.state.handler;
    expect(customHandler).to.not.equal(handler);

    // Enter custom text
    await customHandler({
      message: { text: 'Venmo' },
      deleteMessage: sandbox.stub().resolves(),
      wizard: ctx.wizard,
      telegram: ctx.telegram,
    });

    expect(ctx.wizard.state.method).to.equal('Venmo');
    expect(ctx.wizard.state.selectedMethods).to.deep.equal([]);
  });

  it('should clear selectedMethods on direct free-text input (fallback)', async () => {
    const community = {
      id: 'comm123',
      payment_methods: ['Zelle', 'Bank Transfer'],
    };
    ctx.wizard.state.community = community;

    await runStep0(ctx);
    const handler = ctx.wizard.state.handler;

    // First select something
    ctx.wizard.state.selectedMethods = ['Zelle'];

    // Send direct text message (instead of callback)
    await handler({
      message: { text: 'Direct Text' },
      deleteMessage: sandbox.stub().resolves(),
      wizard: ctx.wizard,
      telegram: ctx.telegram,
    });

    expect(ctx.wizard.state.method).to.equal('Direct Text');
    expect(ctx.wizard.state.selectedMethods).to.deep.equal([]);
  });
});
export {};
