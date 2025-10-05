import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

/**
 * POST /api/pair/save
 * Save a pair trading position to database (after client opened it on Drift)
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    
    const {
      walletAddress,
      longMarketIndex,
      longMarketSymbol,
      shortMarketIndex,
      shortMarketSymbol,
      capitalUSDC,
      leverage,
      longWeight,
      shortWeight,
      entryRatio,
      entryLongPrice,
      entryShortPrice,
      takeProfitPercent,
      stopLossPercent,
      longTxSignature,
      shortTxSignature,
    } = body;

    // Validation
    if (!walletAddress || !longTxSignature || !shortTxSignature) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Get or create user
    const user = await prisma.user.upsert({
      where: { walletAddress },
      create: { walletAddress },
      update: { lastLoginAt: new Date() },
    });

    // Calculate TP/SL ratios
    const tpRatio = takeProfitPercent
      ? entryRatio * (1 + takeProfitPercent / 100)
      : null;
    const slRatio = stopLossPercent
      ? entryRatio * (1 - stopLossPercent / 100)
      : null;

    // Save position
    const position = await prisma.position.create({
      data: {
        userId: user.id,
        longMarketIndex,
        longMarketSymbol,
        shortMarketIndex,
        shortMarketSymbol,
        capitalUSDC,
        leverage,
        longWeight: longWeight || 0.5,
        shortWeight: shortWeight || 0.5,
        entryRatio,
        entryLongPrice,
        entryShortPrice,
        takeProfitRatio: tpRatio,
        takeProfitPercent,
        stopLossRatio: slRatio,
        stopLossPercent,
        status: 'OPEN',
        pair: `${longMarketSymbol}/${shortMarketSymbol}`,
        driftLongPositionId: longTxSignature,
        driftShortPositionId: shortTxSignature,
      },
    });

    // Record trades
    // Note: Since both orders are in the same transaction, we append suffixes to make signatures unique
    await prisma.trade.createMany({
      data: [
        {
          userId: user.id,
          positionId: position.id,
          action: 'OPEN_LONG',
          marketIndex: longMarketIndex,
          marketSymbol: longMarketSymbol,
          amount: capitalUSDC * leverage * (longWeight || 0.5),
          price: entryLongPrice,
          signature: `${longTxSignature}-long`,
          txHash: `${longTxSignature}-long`,
        },
        {
          userId: user.id,
          positionId: position.id,
          action: 'OPEN_SHORT',
          marketIndex: shortMarketIndex,
          marketSymbol: shortMarketSymbol,
          amount: capitalUSDC * leverage * (shortWeight || 0.5),
          price: entryShortPrice,
          signature: `${shortTxSignature}-short`,
          txHash: `${shortTxSignature}-short`,
        },
      ],
    });

    return NextResponse.json({
      success: true,
      positionId: position.id,
    });

  } catch (error) {
    console.error('Error saving position:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to save position',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

