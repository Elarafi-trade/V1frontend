/**
 * Background Sync Worker
 * 
 * Continuously syncs on-chain Drift positions with the database.
 * Treats on-chain as the SINGLE SOURCE OF TRUTH.
 * 
 * Architecture:
 * - On-chain = Primary (authoritative)
 * - Database = Secondary (read cache / fallback)
 * 
 * Features:
 * - Runs every 30 seconds
 * - Monitors all "OPEN" positions in DB
 * - Checks Drift on-chain state
 * - Auto-closes stale positions
 * - Event-driven (listens to Drift program events)
 */

import { PrismaClient } from '@prisma/client';
import { getReadOnlyDriftClient } from '../lib/drift/clientManager';
import { PublicKey } from '@solana/web3.js';
import BN from 'bn.js';

const prisma = new PrismaClient();

// Sync interval (30 seconds)
const SYNC_INTERVAL_MS = 30 * 1000;

// Grace period for new positions (5 minutes)
const GRACE_PERIOD_MS = 5 * 60 * 1000;

// Minimum position size to consider "closed" (0.001 = dust)
const MIN_POSITION_SIZE = 0.001;

// Log prefix
const LOG_PREFIX = '[Worker]';

interface SyncStats {
  totalChecked: number;
  closed: number;
  errors: number;
  duration: number;
  lastRun: number;
  avgLatency: number;
}

// In-memory cache for worker stats (instant API responses)
let cachedStats: SyncStats | null = null;
let runHistory: number[] = []; // Track last 10 run durations for avgLatency
const MAX_HISTORY = 10;

/**
 * Main sync function - checks all open positions
 */
export async function syncAllPositions(): Promise<SyncStats> {
  const startTime = Date.now();
  const stats: SyncStats = {
    totalChecked: 0,
    closed: 0,
    errors: 0,
    duration: 0,
    lastRun: startTime,
    avgLatency: 0,
  };

  console.log(`\n🔄 ${LOG_PREFIX} Starting position sync...`);

  try {
    // Get all OPEN positions from DB (secondary source)
    const openPositions = await prisma.position.findMany({
      where: {
        status: 'OPEN',
      },
      include: {
        user: true,
      },
    });

    if (openPositions.length === 0) {
      console.log(`✅ ${LOG_PREFIX} No open positions to sync`);
      stats.duration = Date.now() - startTime;
      updateStatsCache(stats);
      return stats;
    }

    console.log(`📊 ${LOG_PREFIX} Checking ${openPositions.length} open positions...`);

    // Get Drift client (singleton - fast!)
    const driftClient = await getReadOnlyDriftClient();

    // Group positions by user for efficient checking
    const positionsByUser = new Map<string, typeof openPositions>();
    openPositions.forEach(pos => {
      const wallet = pos.user.walletAddress;
      if (!positionsByUser.has(wallet)) {
        positionsByUser.set(wallet, []);
      }
      positionsByUser.get(wallet)!.push(pos);
    });

    // Cache for loaded users to avoid repeated addUser calls
    const userCache = new Map<string, any>();

    // Helper to get or load user dynamically
    async function getOrLoadUser(walletAddress: string) {
      if (userCache.has(walletAddress)) {
        return userCache.get(walletAddress);
      }

      try {
        const userPubkey = new PublicKey(walletAddress);
        
        // Try to get existing user
        let user;
        try {
          // Check if user is already loaded
          user = driftClient.getUser(0, userPubkey);
        } catch {
          // User not loaded, add them first
          await driftClient.addUser(0, userPubkey);
          user = driftClient.getUser(0, userPubkey);
        }

        userCache.set(walletAddress, user);
        return user;
      } catch (error: any) {
        console.error(`${LOG_PREFIX} Failed to load user ${walletAddress}:`, error.message);
        return null;
      }
    }

    // Check each position
    for (const position of openPositions) {
      stats.totalChecked++;

      try {
        // Skip if position is too new (still filling)
        const age = Date.now() - position.entryTimestamp.getTime();
        if (age < GRACE_PERIOD_MS) {
          console.log(`⏳ ${LOG_PREFIX} Skipping ${position.id.slice(0, 8)}... (age: ${Math.round(age/1000)}s, grace: ${GRACE_PERIOD_MS/1000}s)`);
          continue;
        }

        // Get user-specific on-chain data
        const user = await getOrLoadUser(position.user.walletAddress);
        if (!user) {
          console.warn(`⚠️ ${LOG_PREFIX} Could not load user for position ${position.id.slice(0, 8)}`);
          stats.errors++;
          continue;
        }

        // Get on-chain positions (PRIMARY source of truth)
        const driftPositions = user.getUserAccount().perpPositions;

        // Check if both legs exist on-chain
        const longPosition = driftPositions.find(
          (p: any) => p.marketIndex === position.longMarketIndex
        );
        const shortPosition = driftPositions.find(
          (p: any) => p.marketIndex === position.shortMarketIndex
        );

        const longSize = longPosition ? Math.abs(longPosition.baseAssetAmount.toNumber() / 1e9) : 0;
        const shortSize = shortPosition ? Math.abs(shortPosition.baseAssetAmount.toNumber() / 1e9) : 0;

        // If either leg is missing or too small, position is closed on-chain
        const isLongClosed = longSize < MIN_POSITION_SIZE;
        const isShortClosed = shortSize < MIN_POSITION_SIZE;

        if (isLongClosed || isShortClosed) {
          console.log(`🔴 ${LOG_PREFIX} Position ${position.id.slice(0, 8)}... closed on-chain`);
          console.log(`   Long: ${longSize.toFixed(6)} (${isLongClosed ? 'CLOSED' : 'OPEN'})`);
          console.log(`   Short: ${shortSize.toFixed(6)} (${isShortClosed ? 'CLOSED' : 'OPEN'})`);

          // Mark as closed in DB (secondary)
          await markPositionClosed(position.id, driftClient);
          stats.closed++;
        }
      } catch (error: any) {
        console.error(`❌ ${LOG_PREFIX} Error checking position ${position.id}:`, error.message);
        stats.errors++;
        // Continue checking other positions despite error
      }
    }

    stats.duration = Date.now() - startTime;
    
    // Update average latency
    runHistory.push(stats.duration);
    if (runHistory.length > MAX_HISTORY) {
      runHistory.shift();
    }
    stats.avgLatency = runHistory.reduce((a, b) => a + b, 0) / runHistory.length;
    
    console.log(`✅ ${LOG_PREFIX} Sync complete: ${stats.totalChecked} checked, ${stats.closed} closed, ${stats.errors} errors (${stats.duration}ms, avg: ${Math.round(stats.avgLatency)}ms)`);

    // Cache stats for instant API responses
    updateStatsCache(stats);

    return stats;
  } catch (error: any) {
    console.error(`❌ ${LOG_PREFIX} Fatal error:`, error);
    stats.duration = Date.now() - startTime;
    stats.errors++;
    
    // Update average latency even on error
    runHistory.push(stats.duration);
    if (runHistory.length > MAX_HISTORY) {
      runHistory.shift();
    }
    stats.avgLatency = runHistory.reduce((a, b) => a + b, 0) / runHistory.length;
    
    // Cache stats for instant API responses
    updateStatsCache(stats);
    
    return stats;
  }
}

/**
 * Update the in-memory stats cache
 * Allows /api/worker/status to return instantly without DB queries
 */
function updateStatsCache(stats: SyncStats): void {
  cachedStats = {
    ...stats,
    lastRun: Date.now(),
  };
}

/**
 * Get cached stats (instant, no DB query)
 */
export function getCachedStats(): SyncStats | null {
  return cachedStats;
}

/**
 * Mark a position as closed in the database
 * Fetches final prices from on-chain for accurate P&L
 */
async function markPositionClosed(positionId: string, driftClient: any): Promise<void> {
  try {
    const position = await prisma.position.findUnique({
      where: { id: positionId },
    });

    if (!position) {
      console.warn(`⚠️ Position ${positionId} not found in DB`);
      return;
    }

    // Get final prices from on-chain (PRIMARY)
    const longMarket = driftClient.getPerpMarketAccount(position.longMarketIndex);
    const shortMarket = driftClient.getPerpMarketAccount(position.shortMarketIndex);

    let closeLongPrice = position.entryLongPrice;
    let closeShortPrice = position.entryShortPrice;
    let closeRatio = position.entryRatio;

    if (longMarket && shortMarket) {
      closeLongPrice = longMarket.amm.historicalOracleData.lastOraclePrice.toNumber() / 1e6;
      closeShortPrice = shortMarket.amm.historicalOracleData.lastOraclePrice.toNumber() / 1e6;
      closeRatio = closeLongPrice / closeShortPrice;
    }

    // Calculate P&L
    const ratioDiff = closeRatio - position.entryRatio;
    const pnlPercent = (ratioDiff / position.entryRatio) * 100;
    const pnlUSD = (position.capitalUSDC * position.leverage * pnlPercent) / 100;

    // Update DB (secondary)
    await prisma.position.update({
      where: { id: positionId },
      data: {
        status: 'CLOSED',
        closeTimestamp: new Date(),
        closeRatio,
        closeLongPrice,
        closeShortPrice,
        realizedPnL: pnlUSD,
        realizedPnLPercent: pnlPercent,
      },
    });

    console.log(`✅ ${LOG_PREFIX} Marked ${positionId.slice(0, 8)}... as CLOSED (P&L: ${pnlPercent > 0 ? '+' : ''}${pnlPercent.toFixed(2)}%)`);
  } catch (error: any) {
    console.error(`❌ ${LOG_PREFIX} Error marking position closed:`, error.message);
    throw error;
  }
}

/**
 * Start the background sync worker
 * Runs continuously with configurable interval
 * 
 * ✅ Self-healing: Each iteration wrapped in try/catch
 * ✅ Auto-restart: Even if one iteration fails, next one runs
 * ✅ Resilient: RPC timeouts, socket hiccups won't kill the worker
 */
export function startSyncWorker(intervalMs: number = SYNC_INTERVAL_MS): NodeJS.Timeout {
  console.log(`🚀 ${LOG_PREFIX} Starting background sync worker...`);
  console.log(`   Interval: ${intervalMs / 1000}s`);
  console.log(`   Grace period: ${GRACE_PERIOD_MS / 1000}s`);

  // Self-healing run wrapper
  const run = async () => {
    try {
      await syncAllPositions();
    } catch (err: any) {
      console.error(`❌ ${LOG_PREFIX} Sync iteration failed (will retry):`, err.message);
      // Don't throw - let next iteration run
    }
  };

  // Run immediately on start
  run();

  // Then run on interval with self-healing
  const interval = setInterval(run, intervalMs);

  console.log(`✅ ${LOG_PREFIX} Background sync worker started`);
  return interval;
}

/**
 * Stop the sync worker
 */
export function stopSyncWorker(interval: NodeJS.Timeout): void {
  clearInterval(interval);
  console.log(`🛑 ${LOG_PREFIX} Background sync worker stopped`);
}

/**
 * Get worker statistics (for monitoring endpoint)
 * ✅ Returns cached stats instantly (no DB query!)
 * ✅ Only queries DB if cache is empty or for detailed stats
 */
export async function getWorkerStats(detailed: boolean = false) {
  // Return cached stats if available (instant!)
  if (cachedStats && !detailed) {
    return {
      cached: true,
      lastRun: cachedStats.lastRun,
      lastRunAgo: Date.now() - cachedStats.lastRun,
      stats: {
        totalChecked: cachedStats.totalChecked,
        closed: cachedStats.closed,
        errors: cachedStats.errors,
        duration: cachedStats.duration,
        avgLatency: Math.round(cachedStats.avgLatency),
      },
      config: {
        syncInterval: SYNC_INTERVAL_MS / 1000,
        gracePeriod: GRACE_PERIOD_MS / 1000,
      },
    };
  }

  // Fallback: Query DB for detailed stats (slower)
  const openCount = await prisma.position.count({
    where: { status: 'OPEN' },
  });

  const closedCount = await prisma.position.count({
    where: { status: 'CLOSED' },
  });

  const recentlyClosed = await prisma.position.count({
    where: {
      status: 'CLOSED',
      closeTimestamp: {
        gte: new Date(Date.now() - 60 * 60 * 1000), // Last hour
      },
    },
  });

  return {
    cached: false,
    lastRun: cachedStats?.lastRun || 0,
    lastRunAgo: cachedStats ? Date.now() - cachedStats.lastRun : -1,
    stats: cachedStats || {
      totalChecked: 0,
      closed: 0,
      errors: 0,
      duration: 0,
      avgLatency: 0,
    },
    detailed: {
      openPositions: openCount,
      closedPositions: closedCount,
      closedLastHour: recentlyClosed,
    },
    config: {
      syncInterval: SYNC_INTERVAL_MS / 1000,
      gracePeriod: GRACE_PERIOD_MS / 1000,
    },
  };
}

