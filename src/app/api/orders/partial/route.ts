/**
 * API Route: /api/orders/partial
 * Fetches partially filled positions (one leg filled, one leg pending)
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getReadOnlyDriftClient } from '@/lib/drift/clientManager';
import { PublicKey } from '@solana/web3.js';
import { OrderType } from '@drift-labs/sdk';

// Helper to get market symbol from market index
function getMarketSymbol(marketIndex: number): string {
  const marketMap: { [key: number]: string } = {
    0: 'SOL',
    1: 'BTC',
    2: 'ETH',
    3: 'APT',
    // Add more markets as needed
  };
  return marketMap[marketIndex] || `Market-${marketIndex}`;
}

// Helper to get order type string
function getOrderTypeString(orderType: OrderType): string {
  const typeMap: { [key: number]: string } = {
    0: 'Market',
    1: 'Limit',
    2: 'TriggerMarket',
    3: 'TriggerLimit',
    4: 'Oracle',
  };
  return typeMap[orderType] || 'Unknown';
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const walletAddress = searchParams.get('wallet');

    if (!walletAddress) {
      return NextResponse.json(
        { error: 'Wallet address is required' },
        { status: 400 }
      );
    }

    console.log(`📋 Fetching partial positions for wallet: ${walletAddress}`);

    // 1. Fetch positions with status='PARTIAL' from database
    const partialPositions = await prisma.position.findMany({
      where: {
        user: {
          walletAddress: walletAddress,
        },
        status: 'PARTIAL',
      },
      orderBy: {
        entryTimestamp: 'desc',
      },
    });

    console.log(`📊 Found ${partialPositions.length} partial positions in DB`);

    if (partialPositions.length === 0) {
      return NextResponse.json({
        success: true,
        orders: [],
      });
    }

    // 2. Get read-only Drift client to fetch order details
    const driftClient = await getReadOnlyDriftClient();

    // 3. Try to get user account from Drift
    let userAccount = null;
    try {
      const userPublicKey = new PublicKey(walletAddress);
      userAccount = await driftClient.getUserAccount(0, userPublicKey);
    } catch (error) {
      console.warn(`⚠️ Could not fetch user account for ${walletAddress}:`, error);
      // Return partial positions with basic info even if we can't get order details
    }

    // 4. Build pending orders from partial positions
    const orders = [];

    for (const position of partialPositions) {
      const partialLeg = position.partialLeg;
      
      if (!partialLeg) {
        console.warn(`⚠️ Position ${position.id} has PARTIAL status but no partialLeg set`);
        continue;
      }

      // Determine which market is pending
      const isPendingLong = partialLeg === 'LONG';
      const pendingMarketIndex = isPendingLong ? position.longMarketIndex : position.shortMarketIndex;
      const pendingMarketSymbol = isPendingLong ? position.longMarketSymbol : position.shortMarketSymbol;
      const pendingAction = isPendingLong ? 'LONG' : 'SHORT';
      
      // Try to find the actual order from Drift if we have user account
      let orderDetails = null;
      if (userAccount && userAccount.orders) {
        // Look for orders matching this market
        orderDetails = userAccount.orders.find((order: any) => 
          order.marketIndex === pendingMarketIndex &&
          order.status === 0 && // Order status: Open
          order.marketType === 1 // Perp market
        );
      }

      // Calculate size and filled amount
      const capitalPerLeg = position.capitalUSDC * (isPendingLong ? position.longWeight : position.shortWeight);
      const entryPrice = isPendingLong ? position.entryLongPrice : position.entryShortPrice;
      const leverage = position.leverage;
      const size = (capitalPerLeg * leverage) / entryPrice;
      
      const fillPercent = isPendingLong 
        ? (position.longFillPercent || 0) 
        : (position.shortFillPercent || 0);
      const filled = (size * fillPercent) / 100;

      orders.push({
        id: position.id, // Use position ID for easy cancellation
        positionId: position.id,
        pairLong: position.longMarketSymbol,
        pairShort: position.shortMarketSymbol,
        market: pendingMarketSymbol,
        action: pendingAction,
        orderType: orderDetails ? getOrderTypeString(orderDetails.orderType) : 'Oracle',
        size: parseFloat(size.toFixed(4)),
        filled: parseFloat(filled.toFixed(4)),
        price: orderDetails 
          ? parseFloat((orderDetails.price / 1e6).toFixed(2))
          : entryPrice,
        createdAt: position.entryTimestamp,
        marketIndex: pendingMarketIndex,
      });
    }

    console.log(`✅ Returning ${orders.length} partial orders`);

    return NextResponse.json({
      success: true,
      orders,
    });
  } catch (error: any) {
    console.error('❌ Error fetching partial orders:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch partial orders',
        details: error.message,
      },
      { status: 500 }
    );
  }
}

