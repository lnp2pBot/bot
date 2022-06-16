// @ts-check
const { auth } = require('../user/middleware');
const actions = require('./actions');
const commands = require('./commands');
const { earningsMessage, updateCommunityMessage } = require('./messages');
exports.Scenes = require('./scenes');

exports.configure = bot => {
  bot.command('mycomms', auth, commands.myComms);
  bot.command('community', auth, async ctx => {
    const { user } = ctx;
    await ctx.scene.enter('COMMUNITY_WIZARD_SCENE_ID', { bot, user });
  });
  bot.command('setcomm', auth, commands.setComm);

  bot.action(/^updateCommunity_([0-9a-f]{24})$/, async ctx => {
    ctx.deleteMessage();
    await updateCommunityMessage(ctx, ctx.match[1]);
  });
  bot.action(/^editNameBtn_([0-9a-f]{24})$/, async ctx => {
    await commands.updateCommunity(ctx, ctx.match[1], 'name');
  });
  bot.action(/^editFeeBtn_([0-9a-f]{24})$/, async ctx => {
    await commands.updateCommunity(ctx, ctx.match[1], 'fee');
  });
  bot.action(/^editCurrenciesBtn_([0-9a-f]{24})$/, async ctx => {
    await commands.updateCommunity(ctx, ctx.match[1], 'currencies');
  });
  bot.action(/^editGroupBtn_([0-9a-f]{24})$/, async ctx => {
    await commands.updateCommunity(ctx, ctx.match[1], 'group', bot);
  });
  bot.action(/^editChannelsBtn_([0-9a-f]{24})$/, async ctx => {
    await commands.updateCommunity(ctx, ctx.match[1], 'channels', bot);
  });
  bot.action(/^editSolversBtn_([0-9a-f]{24})$/, async ctx => {
    await commands.updateCommunity(ctx, ctx.match[1], 'solvers', bot);
  });
  bot.action(/^editDisputeChannelBtn_([0-9a-f]{24})$/, async ctx => {
    await commands.updateCommunity(ctx, ctx.match[1], 'disputeChannel', bot);
  });

  bot.command('findcomms', auth, commands.findCommunity);
  bot.action(/^communityInfo_([0-9a-f]{24})$/, actions.onCommunityInfo);
  bot.action(/^setCommunity_([0-9a-f]{24})$/, actions.onSetCommunity);
  bot.action(/^earningsBtn_([0-9a-f]{24})$/, async ctx => {
    await earningsMessage(ctx, ctx.match[1]);
  });
  bot.action(/^withdrawEarnings_([0-9a-f]{24})$/, actions.withdrawEarnings);
};
