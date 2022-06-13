const { Scenes } = require('telegraf');

const ROLES = {
  BUYER: 'Buyer',
  SELLER: 'Seller',
};
const CHATS = {};
const CHAT_ENABLED = {};

function getOrderChat(orderId) {
  if (!CHATS[orderId]) CHATS[orderId] = [];
  return CHATS[orderId];
}

const chatWizard = (exports.chatWizard = new Scenes.WizardScene(
  'ORDER_CHAT',
  async ctx => {
    try {
      const { order, user } = ctx.wizard.state;
      if (user.id === order.buyer_id) ctx.wizard.state.role = ROLES.BUYER;
      if (user.id === order.seller_id) ctx.wizard.state.role = ROLES.SELLER;
      if (!ctx.wizard.state.role) return ctx.scene.leave();

      CHAT_ENABLED[user.id] = ctx.from.id;
      await ctx.reply(`Hello ${ctx.wizard.state.role}`);
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
      const chat = getOrderChat(ctx.wizard.state.order.id);
      const { text } = ctx.message;
      chat.push({
        user: ctx.wizard.state.role,
        date: new Date(),
        message: text,
      });
      // todo: notify other user
      return;
    } catch (err) {
      ctx.reply(err.message);
      return;
    }
  }
));

chatWizard.command('fiatsent', requireRole(ROLES.BUYER), async ctx => {
  // todo: refactor start.js#fiatsent into module
  ctx.reply('NotImplementedYet');
});
chatWizard.command('release', requireRole(ROLES.SELLER), async ctx => {
  // todo: refactor start.js#release into module
  ctx.reply('NotImplementedYet');
});

chatWizard.command('exit', async ctx => {
  try {
    delete CHAT_ENABLED[ctx.wizard.state.user.id];
    await ctx.scene.leave();
    await ctx.reply('Exited chat');
  } catch (err) {
    await ctx.reply(err.message);
  }
});

chatWizard.command('history', history);
async function history(ctx) {
  const chat = getOrderChat(ctx.wizard.state.order.id);
  if (!chat.length) return;
  const text = chat
    .map(msg => `${msg.date}|${msg.user}> ${msg.message}`)
    .join('\n');
  await ctx.reply(text);
}

function requireRole(role) {
  return (ctx, next) => {
    if (ctx.wizard.state.role !== role) return;
    return next();
  };
}
