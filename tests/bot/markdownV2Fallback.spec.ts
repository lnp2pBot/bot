export {};

const { expect } = require('chai');
const sinon = require('sinon');
const proxyquire = require('proxyquire').noCallThru();

// Issue #882: a single unescaped MarkdownV2 reserved character in a translation
// makes Telegram reject the "you took someone's order" message. Because the
// follow-up message carrying the Continue/Cancel buttons is sent right after,
// losing the first send also left the taker without any way to act on the order.
// The send now falls back to plain text so both messages get through.

const utilMock = {
  secondsToTime: () => ({ hours: 23, minutes: 0 }),
  holdInvoiceExpirationInSecs: () => ({
    expirationTimeInSecs: 86400,
    safetyWindowInSecs: 3600,
  }),
  getCurrency: () => ({ symbol_native: '$' }),
  numberFormat: (_c: string, n: number) => String(n),
  getDetailedOrder: sinon.stub().returns(''),
  getOrderChannel: sinon.stub().resolves(''),
  sanitizeMD: (x: string) => x,
  getEmojiRate: () => '',
  decimalRound: (x: number) => x,
  getUserAge: () => 0,
  getStars: () => '',
  generateQRWithImage: sinon.stub().resolves(Buffer.from('')),
};

const { beginTakeSellMessage } = proxyquire('../../bot/messages', {
  '../util': utilMock,
  '../util/imageCache': { imageCache: { convertImageToBase64: sinon.stub() } },
});

const BUYER = { tg_id: '111', lang: 'fa' };
const ORDER = { _id: 'order123' };

// ctx whose locale is Persian, mirroring the reported scenario.
const makeCtx = () => ({
  i18n: { t: (k: string) => k, locale: () => 'fa' },
});

describe('MarkdownV2 send falls back to plain text (#882)', () => {
  it('retries as plain text and still delivers the action buttons', async () => {
    const sendMessage = sinon.stub();
    // First call is the MarkdownV2 one: Telegram rejects the formatting.
    sendMessage
      .onFirstCall()
      .rejects(new Error("Bad Request: can't parse entities"));
    sendMessage.resolves();
    const bot: any = { telegram: { sendMessage } };

    await beginTakeSellMessage(makeCtx() as any, bot, BUYER as any, ORDER);

    // 1) MarkdownV2 attempt, 2) plain-text retry, 3) buttons
    expect(sendMessage.callCount).to.equal(3);

    // The retry carries the same text without parse_mode
    const [firstArgs, retryArgs] = [
      sendMessage.getCall(0).args,
      sendMessage.getCall(1).args,
    ];
    expect(firstArgs[2]).to.deep.equal({ parse_mode: 'MarkdownV2' });
    expect(retryArgs[1]).to.equal(firstArgs[1]);
    expect(retryArgs[2]).to.equal(undefined);

    // The taker still receives the Continue/Cancel buttons — without this the
    // order could not be advanced or cancelled at all.
    const buttonsCall = sendMessage.getCall(2).args;
    expect(buttonsCall[1]).to.equal(ORDER._id);
    const keyboard = buttonsCall[2].reply_markup.inline_keyboard[0];
    expect(keyboard.map((b: any) => b.callback_data)).to.deep.equal([
      'addInvoiceBtn',
      'cancelAddInvoiceBtn',
    ]);
  });

  it('keeps MarkdownV2 formatting when the locale is safe', async () => {
    const sendMessage = sinon.stub().resolves();
    const bot: any = { telegram: { sendMessage } };

    await beginTakeSellMessage(makeCtx() as any, bot, BUYER as any, ORDER);

    // No retry needed: the MarkdownV2 send plus the buttons.
    expect(sendMessage.callCount).to.equal(2);
    expect(sendMessage.getCall(0).args[2]).to.deep.equal({
      parse_mode: 'MarkdownV2',
    });
  });
});
