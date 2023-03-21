const { Scenes } = require('telegraf');
const NostrCommands = require('../../nostr/commands');

function make() {
  const stateUserToContext = (ctx, next) => {
    ctx.user = ctx.scene.state.user;
    next();
  };
  const scene = new Scenes.WizardScene('USER_SETTINGS', async ctx => {
    const { user } = ctx.scene.state;
    const str = ctx.i18n.t('user_admin', { user });
    await ctx.reply(str, { parse_mode: 'HTML' });
  });

  scene.command('/setnpub', stateUserToContext, NostrCommands.setUserNpub);

  return scene;
}

module.exports = make();
