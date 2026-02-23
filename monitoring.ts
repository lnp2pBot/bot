import axios from 'axios';
import mongoose from 'mongoose';
import { logger } from './logger';
// Using require to match the project's pattern (see jobs/node_info.ts)
// and to allow test stubbing via proxyquire
const { getInfo } = require('./ln');

interface HealthData {
  bot: string;
  timestamp: number;
  uptime: number;
  processId: number;
  nodeEnv: string;
  memory: {
    rss: number;
    heapTotal: number;
    heapUsed: number;
    external: number;
  };
  dbConnected: boolean;
  dbState: string;
  lightningConnected: boolean;
  lightningInfo?: {
    alias: string;
    active_channels_count: number;
    peers_count: number;
    synced_to_chain: boolean;
    synced_to_graph: boolean;
    block_height: number;
    version: string;
  };
  lastError?: string;
}

const DB_STATES: Record<number, string> = {
  0: 'disconnected',
  1: 'connected',
  2: 'connecting',
  3: 'disconnecting',
};

/**
 * Collect health data from the bot's subsystems
 */
const collectHealthData = async (botName: string): Promise<HealthData> => {
  const mem = process.memoryUsage();
  const dbReadyState = mongoose.connection.readyState;

  const healthData: HealthData = {
    bot: botName,
    timestamp: Date.now(),
    uptime: process.uptime(),
    processId: process.pid,
    nodeEnv: process.env.NODE_ENV || 'unknown',
    memory: {
      rss: mem.rss,
      heapTotal: mem.heapTotal,
      heapUsed: mem.heapUsed,
      external: mem.external,
    },
    dbConnected: dbReadyState === 1,
    dbState: DB_STATES[dbReadyState] || 'unknown',
    lightningConnected: false,
  };

  // Check Lightning node
  try {
    const info = await getInfo();
    if (info) {
      healthData.lightningConnected = true;
      healthData.lightningInfo = {
        alias: info.alias || '',
        active_channels_count: info.active_channels_count || 0,
        peers_count: info.peers_count || 0,
        synced_to_chain: info.is_synced_to_chain || false,
        synced_to_graph: info.is_synced_to_graph || false,
        block_height: info.current_block_height || 0,
        version: info.version || '',
      };
    }
  } catch (error) {
    healthData.lightningConnected = false;
    healthData.lastError = String(error);
  }

  return healthData;
};

/**
 * Send a heartbeat to the external monitor service.
 *
 * @param monitorUrl - Base URL of the monitor service
 * @param authToken - Bearer token for authentication
 * @param botName - Bot identifier sent with each heartbeat
 */
const sendHeartbeat = async (
  monitorUrl: string,
  authToken: string,
  botName: string
): Promise<void> => {
  try {
    const healthData = await collectHealthData(botName);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (authToken) {
      headers.Authorization = `Bearer ${authToken}`;
    }

    await axios.post(`${monitorUrl}/api/heartbeat`, healthData, {
      headers,
      timeout: 10000,
    });

    logger.debug('Heartbeat sent successfully');
  } catch (error: any) {
    // Log but don't crash - monitoring failure shouldn't affect the bot
    const message = error.response
      ? `HTTP ${error.response.status}: ${JSON.stringify(error.response.data)}`
      : error.message;
    logger.warning(`Failed to send heartbeat: ${message}`);
  }
};

/**
 * Start the heartbeat monitoring system using node-schedule.
 *
 * Reads configuration from environment variables:
 * - MONITOR_URL: URL of the external monitor service (required, disabled if absent)
 * - MONITOR_AUTH_TOKEN: Bearer token for authentication (optional)
 * - MONITOR_BOT_NAME: Bot identifier (default: 'lnp2pBot')
 *
 * Schedules a heartbeat job every 2 minutes using node-schedule,
 * consistent with the rest of the codebase's scheduling pattern.
 */
const startMonitoring = (): void => {
  const monitorUrl = process.env.MONITOR_URL;

  if (!monitorUrl) {
    logger.info(
      'Monitoring disabled: MONITOR_URL not configured in environment'
    );
    return;
  }

  const url = monitorUrl.replace(/\/$/, ''); // Remove trailing slash
  const authToken = process.env.MONITOR_AUTH_TOKEN || '';
  const botName = process.env.MONITOR_BOT_NAME || 'lnp2pBot';

  logger.info(
    `Starting monitoring: sending heartbeats every 2 minutes to ${url}`
  );

  // Send first heartbeat immediately
  sendHeartbeat(url, authToken, botName).catch(() => {});

  // Schedule periodic heartbeats using node-schedule (every 2 minutes)
  const schedule = require('node-schedule');
  schedule.scheduleJob('*/2 * * * *', async () => {
    await sendHeartbeat(url, authToken, botName).catch(() => {});
  });
};

export { startMonitoring, collectHealthData, sendHeartbeat };
