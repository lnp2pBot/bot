import { Telegraf } from 'telegraf';

import { Config } from '../models';
import { CommunityContext } from '../bot/modules/community/communityContext';
import { logger } from '../logger';

const { getInfo } = require('../ln');

const info = async (bot: Telegraf<CommunityContext>) => {
  try {
    let config = await Config.findOne({});
    if (config === null) {
      config = new Config();
    }
    const info = await getInfo();
    if (info.is_synced_to_chain) {
      config.node_status = 'up';
    }
    config.node_uri = info.uris[0];
    config.node_alias = info.alias || '';
    config.node_version = info.version || '';
    config.node_block_height = info.current_block_height || 0;
    config.node_channels_count = info.active_channels_count || 0;
    config.node_peers_count = info.peers_count || 0;
    config.node_synced_to_chain = info.is_synced_to_chain || false;
    config.node_synced_to_graph = info.is_synced_to_graph || false;
    await config.save();
  } catch (error) {
    const message = String(error);
    logger.error(`node info catch error: ${message}`);
  }
};

export default info;
