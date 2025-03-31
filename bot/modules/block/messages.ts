import { CustomContext } from './customContext';

const { logger } = require('../../../logger');

const ordersInProcess = async (ctx: CustomContext) => {
  try {
    ctx.reply(ctx.i18n.t('orders_in_process'));
  } catch (error) {
    logger.error(error);
  }
};

const userAlreadyBlocked = async (ctx: CustomContext) => {
  try {
    ctx.reply(ctx.i18n.t('user_already_blocked'));
  } catch (error) {
    logger.error(error);
  }
};

const userBlocked = async (ctx: CustomContext) => {
  try {
    ctx.reply(ctx.i18n.t('user_blocked'));
  } catch (error) {
    logger.error(error);
  }
};

const userUnblocked = async (ctx: CustomContext) => {
  try {
    ctx.reply(ctx.i18n.t('user_unblocked'));
  } catch (error) {
    logger.error(error);
  }
};

const blocklistMessage = async (ctx: CustomContext, usersBlocked) => {
  try {
    if (!usersBlocked?.length) {
      return await blocklistEmptyMessage(ctx);
    }
    const userList = usersBlocked.map(block => '@' + block.username);
    ctx.reply(userList.join('\n'));
  } catch (error) {
    logger.error(error);
  }
};

const blocklistEmptyMessage = async (ctx: CustomContext) => {
  try {
    ctx.reply(ctx.i18n.t('blocklist_empty'));
  } catch (error) {
    logger.error(error);
  }
};

export {
  userAlreadyBlocked,
  userBlocked,
  userUnblocked,
  blocklistMessage,
  blocklistEmptyMessage,
  ordersInProcess,
};
