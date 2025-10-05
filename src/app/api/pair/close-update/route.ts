import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getReadOnlyDriftClient } from '@/lib/drift/clientManager';

/**
 * POST /api/pair/close-update
 * Update position after client closed it on Drift
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    
    const { positionId, closeTxSig, realizedPnl, exitRatio, longCloseTxSig, shortCloseTxSig } = body;

    if (!positionId) {
      return NextResponse.json(
        { error: 'Position ID is required' },
        { status: 400 }
      );
    }

    // Get position
    const position = await prisma.position.findUnique({
      where: { id: positionId },
    });

    if (!position) {
      return NextResponse.json(
        { error: 'Position not found' },
        { status: 404 }
      );
    }

    // Get current prices from Drift using singleton client (fast!)
    let closeRatio = position.entryRatio;
    let closeLongPrice = position.entryLongPrice;
    let closeShortPrice = position.entryShortPrice;

    try {
      const driftClient = await getReadOnlyDriftClient();

      const longMarket = driftClient.getPerpMarketAccount(position.longMarketIndex);
      const shortMarket = driftClient.getPerpMarketAccount(position.shortMarketIndex);

      if (longMarket && shortMarket) {
        closeLongPrice = longMarket.amm.historicalOracleData.lastOraclePrice.toNumber() / 1e6;
        closeShortPrice = shortMarket.amm.historicalOracleData.lastOraclePrice.toNumber() / 1e6;
        closeRatio = closeLongPrice / closeShortPrice;
        console.log(`💰 Fetched close prices: ${position.longMarketSymbol}=$${closeLongPrice.toFixed(2)}, ${position.shortMarketSymbol}=$${closeShortPrice.toFixed(2)}`);
      }
    } catch (err) {
      console.warn('Could not fetch current prices, using entry prices:', err);
    }

    // Calculate PnL
    const ratioChange = (closeRatio - position.entryRatio) / position.entryRatio;
    const realizedPnL = position.capitalUSDC * position.leverage * ratioChange;
    const realizedPnLPercent = ratioChange * 100;

    // Update position
    const updatedPosition = await prisma.position.update({
      where: { id: positionId },
      data: {
        status: 'CLOSED',
        closeTimestamp: new Date(),
        closeRatio,
        closeLongPrice,
        closeShortPrice,
        realizedPnL,
        realizedPnLPercent,
      },
    });

    // Record close trades
    if (longCloseTxSig && shortCloseTxSig) {
      await prisma.trade.createMany({
        data: [
          {
            userId: position.userId,
            positionId: position.id,
            action: 'CLOSE_LONG',
            marketIndex: position.longMarketIndex,
            marketSymbol: position.longMarketSymbol,
            amount: position.capitalUSDC * position.leverage * position.longWeight,
            price: closeLongPrice,
            signature: longCloseTxSig,
            txHash: longCloseTxSig,
          },
          {
            userId: position.userId,
            positionId: position.id,
            action: 'CLOSE_SHORT',
            marketIndex: position.shortMarketIndex,
            marketSymbol: position.shortMarketSymbol,
            amount: position.capitalUSDC * position.leverage * position.shortWeight,
            price: closeShortPrice,
            signature: shortCloseTxSig,
            txHash: shortCloseTxSig,
          },
        ],
      });
    }

    return NextResponse.json({
      success: true,
      position: updatedPosition,
      realizedPnL,
    });

  } catch (error) {
    console.error('Error updating closed position:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to update position',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

