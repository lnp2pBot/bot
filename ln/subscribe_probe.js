const { subscribeToProbeForRoute } = require('lightning');
const lnd = require('./connect');
const { logger } = require('../logger');

const subscribeProbe = async (destination, tokens) => {
  try {
    const sub = subscribeToProbeForRoute({ destination, lnd, tokens });
    sub.on('probe_success', async route =>
      logger.info(`Probe success: ${route}`)
    );
    sub.on('probing', async route => logger.info(`Probing: ${route}`));
    sub.on('routing_failure', async routing_failure =>
      logger.error(routing_failure)
    );
  } catch (error) {
    logger.error('subscribeProbe catch: ', error);
    return false;
  }
};

module.exports = subscribeProbe;
