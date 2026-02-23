import axios from 'axios';
import mongoose from 'mongoose';
import { logger } from './logger';
// Using require to match the project's pattern (see jobs/node_info.ts)
// and to allow test stubbing via proxyquire
const { getInfo } = require('./ln');

interface MonitoringConfig {
  /** URL of the external monitor service (e.g. https://monitor.example.com) */
  monitorUrl: string;
  /** Authentication token for the monitor service */
  authToken: string;
  /** Heartbeat interval in milliseconds (default: 120000 = 2 minutes) */
  intervalMs: number;
  /** Bot identifier sent with each heartbeat */
  botName: string;
}

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

/** Minimum allowed heartbeat interval (5 seconds) */
const MIN_INTERVAL_MS = 5000;
/** Default heartbeat interval (2 minutes) */
const DEFAULT_INTERVAL_MS = 120000;

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
 * Send a heartbeat to the external monitor service
 */
const sendHeartbeat = async (config: MonitoringConfig): Promise<void> => {
  try {
    const healthData = await collectHealthData(config.botName);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (config.authToken) {
      headers.Authorization = `Bearer ${config.authToken}`;
    }

    await axios.post(`${config.monitorUrl}/api/heartbeat`, healthData, {
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

let heartbeatInterval: ReturnType<typeof setInterval> | null = null;

/**
 * Start the heartbeat monitoring system.
 * Call this after the bot is connected to MongoDB and ready.
 * Idempotent: calling while already running is a no-op.
 */
const startMonitoring = (): void => {
  if (heartbeatInterval) {
    logger.warning('startMonitoring called while already running; ignoring');
    return;
  }

  const monitorUrl = process.env.MONITOR_URL;

  if (!monitorUrl) {
    logger.info(
      'Monitoring disabled: MONITOR_URL not configured in environment',
    );
    return;
  }

  const parsed = parseInt(process.env.MONITOR_INTERVAL_MS || '', 10);
  const intervalMs = Math.max(
    Number.isNaN(parsed) ? DEFAULT_INTERVAL_MS : parsed,
    MIN_INTERVAL_MS,
  );

  const config: MonitoringConfig = {
    monitorUrl: monitorUrl.replace(/\/$/, ''), // Remove trailing slash
    authToken: process.env.MONITOR_AUTH_TOKEN || '',
    intervalMs,
    botName: process.env.MONITOR_BOT_NAME || 'lnp2pBot',
  };

  logger.info(
    `Starting monitoring: sending heartbeats every ${config.intervalMs / 1000}s to ${config.monitorUrl}`,
  );

  // Send first heartbeat immediately
  sendHeartbeat(config).catch(() => {});

  // Schedule periodic heartbeats
  heartbeatInterval = setInterval(() => {
    sendHeartbeat(config).catch(() => {});
  }, config.intervalMs);

  // Ensure cleanup on shutdown
  const cleanup = () => {
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval);
      heartbeatInterval = null;
    }
  };
  process.once('SIGINT', cleanup);
  process.once('SIGTERM', cleanup);
};

/**
 * Stop the heartbeat monitoring system.
 */
const stopMonitoring = (): void => {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
    logger.info('Monitoring stopped');
  }
};

export { startMonitoring, stopMonitoring, collectHealthData, sendHeartbeat };
