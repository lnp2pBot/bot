const { Scenes } = require('telegraf');
const { getLanguageFlag } = require('../../../../util');
const NostrLib = require('../../nostr/lib');

function make() {
  const resetMessage = async (ctx, next) => {
    delete ctx.scene.state.feedback;
    delete ctx.scene.state.error;
    next();
  };
  function mainData(ctx) {
    const { user } = ctx.scene.state;
    const data = {
      user,
      language: getLanguageFlag(ctx.scene.state.language),
    };
    if (user.nostr_public_key) {
      data.npub = NostrLib.encodeNpub(user.nostr_public_key);
    }
    return data;
  }
  async function updateMessage(ctx) {
    try {
      ctx.i18n.locale(ctx.scene.state.language); // i18n locale resets if user executes unknown action
      const { message, error } = ctx.scene.state;

      const errorText = (error => {
        if (!error) return;
        return '<strong>⚠️ ERROR</strong>\n' + ctx.i18n.t(error.i18n, error);
      })(error);
      const feedbackText = (feedback => {
        if (!feedback) return;
        if (typeof feedback === 'string') return feedback;
        return ctx.i18n.t(feedback.i18n, feedback);
      })(ctx.scene.state.feedback);
      const extras = [errorText, feedbackText].filter(e => e);

      const main = ctx.i18n.t('user_settings', mainData(ctx));
      const str = [main, ...extras].filter(e => e).join('\n');

      const messageChanged = str !== message.text;
      if (!messageChanged) return;

      const msg = await ctx.telegram.editMessageText(
        message.chat.id,
        message.message_id,
        null,
        str,
        {
          parse_mode: 'HTML',
          disable_web_page_preview: true,
        }
      );
      ctx.scene.state.message = msg;
      ctx.scene.state.message.text = str;
    } catch (err) {}
  }
  async function initHandler(ctx) {
    try {
      const { user } = ctx.scene.state;
      ctx.scene.state.language = user.lang || ctx.from?.language_code;
      const str = ctx.i18n.t('user_settings', mainData(ctx));
      const msg = await ctx.reply(str, { parse_mode: 'HTML' });
      ctx.scene.state.message = msg;
      ctx.scene.state.message.text = str;
    } catch (err) {}
  }
  const scene = new Scenes.WizardScene('USER_SETTINGS', async ctx => {
    ctx.user = ctx.scene.state.user;
    const { state } = ctx.scene;
    if (!state.message) return initHandler(ctx);
    await ctx.deleteMessage();
    state.error = {
      i18n: 'generic_error',
    };
    await updateMessage(ctx);
  });

  scene.command('/setnpub', resetMessage, async ctx => {
    try {
      await ctx.deleteMessage();
      const [, npub] = ctx.message.text.trim().split(' ');
      const hex = NostrLib.decodeNpub(npub);
      if (!hex) throw new Error('NpubNotValid');
      const user = ctx.scene.state.user;
      user.nostr_public_key = hex;
      await user.save();
      ctx.scene.state.feedback = {
        i18n: 'user_npub_updated',
        npub,
      };
      await updateMessage(ctx);
    } catch (err) {
      ctx.scene.state.error = {
        i18n: 'npub_not_valid',
      };
      await updateMessage(ctx);
    }
  });

  return scene;
}

module.exports = make();
