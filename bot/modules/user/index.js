const { userMiddleware } = require('../../middleware/user');

const Scenes = (exports.Scenes = require('./scenes'));

exports.configure = bot => {
  bot.command('/settings', userMiddleware, async ctx => {
    try {
      const { user } = ctx;
      await ctx.scene.enter(Scenes.Settings.id, { user });
    } catch (err) {
      ctx.reply(err.message);
    }
  });
};
