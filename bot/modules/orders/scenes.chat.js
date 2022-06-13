const { Scenes } = require('telegraf');
const { User } = require('../../../models');

const ROLES = {
  BUYER: 'Buyer',
  SELLER: 'Seller',
};
const CHATS = {};
const CHAT_ENABLED = {};

function getOrderChat(order) {
  const key = `${order.id}/${order.buyer_id}/${order.seller_id}`;
  if (!CHATS[key]) CHATS[key] = [];
  return CHATS[key];
}
function deleteOrderChat(order) {
  const key = `${order.id}/${order.buyer_id}/${order.seller_id}`;
  delete CHATS[key];
}

const chatWizard = (exports.chatWizard = new Scenes.WizardScene(
  'ORDER_CHAT',
  async ctx => {
    try {
      const { order, user } = ctx.wizard.state;
      if (user.id === order.buyer_id) {
        ctx.wizard.state.role = ROLES.BUYER;
        ctx.wizard.state.targetUser = await User.findById(order.seller_id);
      }
      if (user.id === order.seller_id) {
        ctx.wizard.state.role = ROLES.SELLER;
        ctx.wizard.state.targetUser = await User.findById(order.buyer_id);
      }
      if (!ctx.wizard.state.role || !ctx.wizard.state.targetUser)
        return ctx.scene.leave();

      CHAT_ENABLED[user.id] = ctx.from.id;

      await help(ctx);
      await history(ctx);
      return ctx.wizard.next();
    } catch (err) {
      await ctx.reply(err.message);
      return;
    }
  },
  async ctx => {
    try {
      if (!ctx.message || !ctx.message.text)
        throw new Error('MessageTypeNotSupported');
      const chat = getOrderChat(ctx.wizard.state.order);
      const { text } = ctx.message;
      chat.push({
        user: ctx.wizard.state.role,
        date: new Date(),
        message: text,
      });
      const { targetUser } = ctx.wizard.state;
      if (CHAT_ENABLED[targetUser.id]) {
        await ctx.telegram.sendMessage(targetUser.tg_id, text);
      } else {
        await ctx.telegram.sendMessage(
          targetUser.tg_id,
          `You have new messages.\n/chat ${ctx.wizard.state.order.id}`
        );
      }
      return;
    } catch (err) {
      ctx.reply(err.message);
      return;
    }
  }
));

chatWizard.command('fiatsent', requireRole(ROLES.BUYER), async ctx => {
  // todo: refactor start.js#fiatsent into module
  ctx.reply('NotImplementedYet. Exit chat mode and try again.');
});
chatWizard.command('release', requireRole(ROLES.SELLER), async ctx => {
  // todo: refactor start.js#release into module
  ctx.reply('NotImplementedYet. Exit chat mode and try again.');
});

async function help(ctx) {
  const text = [
    `Entered chat mode as ${ctx.wizard.state.role}.`,
    `/history to view old messages.`,
    `/help to show help text.`,
    `/exit to exit chat mode.`,
  ].join('\n\n');
  await ctx.reply(text);
}
chatWizard.command('help', help);
chatWizard.command('exit', async ctx => {
  try {
    const { order, user, targetUser } = ctx.wizard.state;
    delete CHAT_ENABLED[user.id];
    if (!CHAT_ENABLED[targetUser.id]) deleteOrderChat(order);

    await ctx.scene.leave();
    await ctx.reply('Exited chat mode.');
  } catch (err) {
    await ctx.reply(err.message);
  }
});

chatWizard.command('history', history);
async function history(ctx) {
  const chat = getOrderChat(ctx.wizard.state.order);
  if (!chat.length) return;
  const text = chat.map(msg => `${msg.user}> ${msg.message}`).join('\n');
  await ctx.reply(text);
}

function requireRole(role) {
  return (ctx, next) => {
    if (ctx.wizard.state.role !== role) return;
    return next();
  };
}
