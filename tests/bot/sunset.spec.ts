import path from 'path';
import fs from 'fs';

import { sunsetMiddleware } from '../../bot/start';
import { User } from '../../models';

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
  });
});
