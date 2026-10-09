export {};

const { expect } = require('chai');
const sinon = require('sinon');
const proxyquire = require('proxyquire').noCallThru();
const { TelegramError } = require('telegraf');

// Builds the error Telegram returns when a translation breaks MarkdownV2.
const parseError = () =>
  new TelegramError({
    error_code: 400,
    description: "Bad Request: can't parse entities: character '.' is reserved",
  });

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

// Mirrors the real translation shape: MarkdownV2 escapes reserved characters
// with a backslash (the locales carry `\\.` which compiles to `\.` at runtime).
const ESCAPED_TEXT = 'no risk of freezing funds\\. Press to continue \\(now\\)';
const PLAIN_TEXT = 'no risk of freezing funds. Press to continue (now)';

// ctx whose locale is Persian, mirroring the reported scenario.
const makeCtx = () => ({
  i18n: { t: () => ESCAPED_TEXT, locale: () => 'fa' },
});

describe('MarkdownV2 send falls back to plain text (#882)', () => {
  it('retries as plain text and still delivers the action buttons', async () => {
    const sendMessage = sinon.stub();
    // First call is the MarkdownV2 one: Telegram rejects the formatting.
    sendMessage.onFirstCall().rejects(parseError());
    sendMessage.resolves();
    const bot: any = { telegram: { sendMessage } };

    await beginTakeSellMessage(makeCtx() as any, bot, BUYER as any, ORDER);

    // 1) MarkdownV2 attempt, 2) plain-text retry, 3) buttons
    expect(sendMessage.callCount).to.equal(3);

    // The retry drops parse_mode and strips the now-meaningless MarkdownV2
    // escapes, so the reader doesn't see stray backslashes.
    const [firstArgs, retryArgs] = [
      sendMessage.getCall(0).args,
      sendMessage.getCall(1).args,
    ];
    expect(firstArgs[2]).to.deep.equal({ parse_mode: 'MarkdownV2' });
    expect(firstArgs[1]).to.equal(ESCAPED_TEXT);
    expect(retryArgs[1]).to.equal(PLAIN_TEXT);
    expect(retryArgs[1]).to.not.include('\\');
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

  it('does not retry on non-formatting errors (no duplicate sends)', async () => {
    // A network/rate-limit failure may mean the message was already delivered,
    // so retrying it would send the risk warning twice.
    const sendMessage = sinon.stub().rejects(new Error('socket hang up'));
    const bot: any = { telegram: { sendMessage } };

    await beginTakeSellMessage(makeCtx() as any, bot, BUYER as any, ORDER);

    // Only the original attempt: no plain-text retry, and the outer handler
    // logs the error as it did before.
    expect(sendMessage.callCount).to.equal(1);
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
