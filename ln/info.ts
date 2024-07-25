import * as lightning from "lightning";
import { lnd } from './connect'
import { logger } from "../logger";

export const getInfo = async () => {
  try {
    return await lightning.getWalletInfo({ lnd });
  } catch (error) {
    logger.error(error);
  }
};
