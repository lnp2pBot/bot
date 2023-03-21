const { Scenes } = require('telegraf');
const { getLanguageFlag } = require('../../../../util');
const NostrCommands = require('../../nostr/commands');

function make() {
  const stateUserToContext = (ctx, next) => {
    ctx.user = ctx.scene.state.user;
    next();
  };
  const scene = new Scenes.WizardScene('USER_SETTINGS', async ctx => {
    const { user } = ctx.scene.state;
    const language = getLanguageFlag(user.lang || ctx.from?.language_code);
    const str = ctx.i18n.t('user_settings', { user, language });
    await ctx.reply(str, { parse_mode: 'HTML' });
  });

  scene.command('/help', async ctx => {
    const str = ctx.i18n.t('user_settings_help');
    await ctx.reply(str, { parse_mode: 'HTML' });
  });

  scene.command('/setnpub', stateUserToContext, NostrCommands.setUserNpub);

  return scene;
}

module.exports = make();
