const { getDisputeChannel, getDetailedOrder } = require('../../../util');
const { logger } = require('../../../logger');

const escapeMarkdown = (text) => text.replace(/_/g, '\\_');

exports.beginDispute = async (ctx, initiator, order, buyer, seller) => {
  try {
    let initiatorUser = buyer;
    let counterPartyUser = seller;

    if (initiator === 'seller') {
      initiatorUser = seller;
      counterPartyUser = buyer;
    }
    if (initiator === 'buyer') {
      await ctx.telegram.sendMessage(
        initiatorUser.tg_id,
        ctx.i18n.t('dispute_started', {
          who: ctx.i18n.t('you_started', { orderId: order._id }),
          token: order.buyer_dispute_token,
        })
      );
      await ctx.telegram.sendMessage(
        counterPartyUser.tg_id,
        ctx.i18n.t('dispute_started', {
          who: ctx.i18n.t('counterpart_started', { orderId: order._id }),
          token: order.seller_dispute_token,
        })
      );
    } else {
      await ctx.telegram.sendMessage(
        initiatorUser.tg_id,
        ctx.i18n.t('dispute_started', {
          who: ctx.i18n.t('you_started', { orderId: order._id }),
          token: order.seller_dispute_token,
        })
      );
      await ctx.telegram.sendMessage(
        counterPartyUser.tg_id,
        ctx.i18n.t('dispute_started', {
          who: ctx.i18n.t('counterpart_started', { orderId: order._id }),
          token: order.buyer_dispute_token,
        })
      );
    }
  } catch (error) {
    logger.error(error);
  }
};

exports.takeDisputeButton = async (ctx, order) => {
  try {
    const disputeChannel = await getDisputeChannel(order);
    await ctx.telegram.sendMessage(disputeChannel, ctx.i18n.t('new_dispute'), {
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: ctx.i18n.t('take_dispute'),
              callback_data: `takeDispute_${order._id}`,
            },
          ],
        ],
      },
    });
  } catch (error) {
    logger.error(error);
  }
};

exports.disputeData = async (
  ctx,
  buyer,
  seller,
  order,
  initiator,
  solver,
  buyerDisputes,
  sellerDisputes
) => {
  try {
    const type =
      initiator === 'seller' ? ctx.i18n.t('seller') : ctx.i18n.t('buyer');
    let initiatorUser = buyer;
    let counterPartyUser = seller;
    if (initiator === 'seller') {
      initiatorUser = seller;
      counterPartyUser = buyer;
    }

    const detailedOrder = getDetailedOrder(ctx.i18n, order, buyer, seller);
    
    // Fix Issue 543: Escape underscores in usernames
    const escapedInitiatorUsername = escapeMarkdown(initiatorUser.username);
    const escapedCounterPartyUsername = escapeMarkdown(counterPartyUser.username);
    
    await ctx.telegram.sendMessage(
      solver.tg_id,
      ctx.i18n.t('dispute_started_channel', {
        initiatorUser: { ...initiatorUser, username: escapedInitiatorUsername },
        initiatorTgId: initiatorUser.tg_id,
        counterPartyUser: { ...counterPartyUser, username: escapedCounterPartyUsername },
        counterPartyUserTgId: counterPartyUser.tg_id,
        buyer,
        seller,
        buyerDisputes,
        sellerDisputes,
        detailedOrder,
        type,
        sellerToken: order.seller_dispute_token,
        buyerToken: order.buyer_dispute_token,
      }),
      { parse_mode: 'MarkdownV2' }
    );
    // message to both parties letting them know the dispute
    // has been taken by a solver
    await ctx.telegram.sendMessage(
      buyer.tg_id,
      ctx.i18n.t('dispute_solver', {
        solver: solver.username,
        token: order.buyer_dispute_token,
      })
    );
    await ctx.telegram.sendMessage(
      seller.tg_id,
      ctx.i18n.t('dispute_solver', {
        solver: solver.username,
        token: order.seller_dispute_token,
      })
    );
  } catch (error) {
    logger.error(error);
  }
};

exports.notFoundDisputeMessage = async ctx => {
  try {
    await ctx.reply(ctx.i18n.t('not_found_dispute'));
  } catch (error) {
    logger.error(error);
  }
};

exports.sellerReleased = async (ctx, solver) => {
  try {
    await ctx.telegram.sendMessage(
      solver.tg_id,
      ctx.i18n.t('seller_already_released')
    );
  } catch (error) {
    logger.error(error);
  }
};

exports.disputeTooSoonMessage = async ctx => {
  try {
    await ctx.reply(ctx.i18n.t('dispute_too_soon'));
  } catch (error) {
    logger.error(error);
  }
};
