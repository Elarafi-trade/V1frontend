import { NextRequest, NextResponse } from 'next/server';
import { Connection, PublicKey, Keypair } from '@solana/web3.js';
import { DriftClient, loadKeypair } from '@drift-labs/sdk';
import { prisma } from '@/lib/db';
import { getAccuratePositionMetrics } from '@/lib/calculations/liquidation';

const DRIFT_PROGRAM_ID = 'dRiftyHA39MWEi3m9aunc5MzRF1JYuBsbn6VPcn33UH';

/**
 * GET /api/positions/live-pnl?wallet={address}
 * Calculate live P&L for all open positions by fetching current prices from Drift
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const walletAddress = searchParams.get('wallet');

    if (!walletAddress) {
      return NextResponse.json(
        { error: 'Wallet address is required' },
        { status: 400 }
      );
    }

    // Get user
    const user = await prisma.user.findUnique({
      where: { walletAddress },
    });

    if (!user) {
      return NextResponse.json({
        positions: [],
      });
    }

    // Get open positions
    const positions = await prisma.position.findMany({
      where: {
        userId: user.id,
        status: 'OPEN',
      },
      orderBy: { entryTimestamp: 'desc' },
    });

    if (positions.length === 0) {
      return NextResponse.json({ positions: [] });
    }

    // Create Drift client to fetch current prices (read-only)
    const connection = new Connection(
      process.env.NEXT_PUBLIC_RPC_URL || 'https://api.devnet.solana.com',
      'confirmed'
    );

    // Use singleton DriftClient (much faster - no subscribe() delay)
    const { getReadOnlyDriftClient } = await import('@/lib/drift/clientManager');
    const driftClient = await getReadOnlyDriftClient();

    // Calculate live P&L for each position
    const positionsWithPnL = await Promise.all(
      positions.map(async (position) => {
        try {
          // Get current prices from Drift
          const longMarket = driftClient.getPerpMarketAccount(position.longMarketIndex);
          const shortMarket = driftClient.getPerpMarketAccount(position.shortMarketIndex);

          if (!longMarket || !shortMarket) {
            console.error(`Markets not found for position ${position.id}`);
            return {
              ...position,
              currentRatio: position.entryRatio,
              unrealizedPnl: 0,
            };
          }

          // Get oracle prices
          const longOracle = driftClient.getOracleDataForPerpMarket(position.longMarketIndex);
          const shortOracle = driftClient.getOracleDataForPerpMarket(position.shortMarketIndex);

          const currentLongPrice = longOracle.price.toNumber() / 1e6;
          const currentShortPrice = shortOracle.price.toNumber() / 1e6;
          const currentRatio = currentLongPrice / currentShortPrice;

          // Calculate P&L based on ratio change
          const ratioChange = (currentRatio - position.entryRatio) / position.entryRatio;
          
          // For pair trading:
          // Long position benefits from long asset going up relative to short
          // If ratio increases (long/short goes up), we profit
          // P&L = capital * leverage * ratio_change
          const unrealizedPnl = position.capitalUSDC * position.leverage * ratioChange;
          const unrealizedPnlPercent = (ratioChange * 100);

          // Calculate ACCURATE margin and liquidation using real Drift market data
          let metrics;
          try {
            metrics = await getAccuratePositionMetrics(driftClient, {
              longMarketIndex: position.longMarketIndex,
              shortMarketIndex: position.shortMarketIndex,
              entryRatio: position.entryRatio,
              capitalUSDC: position.capitalUSDC,
              leverage: position.leverage,
              longWeight: position.longWeight,
              shortWeight: position.shortWeight,
              unrealizedPnL: unrealizedPnl,
            });
          } catch (err) {
            console.warn(`Could not calculate accurate metrics for position ${position.id}:`, err);
            metrics = null;
          }

          return {
            ...position,
            currentRatio,
            currentLongPrice,
            currentShortPrice,
            unrealizedPnL: unrealizedPnl,  // Capital L for UI consistency
            unrealizedPnLPercent: unrealizedPnlPercent,  // Capital L for UI consistency
            // Add accurate Drift Protocol metrics
            ...(metrics && {
              initialMargin: metrics.initialMargin,
              maintenanceMargin: metrics.maintenanceMargin,
              liquidationRatio: metrics.liquidationRatio,
              health: metrics.health,
              longMMR: metrics.longMMR,
              shortMMR: metrics.shortMMR,
              longIMR: metrics.longIMR,
              shortIMR: metrics.shortIMR,
            }),
          };
        } catch (err) {
          console.error(`Error calculating P&L for position ${position.id}:`, err);
          return {
            ...position,
            currentRatio: position.entryRatio,
            unrealizedPnL: 0,  // Capital L for UI consistency
            unrealizedPnLPercent: 0,  // Capital L for UI consistency
          };
        }
      })
    );

    // Don't unsubscribe - keep singleton alive for reuse
    return NextResponse.json({
      positions: positionsWithPnL,
    });
  } catch (error) {
    console.error('Error calculating live P&L:', error);

    return NextResponse.json(
      {
        error: 'Failed to calculate live P&L',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

