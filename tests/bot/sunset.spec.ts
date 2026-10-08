import path from 'path';
import fs from 'fs';

import mongoose from 'mongoose';

import schedule from 'node-schedule';
import { Telegram } from 'telegraf';
import { getPublicKey, nip19 } from 'nostr-tools';

import { initialize, sunsetMiddleware, isSunsetMode } from '../../bot/start';
import { encodeIdentity } from '../../bot/modules/reputation/attestation';
import { buildMongoUri } from '../../db_connect';
import { Order, User } from '../../models';

const sinon = require('sinon');
const { expect } = require('chai');

const SPANISH_ANNOUNCEMENT =
  'https://x.com/negrunch/status/2086896990256799795';
const ENGLISH_ANNOUNCEMENT =
  'https://x.com/negrunch/status/2086899005355704703';
const SPANISH_VIDEO_TUTORIAL = 'https://www.youtube.com/watch?v=lbenPWNlykk';
const ENGLISH_VIDEO_TUTORIAL = 'https://www.youtube.com/watch?v=Lnyjgecfd_w';

const makeCtx = (from: any) => {
  const locales: string[] = [];
  return {
    from,
    i18n: {
      locale: (lang: string) => locales.push(lang),
      t: (key: string) => `translated:${key}`,
    },
    reply: sinon.stub().resolves(),
    locales,
  };
};

describe('sunset mode', () => {
  let sandbox: any;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    // Pretend Mongo is connected unless a test says otherwise
    sandbox.stub(mongoose.connection, 'readyState').value(1);
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('sunsetMiddleware', () => {
    it('replies with the sunset notice in the language stored for the user', async () => {
      sandbox.stub(User, 'findOne').resolves({ lang: 'es' });
      const ctx = makeCtx({ id: 1, language_code: 'de' });

      await sunsetMiddleware(ctx as any);

      expect(ctx.locales).to.deep.equal(['es']);
      expect(ctx.reply.calledOnce).to.equal(true);
      expect(ctx.reply.firstCall.args[0]).to.equal('translated:sunset');
    });

    it('falls back to the Telegram client language when the user is unknown', async () => {
      sandbox.stub(User, 'findOne').resolves(null);
      const ctx = makeCtx({ id: 1, language_code: 'fr' });

      await sunsetMiddleware(ctx as any);

      expect(ctx.locales).to.deep.equal(['fr']);
      expect(ctx.reply.calledOnce).to.equal(true);
    });

    it('falls back to English when no language can be determined', async () => {
      sandbox.stub(User, 'findOne').resolves(null);
      const ctx = makeCtx({ id: 1 });

      await sunsetMiddleware(ctx as any);

      expect(ctx.locales).to.deep.equal(['en']);
      expect(ctx.reply.calledOnce).to.equal(true);
    });

    it('replies using the Telegram language when the database is not connected', async () => {
      sandbox.stub(mongoose.connection, 'readyState').value(0);
      const findOne = sandbox.stub(User, 'findOne');
      const ctx = makeCtx({ id: 1, language_code: 'it' });

      await sunsetMiddleware(ctx as any);

      expect(findOne.called).to.equal(false);
      expect(ctx.locales).to.deep.equal(['it']);
      expect(ctx.reply.calledOnce).to.equal(true);
      expect(ctx.reply.firstCall.args[0]).to.equal('translated:sunset');
    });

    it('still replies when the user query fails', async () => {
      sandbox.stub(User, 'findOne').rejects(new Error('no connection'));
      const ctx = makeCtx({ id: 1, language_code: 'pt' });

      await sunsetMiddleware(ctx as any);

      expect(ctx.locales).to.deep.equal(['pt']);
      expect(ctx.reply.calledOnce).to.equal(true);
      expect(ctx.reply.firstCall.args[0]).to.equal('translated:sunset');
    });

    it('does not reply when the update has no sender', async () => {
      const findOne = sandbox.stub(User, 'findOne');
      const ctx = makeCtx(undefined);

      await sunsetMiddleware(ctx as any);

      expect(findOne.called).to.equal(false);
      expect(ctx.reply.called).to.equal(false);
    });
  });

  describe('sunset locale messages', () => {
    const readLocale = (lang: string) =>
      fs.readFileSync(
        path.join(__dirname, '../../../locales', `${lang}.yaml`),
        'utf8',
      );

    it('spanish message links to the spanish announcement and Mostro', () => {
      const es = readLocale('es');
      expect(es).to.include('sunset:');
      expect(es).to.include(SPANISH_ANNOUNCEMENT);
      expect(es).to.include(SPANISH_VIDEO_TUTORIAL);
      expect(es).to.include('https://mostro.network');
      expect(es).to.include('https://mostro.community');
    });

    it('english message links to the english announcement and Mostro', () => {
      const en = readLocale('en');
      expect(en).to.include('sunset:');
      expect(en).to.include(ENGLISH_ANNOUNCEMENT);
      expect(en).to.include(ENGLISH_VIDEO_TUTORIAL);
      expect(en).to.include('https://mostro.network');
      expect(en).to.include('https://mostro.community');
    });

    ['de', 'fr', 'it', 'pt', 'ru', 'uk', 'ko', 'fa'].forEach(lang => {
      it(`${lang} message links to the english announcement and Mostro`, () => {
        const content = readLocale(lang);
        expect(content).to.include('sunset:');
        expect(content).to.include(ENGLISH_ANNOUNCEMENT);
        expect(content).to.include(ENGLISH_VIDEO_TUTORIAL);
        expect(content).to.include('https://mostro.network');
        expect(content).to.include('https://mostro.community');
      });
    });
  });

  describe('isSunsetMode', () => {
    const original = process.env.SUNSET_MODE;

    afterEach(() => {
      if (original === undefined) delete process.env.SUNSET_MODE;
      else process.env.SUNSET_MODE = original;
    });

    it('is enabled only when SUNSET_MODE is the string true', () => {
      process.env.SUNSET_MODE = 'true';
      expect(isSunsetMode()).to.equal(true);

      process.env.SUNSET_MODE = 'false';
      expect(isSunsetMode()).to.equal(false);

      delete process.env.SUNSET_MODE;
      expect(isSunsetMode()).to.equal(false);
    });
  });

  describe('database configuration', () => {
    const env = { ...process.env };

    afterEach(() => {
      process.env = { ...env };
    });

    it('does not require DB variables to be read at import time', () => {
      delete process.env.MONGO_URI;
      delete process.env.DB_HOST;

      expect(() => buildMongoUri()).to.throw('You must provide a MongoDB URI');
    });

    it('builds the URI from DB_* variables', () => {
      delete process.env.MONGO_URI;
      process.env.DB_USER = 'user';
      process.env.DB_PASS = 'pass';
      process.env.DB_HOST = 'localhost';
      process.env.DB_PORT = '27017';
      process.env.DB_NAME = 'p2plnbot';

      expect(buildMongoUri()).to.equal(
        'mongodb://user:pass@localhost:27017/p2plnbot?authSource=admin',
      );
    });
  });

  describe('reputation export', () => {
    const ISSUER_SK =
      '4fa1a2d2b5f0c6e1c0d2a7d3a9e6b5c4d3e2f1a0b9c8d7e6f5a4b3c2d1e0f9a8';
    const IDENTITY = getPublicKey(
      Uint8Array.from(Buffer.from('11'.repeat(32), 'hex')),
    );
    const REP_LINK = `/start rep_${encodeIdentity(IDENTITY)}`;
    const NOTICE = 'This bot is no longer in service';
    let senderId = 1000;

    const eligibleUser = () => ({
      _id: '64f1c9f4e3a2b1c0d9e8f7a6',
      tg_id: '1',
      lang: 'en',
      banned: false,
      trades_completed: 12,
      total_reviews: 214,
      total_rating: 4.87,
      reputation_exported_to: null,
    });

    // A bot built by initialize() whose Telegram API calls are recorded.
    const makeBot = (env: Record<string, string>) => {
      sandbox.stub(process, 'env').value({ ...process.env, ...env });
      const bot = initialize('123:token', {});
      // handleUpdate builds a fresh Telegram client per update.
      const callApi = sandbox
        .stub(Telegram.prototype, 'callApi')
        .callsFake(async (method: string) =>
          method === 'getMe'
            ? { id: 1, is_bot: true, first_name: 'bot', username: 'lnp2pbot' }
            : true,
        );
      const sent = () =>
        callApi
          .getCalls()
          .filter((call: any) => call.args[0] === 'sendMessage')
          .map((call: any) => call.args[1].text as string);
      return { bot, callApi, sent };
    };

    const message = (from: any, text: string, chatType = 'private') => ({
      update_id: 1,
      message: {
        message_id: 1,
        date: 0,
        from,
        chat: { id: chatType === 'private' ? from.id : -100, type: chatType },
        text,
        entities: [{ type: 'bot_command', offset: 0, length: 6 }],
      },
    });

    const button = (from: any, data: string) => ({
      update_id: 2,
      callback_query: {
        id: '1',
        from,
        chat_instance: '1',
        data,
        message: {
          message_id: 2,
          date: 0,
          chat: { id: from.id, type: 'private' },
        },
      },
    });

    let from: any;

    beforeEach(() => {
      senderId += 1;
      from = {
        id: senderId,
        is_bot: false,
        first_name: 'A',
        language_code: 'en',
      };
      const user = eligibleUser();
      sandbox.stub(User, 'findOne').resolves(user);
      sandbox
        .stub(User, 'findOneAndUpdate')
        .callsFake(async () => ({ ...user, reputation_exported_to: IDENTITY }));
      sandbox
        .stub(Order, 'aggregate')
        .resolves([{ startedAt: new Date('2023-10-02T17:45:12Z') }]);
    });

    afterEach(async () => {
      await schedule.gracefulShutdown();
    });

    const sunsetWithIssuer = {
      SUNSET_MODE: 'true',
      REPUTATION_ISSUER_SK: ISSUER_SK,
    };

    it('answers /start rep_ and its confirm button in sunset mode', async () => {
      const { bot, callApi, sent } = makeBot(sunsetWithIssuer);

      await bot.handleUpdate(message(from, REP_LINK) as any);
      expect(sent()).to.have.length(1);
      expect(sent()[0]).to.include(nip19.npubEncode(IDENTITY));
      expect(sent()[0]).to.not.include(NOTICE);

      // Pressed right away: the rate limiter must not drop it.
      await bot.handleUpdate(
        button(from, `repok_${encodeIdentity(IDENTITY)}`) as any,
      );
      expect(callApi.calledWith('answerCallbackQuery')).to.equal(true);
      const [, exported, attestation] = sent();
      expect(exported).to.include('214');
      expect(JSON.parse(attestation).kind).to.equal(38388);
      expect(sent().join('\n')).to.not.include(NOTICE);
    });

    it('answers every other update with the sunset notice', async () => {
      const { bot, sent } = makeBot(sunsetWithIssuer);

      await bot.handleUpdate(message(from, '/help') as any);
      expect(sent()).to.have.length(1);
      expect(sent()[0]).to.include(NOTICE);
    });

    it('leaves a /start rep_ sent in a group to the sunset notice', async () => {
      const { bot, sent } = makeBot(sunsetWithIssuer);

      await bot.handleUpdate(message(from, REP_LINK, 'supergroup') as any);
      expect(sent()).to.have.length(1);
      expect(sent()[0]).to.include(NOTICE);
    });

    it('says export is unavailable when the database is not connected', async () => {
      sandbox.stub(mongoose.connection, 'readyState').value(0);
      const { bot, sent } = makeBot(sunsetWithIssuer);

      await bot.handleUpdate(message(from, REP_LINK) as any);
      expect(sent()).to.have.length(1);
      expect(sent()[0]).to.include('Reputation export is not available');
    });

    it('answers /start rep_ with the notice when no issuer key is set', async () => {
      const { bot, sent } = makeBot({
        SUNSET_MODE: 'true',
        REPUTATION_ISSUER_SK: '',
      });

      await bot.handleUpdate(message(from, REP_LINK) as any);
      expect(sent()).to.have.length(1);
      expect(sent()[0]).to.include(NOTICE);
    });

    it('answers /start rep_ the same way outside sunset mode', async () => {
      const { bot, sent } = makeBot({
        SUNSET_MODE: 'false',
        REPUTATION_ISSUER_SK: ISSUER_SK,
      });

      await bot.handleUpdate(message(from, REP_LINK) as any);
      expect(sent()).to.have.length(1);
      expect(sent()[0]).to.include(nip19.npubEncode(IDENTITY));
      expect(sent()[0]).to.not.include(NOTICE);
    });

    describe('rebinding', () => {
      const vectors = JSON.parse(
        fs.readFileSync(
          path.join(process.cwd(), 'tests/fixtures/reputation_v1.json'),
          'utf8',
        ),
      );
      const { context } = vectors.rebind;
      const rebindEnv = {
        SUNSET_MODE: 'true',
        REPUTATION_ISSUER_SK: vectors.secret_keys['issuer-a'],
      };

      let clock: any;

      beforeEach(() => {
        // The vectors are dated: run at their clock. The rate limiter's reset
        // interval is faked too, so the test can let the user take a while.
        clock = sandbox.useFakeTimers({
          now: context.now * 1000,
          toFake: ['Date', 'setInterval', 'clearInterval'],
        });
        const bound = {
          ...eligibleUser(),
          admin: true,
          reputation_exported_to: context.bound_identity,
        };
        (User.findOne as any).resolves(bound);
        (User.findOneAndUpdate as any).callsFake(async () => ({
          ...bound,
          reputation_exported_to: context.destination,
        }));
      });

      it('moves a binding with a pasted authorisation in sunset mode', async () => {
        const { bot, sent } = makeBot(rebindEnv);

        await bot.handleUpdate(
          message(
            from,
            `/start rep_${encodeIdentity(context.destination)}`,
          ) as any,
        );
        // Pasting the authorisation from the app takes the user a moment.
        clock.tick(5000);
        await bot.handleUpdate(
          message(from, JSON.stringify(vectors.rebind.valid.event)) as any,
        );
        await bot.handleUpdate(button(from, 'reprb_ok') as any);

        const [boundOther, confirm, exported, attestation] = sent();
        expect(boundOther).to.include(nip19.npubEncode(context.bound_identity));
        expect(confirm).to.include(nip19.npubEncode(context.destination));
        expect(exported).to.include(nip19.npubEncode(context.destination));
        expect(JSON.parse(attestation).tags).to.deep.include([
          'p',
          context.destination,
        ]);
        expect(sent().join('\n')).to.not.include(NOTICE);
      });

      it('takes the admin rebind command in sunset mode', async () => {
        const { bot, sent } = makeBot(rebindEnv);

        await bot.handleUpdate(message(from, '/reputation_rebind') as any);
        expect(sent()).to.have.length(1);
        expect(sent()[0]).to.include('/reputation_rebind <telegram id');
      });
    });
  });
});
