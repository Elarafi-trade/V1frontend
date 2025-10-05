import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import { DriftClient, PositionDirection, OrderType } from '@drift-labs/sdk';
import { Wallet } from '@coral-xyz/anchor';

/**
 * GET /api/monitor/tp-sl
 * Monitors all open positions for TP/SL triggers and auto-closes them
 * This should be called by a cron job every 10-30 seconds
 */
export async function GET(req: NextRequest) {
  try {
    console.log('🔍 Monitoring TP/SL triggers...');

    // Get all open positions with TP or SL set
    const positions = await prisma.position.findMany({
      where: {
        status: 'OPEN',
        OR: [
          { takeProfitRatio: { not: null } },
          { stopLossRatio: { not: null } },
        ],
      },
      include: {
        user: {
          select: {
            walletAddress: true,
          },
        },
      },
    });

    console.log(`📊 Found ${positions.length} positions with TP/SL to monitor`);

    if (positions.length === 0) {
      return NextResponse.json({
        success: true,
        monitored: 0,
        triggered: 0,
      });
    }

    // Connect to Drift to get current prices
    const connection = new Connection(
      process.env.NEXT_PUBLIC_RPC_URL || 'https://api.devnet.solana.com',
      'confirmed'
    );

    // Use singleton DriftClient (much faster - no subscribe() delay)
    const { getReadOnlyDriftClient } = await import('@/lib/drift/clientManager');
    const driftClient = await getReadOnlyDriftClient();

    const triggered: string[] = [];

    // Check each position
    for (const position of positions) {
      try {
        // Get current prices from Drift oracles
        const longMarket = driftClient.getPerpMarketAccount(position.longMarketIndex);
        const shortMarket = driftClient.getPerpMarketAccount(position.shortMarketIndex);

        if (!longMarket || !shortMarket) {
          console.warn(`⚠️ Markets not found for position ${position.id}`);
          continue;
        }

        const longPrice = longMarket.amm.historicalOracleData.lastOraclePrice.toNumber() / 1e6;
        const shortPrice = shortMarket.amm.historicalOracleData.lastOraclePrice.toNumber() / 1e6;
        const currentRatio = longPrice / shortPrice;

        console.log(`📊 Position ${position.id.slice(0, 8)}... - Current ratio: ${currentRatio.toFixed(6)}`);

        let shouldClose = false;
        let triggerType: 'TP' | 'SL' | null = null;

        // Check Take Profit
        if (position.takeProfitRatio && currentRatio >= position.takeProfitRatio) {
          console.log(`🎯 TAKE PROFIT TRIGGERED! Current: ${currentRatio.toFixed(6)} >= TP: ${position.takeProfitRatio.toFixed(6)}`);
          shouldClose = true;
          triggerType = 'TP';
        }

        // Check Stop Loss
        if (position.stopLossRatio && currentRatio <= position.stopLossRatio) {
          console.log(`🛑 STOP LOSS TRIGGERED! Current: ${currentRatio.toFixed(6)} <= SL: ${position.stopLossRatio.toFixed(6)}`);
          shouldClose = true;
          triggerType = 'SL';
        }

        if (shouldClose) {
          console.log(`⚡ Auto-closing position ${position.id}...`);

          // Calculate P&L
          const ratioChange = (currentRatio - position.entryRatio) / position.entryRatio;
          const realizedPnl = position.capitalUSDC * position.leverage * ratioChange;

          // Update database to mark as closed
          await prisma.position.update({
            where: { id: position.id },
            data: {
              status: 'CLOSED',
              closeTimestamp: new Date(),
              closeRatio: currentRatio,
              closeLongPrice: longPrice,
              closeShortPrice: shortPrice,
              realizedPnL: realizedPnl,
              realizedPnLPercent: ratioChange * 100,
            },
          });

        // Try to create notification (don't fail if this errors)
        try {
          await prisma.notification.create({
            data: {
              userId: position.userId,
              type: triggerType === 'TP' ? 'TP_HIT' : 'SL_HIT',
              title: triggerType === 'TP' ? '🎯 Take Profit Hit!' : '🛑 Stop Loss Hit',
              message: 
                `Position ${position.longMarketSymbol}/${position.shortMarketSymbol} closed automatically.\n\n` +
                `Entry: ${position.entryRatio.toFixed(6)}\n` +
                `Exit: ${currentRatio.toFixed(6)}\n` +
                `P&L: ${realizedPnl >= 0 ? '+' : ''}$${realizedPnl.toFixed(2)} (${(ratioChange * 100).toFixed(2)}%)`,
              data: {
                positionId: position.id,
                trigger: triggerType,
                entryRatio: position.entryRatio,
                exitRatio: currentRatio,
                pnl: realizedPnl,
              },
            },
          });
        } catch (notifError) {
          console.warn('⚠️ Failed to create notification:', notifError);
          // Continue anyway - notification is not critical
        }

          triggered.push(position.id);

          console.log(`✅ Position ${position.id} closed via ${triggerType}`);
          console.log(`   P&L: ${realizedPnl >= 0 ? '+' : ''}$${realizedPnl.toFixed(2)}`);
        }
      } catch (error) {
        console.error(`❌ Error monitoring position ${position.id}:`, error);
        // Continue with next position
      }
    }

    // Don't unsubscribe - keep singleton alive for reuse
    return NextResponse.json({
      success: true,
      monitored: positions.length,
      triggered: triggered.length,
      closedPositions: triggered,
    });

  } catch (error) {
    console.error('❌ Error in TP/SL monitoring:', error);
    return NextResponse.json(
      {
        error: 'Failed to monitor TP/SL',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

