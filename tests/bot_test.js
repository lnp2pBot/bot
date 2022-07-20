require('dotenv').config();
const path = require('path');
const fs = require('fs');
const TelegramServer = require('telegram-test-api');
const sinon = require('sinon');
const { expect } = require('chai');
const { initialize } = require('../bot');
const { User, Order } = require('../models');
const ordersActions = require('../bot/ordersActions');
const testUser = require('./user');
const testOrder = require('./order');
const { getCurrenciesWithPrice } = require('../util');

describe('Telegram bot test', () => {
  const serverConfig = { port: 9001 };
  const token = '123456';
  let server;
  beforeEach(() => {
    server = new TelegramServer(serverConfig);
    return server.start().then(() => {
      // the options passed to Telegraf in this format will make it try to
      // get messages from the server's local URL
      const bot = initialize(token, { telegram: { apiRoot: server.ApiURL } });
      bot.startPolling();
    });
  });

  afterEach(() => server.stop());

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
    // We spy on the User findOne called on ValidateUser()
    const userStub = sinon.stub(User, 'findOne');
    // We spy on the Order findOne called on validateSeller()
    const orderStub = sinon.stub(Order, 'findOne');
    // We make it to return our data
    userStub.returns(testUser);
    orderStub.returns(false);
    const command = client.makeCommand('/sell help');
    const res = await client.sendCommand(command);
    expect(res.ok).to.be.equal(true);
    // const updates = await client.getUpdates();
    // We restore the stubs
    userStub.restore();
    orderStub.restore();
    // expect(updates.ok).to.be.equal(true);
    // TODO: we will check the message with the text from i18n
    // expect(updates.result[0].message.text).to.be.equal("/sell \\<_monto en sats_\\> \\<_monto en fiat_\\> \\<_código fiat_\\> \\<_método de pago_\\> \\[_prima/descuento_\\]");
  });

  it('should create a /sell', async () => {
    const client = server.getClient(token, { timeout: 5000 });
    // We spy on the User findOne called on ValidateUser()
    const userStub = sinon.stub(User, 'findOne');
    // We spy on the Order findOne called on validateSeller()
    const orderStub = sinon.stub(Order, 'findOne');
    // We spy the createOrder call
    const createOrderStub = sinon.stub(ordersActions, 'createOrder');
    // We make it to return our data
    userStub.returns(testUser);
    orderStub.returns(false);
    createOrderStub.returns(testOrder);
    const command = client.makeCommand('/sell 100 1 ves Pagomovil');
    const res = await client.sendCommand(command);
    expect(res.ok).to.be.equal(true);
    // const updates = await client.getUpdates();
    // We restore the stubs
    userStub.restore();
    orderStub.restore();
    createOrderStub.restore();
    // expect(updates.ok).to.be.equal(true);
    // expect(updates.result.length).to.be.equal(3);
    // expect(updates.result[0].message.chat_id).to.be.equal(process.env.CHANNEL);
  });

  it('should return /buy help', async () => {
    const client = server.getClient(token, { timeout: 5000 });
    // We spy on the User findOne called on ValidateUser()
    const userStub = sinon.stub(User, 'findOne');
    // We spy on the Order findOne called on validateSeller()
    const orderStub = sinon.stub(Order, 'findOne');
    // We make it to return our data
    userStub.returns(testUser);
    orderStub.returns(false);
    const command = client.makeCommand('/buy help');
    const res = await client.sendCommand(command);
    expect(res.ok).to.be.equal(true);
    // const updates = await client.getUpdates();
    // We restore the stubs
    userStub.restore();
    orderStub.restore();
    // expect(updates.ok).to.be.equal(true);
    // TODO: we will check the message with the text from i18n
    // expect(updates.result[0].message.text).to.be.equal("/buy \\<_monto en sats_\\> \\<_monto en fiat_\\> \\<_código fiat_\\> \\<_método de pago_\\> \\[_prima/descuento_\\]");
  });

  it('should return the list of supported currencies', async () => {
    const client = server.getClient(token, { timeout: 5000 });
    const userStub = sinon.stub(User, 'findOne');
    userStub.returns(testUser);
    const command = client.makeCommand('/listcurrencies');
    const res = await client.sendCommand(command);
    expect(res.ok).to.be.equal(true);
    const updates = await client.getUpdates();
    userStub.restore();
    expect(updates.ok).to.be.equal(true);
    expect(
      (updates.result[0].message.text.match(/\n/g) || []).length - 1
    ).to.be.equal(getCurrenciesWithPrice().length);
  });

  it('should return flags of langs supported', async () => {
    const client = server.getClient(token, { timeout: 5000 });
    const userStub = sinon.stub(User, 'findOne');
    userStub.returns(testUser);
    const command = client.makeCommand('/setlang');
    const res = await client.sendCommand(command);
    expect(res.ok).to.be.equal(true);
    const updates = await client.getUpdates();
    userStub.restore();
    expect(updates.ok).to.be.equal(true);
    let flags = 0;
    updates.result[0].message.reply_markup.inline_keyboard.forEach(flag => {
      flags += flag.length;
    });
    let langs = 0;
    fs.readdirSync(path.join(__dirname, '../locales')).forEach(file => {
      langs++;
    });
    expect(flags).to.be.equal(langs);
  });
});
