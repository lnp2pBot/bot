const { getDisputeChannel, getDetailedOrder } = require('../../../util');
const logger = require('../../../logger');

const beginDispute = async (bot, initiator, order, buyer, seller, i18n) => {
  try {
    let initiatorUser = buyer;
    let counterPartyUser = seller;
    if (initiator === 'seller') {
      initiatorUser = seller;
      counterPartyUser = buyer;
    }
    if (initiator === 'buyer') {
      await bot.telegram.sendMessage(
        initiatorUser.tg_id,
        i18n.t('you_started_dispute_to_buyer')
      );
      await bot.telegram.sendMessage(
        counterPartyUser.tg_id,
        i18n.t('buyer_started_dispute_to_seller', { orderId: order._id })
      );
    } else {
      await bot.telegram.sendMessage(
        initiatorUser.tg_id,
        i18n.t('you_started_dispute_to_seller')
      );
      await bot.telegram.sendMessage(
        counterPartyUser.tg_id,
        i18n.t('seller_started_dispute_to_buyer', { orderId: order._id })
      );
    }
  } catch (error) {}
};

const takeDisputeButton = async (ctx, bot, order) => {
  try {
    const disputeChannel = await getDisputeChannel(order);
    await bot.telegram.sendMessage(disputeChannel, ctx.i18n.t('new_dispute'), {
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

const disputeData = async (
  bot,
  buyer,
  seller,
  order,
  initiator,
  solver,
  i18n
) => {
  try {
    const type = initiator === 'seller' ? i18n.t('seller') : i18n.t('buyer');
    let initiatorUser = buyer;
    let counterPartyUser = seller;
    if (initiator === 'seller') {
      initiatorUser = seller;
      counterPartyUser = buyer;
    }
    const detailedOrder = getDetailedOrder(i18n, order, buyer, seller);
    await bot.telegram.sendMessage(
      solver.tg_id,
      i18n.t('dispute_started_channel', {
        order,
        initiator,
        initiatorUser,
        counterPartyUser,
        detailedOrder,
        type,
      }),
      { parse_mode: 'MarkdownV2' }
    );
  } catch (error) {
    logger.error(error);
  }
};

module.exports = { takeDisputeButton, beginDispute, disputeData };
