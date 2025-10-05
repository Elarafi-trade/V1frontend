/**
 * Drift Client Singleton Manager
 * 
 * Maintains a pool of DriftClient instances to avoid expensive
 * subscribe() calls (2-5s) on every operation.
 * 
 * Features:
 * - Cached read-only client for API routes
 * - Auto-reconnect on errors
 * - Freshness checks (5min timeout)
 * - Thread-safe singleton pattern with Promise-based race protection
 * - Background heartbeat for connection health monitoring
 * - Event emitter for lifecycle tracking
 * - Proactive refresh before cache expiry
 */

import { DriftClient } from '@drift-labs/sdk';
import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import { EventEmitter } from 'events';

// NodeWallet for server-side (doesn't need browser wallet adapter)
class NodeWallet {
  constructor(readonly payer: Keypair) {}

  async signTransaction(tx: any) {
    tx.partialSign(this.payer);
    return tx;
  }

  async signAllTransactions(txs: any[]) {
    return txs.map((tx) => {
      tx.partialSign(this.payer);
      return tx;
    });
  }

  get publicKey() {
    return this.payer.publicKey;
  }
}

const DRIFT_PROGRAM_ID = new PublicKey('dRiftyHA39MWEi3m9aunc5MzRF1JYuBsbn6VPcn33UH');
const CACHE_TIMEOUT = 5 * 60 * 1000; // 5 minutes
const HEARTBEAT_INTERVAL = 60 * 1000; // 1 minute
const LOG_PREFIX = '[DriftClientManager]';

interface CachedClient {
  client: DriftClient;
  lastUsed: number;
  isSubscribed: boolean;
  createdAt: number;
}

// Singleton cache for read-only client (API routes)
let readOnlyClient: CachedClient | null = null;
let initializingPromise: Promise<DriftClient> | null = null;
let refreshTimer: NodeJS.Timeout | null = null;
let heartbeatTimer: NodeJS.Timeout | null = null;

// Event emitter for lifecycle events
export const clientEvents = new EventEmitter();

// Event types
export enum DriftClientEvent {
  CREATED = 'client:created',
  REUSED = 'client:reused',
  INVALIDATED = 'client:invalidated',
  HEALTH_CHECK_FAILED = 'client:health_check_failed',
  RECONNECTED = 'client:reconnected',
  ERROR = 'client:error',
}

/**
 * Helper: Log with consistent prefix
 */
function log(message: string, data?: any) {
  if (data) {
    console.info(LOG_PREFIX, message, data);
  } else {
    console.info(LOG_PREFIX, message);
  }
}

/**
 * Helper: Schedule auto-refresh before cache expires
 */
function scheduleAutoRefresh() {
  // Clear existing timer
  if (refreshTimer) {
    clearTimeout(refreshTimer);
  }

  // Schedule refresh at 90% of cache timeout
  const refreshDelay = CACHE_TIMEOUT * 0.9;
  refreshTimer = setTimeout(async () => {
    if (readOnlyClient && Date.now() - readOnlyClient.lastUsed > CACHE_TIMEOUT * 0.9) {
      log('⏰ Proactive refresh triggered before cache expiry');
      await invalidateDriftClient();
    }
  }, refreshDelay);
}

/**
 * Helper: Start background heartbeat
 */
function startHeartbeat() {
  // Clear existing heartbeat
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
  }

  heartbeatTimer = setInterval(async () => {
    if (readOnlyClient) {
      const healthy = await checkDriftClientHealth();
      if (!healthy) {
        log('💔 Heartbeat detected unhealthy connection, invalidating...');
        clientEvents.emit(DriftClientEvent.HEALTH_CHECK_FAILED);
        await invalidateDriftClient();
      }
    }
  }, HEARTBEAT_INTERVAL);
}

/**
 * Get or create a read-only DriftClient for API routes
 * Uses singleton pattern with auto-reconnect
 * 
 * ✅ Race-safe: Uses shared Promise instead of recursion
 * ✅ Auto-refresh: Schedules proactive refresh before expiry
 * ✅ Health monitoring: Background heartbeat detects stale connections
 */
export async function getReadOnlyDriftClient(): Promise<DriftClient> {
  const now = Date.now();

  // If client exists and is fresh, reuse it
  if (readOnlyClient && readOnlyClient.isSubscribed && (now - readOnlyClient.lastUsed) < CACHE_TIMEOUT) {
    const age = now - readOnlyClient.lastUsed;
    log('♻️ Reusing cached client', { age, cacheTimeout: CACHE_TIMEOUT });
    readOnlyClient.lastUsed = now;
    clientEvents.emit(DriftClientEvent.REUSED, { age });
    return readOnlyClient.client;
  }

  // If another call is already initializing, wait for it (race-safe!)
  if (initializingPromise) {
    log('⏳ Waiting for existing initialization...');
    return initializingPromise;
  }

  // Create new client with Promise-based lock
  initializingPromise = (async () => {
    log('🔄 Creating new read-only DriftClient...');

    try {
      // Cleanup old client if exists
      if (readOnlyClient?.client) {
        try {
          await readOnlyClient.client.unsubscribe();
          log('🗑️ Unsubscribed old client');
        } catch (err) {
          log('⚠️ Failed to unsubscribe old client', { error: String(err) });
        }
      }

      // Create connection
      const rpcUrl = process.env.NEXT_PUBLIC_SOLANA_RPC || 'https://api.devnet.solana.com';
      const connection = new Connection(rpcUrl, 'confirmed');

      // Create dummy wallet for read-only operations
      const dummyKeypair = Keypair.generate();
      const wallet = new NodeWallet(dummyKeypair);

      // Create client
      const client = new DriftClient({
        connection,
        wallet: wallet as any,
        programID: DRIFT_PROGRAM_ID,
        env: 'devnet',
        accountSubscription: {
          type: 'websocket',
        },
      });

      // Subscribe (this is the expensive part we're caching)
      log('📡 Subscribing to Drift...');
      await client.subscribe();
      log('✅ DriftClient subscribed and cached');

      // Cache it
      readOnlyClient = {
        client,
        lastUsed: now,
        isSubscribed: true,
        createdAt: now,
      };

      // Emit lifecycle event
      clientEvents.emit(DriftClientEvent.CREATED, { timestamp: now });

      // Schedule proactive refresh
      scheduleAutoRefresh();

      // Start heartbeat if not already running
      if (!heartbeatTimer) {
        startHeartbeat();
      }

      return client;
    } catch (err) {
      log('❌ Failed to create DriftClient', { error: String(err) });
      clientEvents.emit(DriftClientEvent.ERROR, { error: err });
      readOnlyClient = null;
      throw err;
    } finally {
      initializingPromise = null;
    }
  })();

  return initializingPromise;
}

/**
 * Manually invalidate the cached client
 * Useful if you detect stale data or connection errors
 */
export async function invalidateDriftClient(): Promise<void> {
  if (readOnlyClient?.client) {
    log('🗑️ Invalidating cached DriftClient...');
    try {
      await readOnlyClient.client.unsubscribe();
      clientEvents.emit(DriftClientEvent.INVALIDATED, { timestamp: Date.now() });
    } catch (err) {
      log('⚠️ Error unsubscribing during invalidation', { error: String(err) });
    }
    readOnlyClient = null;
  }

  // Clear timers
  if (refreshTimer) {
    clearTimeout(refreshTimer);
    refreshTimer = null;
  }
}

/**
 * Get cache statistics (for debugging)
 */
export function getDriftClientStats() {
  if (!readOnlyClient) {
    return {
      cached: false,
      age: 0,
      isSubscribed: false,
      uptime: 0,
      cacheTimeout: CACHE_TIMEOUT,
      heartbeatActive: !!heartbeatTimer,
      refreshScheduled: !!refreshTimer,
    };
  }

  const now = Date.now();
  return {
    cached: true,
    age: now - readOnlyClient.lastUsed,
    uptime: now - readOnlyClient.createdAt,
    isSubscribed: readOnlyClient.isSubscribed,
    cacheTimeout: CACHE_TIMEOUT,
    heartbeatActive: !!heartbeatTimer,
    refreshScheduled: !!refreshTimer,
    timeUntilExpiry: CACHE_TIMEOUT - (now - readOnlyClient.lastUsed),
  };
}

/**
 * Stop all background timers (useful for graceful shutdown)
 */
export function stopBackgroundTasks(): void {
  if (refreshTimer) {
    clearTimeout(refreshTimer);
    refreshTimer = null;
  }
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
  log('🛑 Background tasks stopped');
}

/**
 * Health check - ensures client is responsive
 * ✅ Uses actual RPC call instead of local cache
 */
export async function checkDriftClientHealth(): Promise<boolean> {
  if (!readOnlyClient?.client) {
    return false;
  }

  try {
    // Use getLatestBlockhash as lightweight RPC health ping
    // This actually makes a network call, unlike getPerpMarketAccounts() which reads cache
    await readOnlyClient.client.connection.getLatestBlockhash('confirmed');
    return true;
  } catch (err) {
    log('💔 Health check failed', { error: String(err) });
    clientEvents.emit(DriftClientEvent.HEALTH_CHECK_FAILED, { error: err });
    return false;
  }
}

