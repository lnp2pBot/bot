// @ts-check
const { auth } = require('../user/middleware');
const actions = require('./actions');
const commands = require('./commands');
const { earningsMessage } = require('./messages');
exports.Scenes = require('./scenes');

exports.configure = bot => {
  bot.command('mycomms', auth, commands.myComms);
  bot.command('community', auth, async ctx => {
    const { user } = ctx;
    await ctx.scene.enter('COMMUNITY_WIZARD_SCENE_ID', { bot, user });
  });
  bot.command('setcomm', auth, commands.setComm);

  bot.command('findcomms', auth, commands.findCommunity);
  bot.action(/^communityInfo_([0-9a-f]{24})$/, actions.onCommunityInfo);
  bot.action(/^setCommunity_([0-9a-f]{24})$/, actions.onSetCommunity);
  bot.action(/^earningsBtn_([0-9a-f]{24})$/, async ctx => {
    await earningsMessage(ctx, ctx.match[1]);
  });
  bot.action(/^withdrawEarnings_([0-9a-f]{24})$/, actions.withdrawEarnings);
};
