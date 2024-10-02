const path = require('path');
const fs = require('fs');
const sinon = require('sinon');
const { expect } = require('chai');
const { initialize } = require('../../bot');
const { User, Order } = require('../../models');
const { getCurrenciesWithPrice } = require('../../util');
const { mockUpdatesResponseForCurrencies } = require('./mocks/currenciesResponse');
const { mockUpdatesResponseForLanguages } = require('./mocks/languagesResponse');

describe('Telegram bot', () => {
  const token = '123456';
  let server;
  let sandbox;
  let order, user;
  
  beforeEach(() => {
    user = {
      lang: 'ESP',
      trades_completed: 7,
      admin: false,
      banned: false,
      disputes: 0,
      _id: '61006f0e85ad4f96cde94141',
      balance: 0,
      tg_id: '1',
      username: 'negrunch',
      created_at: '2021-07-27T20:39:42.403Z',
    };
    order = {
      buyer_dispute: false,
      seller_dispute: false,
      buyer_cooperativecancel: false,
      seller_cooperativecancel: false,
      _id: '612d451148df8353e387eeff',
      description:
        'Vendiendo 111 sats\n' +
        'Por ves 111\n' +
        'Pago por Pagomovil\n' +
        'Tiene 7 operaciones exitosas',
      amount: 111,
      fee: 0.111,
      creator_id: '61006f0e85ad4f96cde94141',
      seller_id: '61006f0e85ad4f96cde94141',
      type: 'sell',
      status: 'PENDING',
      fiat_amount: 111,
      fiat_code: 'ves',
      payment_method: 'Pagomovil',
      tg_chat_id: '1',
      tg_order_message: '1',
      created_at: '2021-08-30T20:52:33.870Z',
    };
    sandbox = sinon.createSandbox();
    // Mock process.env
    sandbox.stub(process, 'env').value({
      CHANNEL: '@testChannel',
      MIN_PAYMENT_AMT: 100,
      NODE_ENV: 'test',
      INVOICE_EXPIRATION_WINDOW: 3600000,
      LND_GRPC_HOST: '127.0.0.1:10005',
    });

    // Mock TelegramServer
    server = {
      getClient: sandbox.stub().returns({
        makeCommand: sandbox.stub().returns({}),
        sendCommand: sandbox.stub().resolves({ ok: true }),
        getUpdates: sandbox.stub().resolves({
          ok: true,
          result: [{
            update_id: 1,
            message: {
              message_id: 1,
              from: {
                id: 1,
                is_bot: false,
                first_name: 'Test',
                username: 'testuser',
                language_code: 'en',
              },
              chat: {
                id: 1,
                first_name: 'Test',
                username: 'testuser',
                type: 'private',
              },
              date: 1678888888,
              text: '/start',
              entities: [{
                offset: 0,
                length: 6,
                type: 'bot_command',
              }],
            },
          }],
        }),
        sendMessage: sandbox.stub().resolves({ ok: true }),
      }),
      ApiURL: 'http://localhost:9001',
    };

    // Mock mongo connection and models
    sandbox.stub(User, 'findOne').resolves(user);
    sandbox.stub(Order, 'findOne').resolves(null);
    sandbox.stub(Order.prototype, 'save').resolves(order);

    // Initialize the bot
    initialize(token, { telegram: { apiRoot: server.ApiURL } });
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('should start', async () => {
    const client = server.getClient(token, { timeout: 5000 });
    const command = client.makeCommand('/start');
    const res = await client.sendCommand(command);
    expect(res.ok).to.be.equal(true);
    const updates = await client.getUpdates();
    expect(updates.ok).to.be.equal(true);
    expect(updates.result.length).to.be.equal(1);
  });

  it('should return /sell help', async () => {
    const client = server.getClient(token, { timeout: 5000 });
    const command = client.makeCommand('/sell help');
    const res = await client.sendCommand(command);
    expect(res.ok).to.be.equal(true);
  });

  it('should create a /sell', async () => {
    const client = server.getClient(token, { timeout: 5000 });
    const command = client.makeCommand('/sell 100 1 ves Pagomovil');
    const res = await client.sendCommand(command);
    expect(res.ok).to.be.equal(true);
  });

  it('should return /buy help', async () => {
    const client = server.getClient(token, { timeout: 5000 });
    const command = client.makeCommand('/buy help');
    const res = await client.sendCommand(command);
    expect(res.ok).to.be.equal(true);
  });

  it('should return the list of supported currencies', async () => {
    const client = server.getClient(token, { timeout: 5000 });
    const command = client.makeCommand('/listcurrencies');
    client.getUpdates.onCall(0).resolves(mockUpdatesResponseForCurrencies);

    const res = await client.sendCommand(command);
    expect(res.ok).to.be.equal(true);
    const updates = await client.getUpdates();
    expect(updates.ok).to.be.equal(true);
    expect(
      (updates.result[0].message.text.match(/\n/g) || []).length - 1
    ).to.be.equal(getCurrenciesWithPrice().length);
  });

  it('should return flags of langs supported', async () => {
    const client = server.getClient(token, { timeout: 5000 });
    const command = client.makeCommand('/setlang');
    client.getUpdates.onCall(0).resolves(mockUpdatesResponseForLanguages);

    const res = await client.sendCommand(command);
    expect(res.ok).to.be.equal(true);
    const updates = await client.getUpdates();
    expect(updates.ok).to.be.equal(true);
    let flags = 0;
    updates.result[0].message.reply_markup.inline_keyboard.forEach(flag => {
      flags += flag.length;
    });
    let langs = 0;
    fs.readdirSync(path.join(__dirname, '../../locales')).forEach(file => {
      langs++;
    });
    expect(flags).to.be.equal(langs);
  });
});
