const { getDisputeChannel, getDetailedOrder } = require('../../../util');
const logger = require('../../../logger');

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
        ctx.i18n.t('you_started_dispute_to_buyer')
      );
      await ctx.telegram.sendMessage(
        counterPartyUser.tg_id,
        ctx.i18n.t('buyer_started_dispute_to_seller', { orderId: order._id })
      );
    } else {
      await ctx.telegram.sendMessage(
        initiatorUser.tg_id,
        ctx.i18n.t('you_started_dispute_to_seller')
      );
      await ctx.telegram.sendMessage(
        counterPartyUser.tg_id,
        ctx.i18n.t('seller_started_dispute_to_buyer', { orderId: order._id })
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
    await ctx.telegram.sendMessage(
      solver.tg_id,
      ctx.i18n.t('dispute_started_channel', {
        initiatorUser,
        counterPartyUser,
        buyer,
        seller,
        buyerDisputes,
        sellerDisputes,
        detailedOrder,
        type,
      }),
      { parse_mode: 'MarkdownV2' }
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
