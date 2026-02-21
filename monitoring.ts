import axios from 'axios';
import { getInfo } from './ln/info';
import mongoose from 'mongoose';
import { logger } from './logger';

interface EnhancedHealthMetrics {
  bot: string;
  timestamp: number;
  uptime: number;
  memory: NodeJS.MemoryUsage;
  processId: number;
  nodeEnv: string;
  dbConnected: boolean;
  dbState: string;
  lightningConnected: boolean;
  lightningInfo?: {
    alias?: string;
    public_key?: string;
    chains?: string[];
    version?: string;
    block_height?: number;
    synced_to_chain?: boolean;
    synced_to_graph?: boolean;
    peers_count?: number;
    active_channels_count?: number;
    pending_channels_count?: number;
  };
  lastError?: string;
}

// Track if we've already logged the "no URL configured" message to avoid spam
let hasLoggedNoUrl = false;

const checkLightningHealth = async () => {
  try {
    const walletInfo = await getInfo();
    if (!walletInfo) {
      throw new Error('No wallet info received');
    }
    
    return {
      connected: true,
      info: {
        alias: walletInfo.alias,
        public_key: walletInfo.public_key,
        chains: walletInfo.chains,
        version: walletInfo.version,
        block_height: walletInfo.current_block_height,
        synced_to_chain: walletInfo.is_synced_to_chain,
        synced_to_graph: walletInfo.is_synced_to_graph,
        peers_count: walletInfo.peers_count,
        active_channels_count: walletInfo.active_channels_count,
        pending_channels_count: walletInfo.pending_channels_count
      }
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Lightning health check failed: ${errorMessage}`);
    return {
      connected: false,
      error: errorMessage
    };
  }
};

const sendHeartbeat = async (): Promise<void> => {
  const monitorUrl = process.env.MONITOR_HEARTBEAT_URL;
  if (!monitorUrl) {
    // Only log debug message on first call to avoid spam
    if (!hasLoggedNoUrl) {
      logger.debug('MONITOR_HEARTBEAT_URL not configured, health monitoring disabled');
      hasLoggedNoUrl = true;
    }
    return;
  }

  try {
    // Check Lightning node status
    const lightningHealth = await checkLightningHealth();
    
    // Check MongoDB status
    const dbState = mongoose.connection.readyState;
    const dbStateMap: { [key: number]: string } = {
      0: 'disconnected',
      1: 'connected',
      2: 'connecting',
      3: 'disconnecting'
    };

    const healthData: EnhancedHealthMetrics = {
      bot: 'lnp2pBot',
      timestamp: Date.now(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      processId: process.pid,
      nodeEnv: process.env.NODE_ENV || 'unknown',
      dbConnected: dbState === 1,
      dbState: dbStateMap[dbState] || 'unknown',
      lightningConnected: lightningHealth.connected,
      lightningInfo: lightningHealth.info
    };

    if (!lightningHealth.connected) {
      healthData.lastError = lightningHealth.error;
    }

    const response = await axios.post(`${monitorUrl}/api/heartbeat`, healthData, {
      timeout: 15000,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.MONITOR_TOKEN || ''}`
      }
    });

    logger.debug(`Heartbeat sent successfully - DB: ${healthData.dbState}, Lightning: ${lightningHealth.connected ? 'connected' : 'disconnected'}, Response: ${response.status}`);
  } catch (error) {
    if (axios.isAxiosError(error)) {
      if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
        logger.warn(`Monitoring service unreachable: ${error.message}`);
      } else if (error.response) {
        logger.error(`Heartbeat failed with status ${error.response.status}: ${error.message}`);
      } else {
        logger.error(`Heartbeat request failed: ${error.message}`);
      }
    } else {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`Failed to send heartbeat: ${errorMessage}`);
    }
  }
};

// Initialize monitoring system
const initializeMonitoring = (): void => {
  // Configurable heartbeat interval (default 2 minutes)
  const heartbeatInterval = parseInt(process.env.MONITOR_HEARTBEAT_INTERVAL || '120') * 1000;
  const initialDelay = parseInt(process.env.MONITOR_INITIAL_DELAY || '30') * 1000;

  // Validate configuration
  if (heartbeatInterval < 30000) { // Less than 30 seconds
    logger.warn('MONITOR_HEARTBEAT_INTERVAL is very low (< 30s), consider increasing it');
  }
  if (heartbeatInterval > 600000) { // More than 10 minutes
    logger.warn('MONITOR_HEARTBEAT_INTERVAL is very high (> 10min), consider decreasing it for better monitoring');
  }

  // Send heartbeat at configured interval
  setInterval(sendHeartbeat, heartbeatInterval);

  // Initial heartbeat after configurable delay (allow bot to fully initialize)
  setTimeout(sendHeartbeat, initialDelay);

  if (process.env.MONITOR_HEARTBEAT_URL) {
    logger.info(`Health monitoring initialized - heartbeat every ${heartbeatInterval/1000}s, initial delay ${initialDelay/1000}s`);
  }
};

export { sendHeartbeat, checkLightningHealth, initializeMonitoring };