import { Telegraf } from "telegraf";
import { MainContext } from "../bot/start";

import { Config } from '../models';
const { getInfo } = require('../ln');
import { logger } from "../logger";

const info = async (bot: Telegraf<MainContext>) => {
  try {
    const config = await Config.findOne({});
    if (config === null) throw Error("Config not found in DB");
    const info = await getInfo();
    if (info.is_synced_to_chain) {
      config.node_status = 'up';
    }
    config.node_uri = info.uris[0];
    await config.save();
  } catch (error) {
    const message = String(error);
    logger.error(`node info catch error: ${message}`);
  }
};

export { info };
