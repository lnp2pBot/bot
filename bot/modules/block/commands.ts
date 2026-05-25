import { User, Block, Order } from '../../../models';
import * as messages from './messages';
import * as globalMessages from '../../messages';
import { MainContext } from '../../start';

const block = async (ctx: MainContext, usernameOrId: string): Promise<void> => {
  let userToBlock;
  if (usernameOrId.startsWith('@')) {
    userToBlock = await User.findOne({ username: usernameOrId.substring(1) });
  } else {
    // Avoid querying with invalid telegram ids
    if (!Number.isInteger(Number(usernameOrId))) {
      await globalMessages.notFoundUserMessage(ctx);
      return;
    }
    userToBlock = await User.findOne({ tg_id: usernameOrId });
  }
  const user = ctx.user;

  if (!userToBlock) {
    await globalMessages.notFoundUserMessage(ctx);
    return;
  }

  const areExistingOrders = await Order.exists({
    $or: [
      { seller_id: user._id.toString(), buyer_id: userToBlock._id.toString() },
      { seller_id: userToBlock._id.toString(), buyer_id: user._id.toString() },
    ],
    status: {
      $nin: [
        'PENDING',
        'CLOSED',
        'CANCELED_BY_ADMIN',
        'EXPIRED',
        'SUCCESS',
        'PAID_HOLD_INVOICE',
        'CANCELED',
      ],
    },
  });

  if (areExistingOrders) {
    await messages.ordersInProcess(ctx);
    return;
  }

  const isAlreadyBlocked = await Block.exists({
    blocker_tg_id: user.tg_id,
    blocked_tg_id: userToBlock.tg_id,
  });
  if (isAlreadyBlocked) {
    await messages.userAlreadyBlocked(ctx);
    return;
  }

  const block = new Block({
    blocker_tg_id: user.tg_id,
    blocked_tg_id: userToBlock.tg_id,
  });
  await block.save();
  await messages.userBlocked(ctx);
};

const unblock = async (
  ctx: MainContext,
  usernameOrId: string,
): Promise<void> => {
  let userToUnblock;
  if (usernameOrId.startsWith('@')) {
    userToUnblock = await User.findOne({ username: usernameOrId.substring(1) });
  } else {
    // Avoid querying with invalid telegram ids
    if (!Number.isInteger(Number(usernameOrId))) {
      await globalMessages.notFoundUserMessage(ctx);
      return;
    }
    userToUnblock = await User.findOne({ tg_id: usernameOrId });
  }

  if (!userToUnblock) {
    await globalMessages.notFoundUserMessage(ctx);
    return;
  }
  const user = ctx.user;

  const result = await Block.deleteOne({
    blocker_tg_id: user.tg_id,
    blocked_tg_id: userToUnblock.tg_id,
  });

  if (result.deletedCount === 1) {
    await messages.userUnblocked(ctx);
  } else {
    await globalMessages.notFoundUserMessage(ctx);
  }
};

const blocklist = async (ctx: MainContext): Promise<void> => {
  const blocks = await Block.find({ blocker_tg_id: ctx.user.tg_id });
  const tgIdBlocks = blocks.map(
    (blocked: { blocked_tg_id: any }) => blocked.blocked_tg_id,
  );

  if (!tgIdBlocks.length) {
    await messages.blocklistEmptyMessage(ctx);
    return;
  }

  const usersBlocked = await User.find({ tg_id: { $in: tgIdBlocks } });
  await messages.blocklistMessage(ctx, usersBlocked);
};

export { block, unblock, blocklist };
