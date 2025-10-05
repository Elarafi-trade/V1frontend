import { NextRequest, NextResponse } from 'next/server';
import { PublicKey } from '@solana/web3.js';
import { getReadOnlyDriftClient } from '@/lib/drift/clientManager';

/**
 * GET /api/orders/pending?wallet=ADDRESS
 * Fetches pending (unfilled) orders from Drift Protocol
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const walletAddress = searchParams.get('wallet');

    if (!walletAddress) {
      return NextResponse.json(
        { error: 'Missing wallet parameter' },
        { status: 400 }
      );
    }

    // Get read-only Drift client (singleton, fast)
    const driftClient = await getReadOnlyDriftClient();
    
    // Get user account
    const userPublicKey = new PublicKey(walletAddress);
    const userAccountPublicKey = await PublicKey.findProgramAddress(
      [Buffer.from('user'), userPublicKey.toBuffer(), Buffer.from([0])],
      driftClient.program.programId
    );

    try {
      // Fetch user account to get orders
      const userAccount = await driftClient.program.account.user.fetch(userAccountPublicKey[0]);
      
      // Filter for pending perp orders (not filled or cancelled)
      const pendingOrders = userAccount.orders
        .map((order: any, index: number) => ({
          ...order,
          orderIndex: index,
        }))
        .filter((order: any) => {
          // Check if order exists and is not fully filled or cancelled
          const hasOrder = order.status && (
            order.status.open || 
            order.status.init ||
            order.status === 1 || // OPEN status enum value
            order.status === 0    // INIT status enum value
          );
          
          const isPerpOrder = order.marketType && (
            order.marketType.perp || 
            order.marketType === 0  // PERP market type enum value
          );
          
          const hasSize = order.baseAssetAmount && order.baseAssetAmount.gt(0);
          
          return hasOrder && isPerpOrder && hasSize;
        })
        .map((order: any) => {
          // Get market symbol from market index
          const marketIndex = order.marketIndex;
          let marketSymbol = 'UNKNOWN';
          
          try {
            const perpMarketAccount = driftClient.getPerpMarketAccount(marketIndex);
            if (perpMarketAccount) {
              // Decode market symbol from bytes
              const symbolBytes = perpMarketAccount.name;
              marketSymbol = String.fromCharCode(...symbolBytes).replace(/\0/g, '').trim();
            }
          } catch (err) {
            console.warn(`Could not get market symbol for index ${marketIndex}:`, err);
          }
          
          // Determine order direction
          const direction = order.direction && (order.direction.long || order.direction === 0) 
            ? 'LONG' 
            : 'SHORT';
          
          // Get order type
          let orderType = 'Market';
          if (order.orderType) {
            if (order.orderType.limit || order.orderType === 1) orderType = 'Limit';
            if (order.orderType.oracle || order.orderType === 3) orderType = 'Oracle';
          }
          
          // Calculate price
          let price = 0;
          if (order.price) {
            price = order.price.toNumber() / 1e6; // Drift uses 1e6 precision
          }
          
          // Get filled amount
          const baseAssetAmount = order.baseAssetAmount.toNumber() / 1e9; // BASE_PRECISION
          const baseAssetAmountFilled = order.baseAssetAmountFilled 
            ? order.baseAssetAmountFilled.toNumber() / 1e9 
            : 0;
          
          return {
            orderIndex: order.orderIndex,
            marketIndex,
            marketSymbol,
            direction,
            orderType,
            size: baseAssetAmount,
            filled: baseAssetAmountFilled,
            price,
            timestamp: order.slot ? new Date(order.slot * 400).toISOString() : new Date().toISOString(), // Approximate timestamp
            status: 'PENDING',
          };
        });

      return NextResponse.json({
        orders: pendingOrders,
        count: pendingOrders.length,
      });
      
    } catch (userErr) {
      // User account might not exist yet (no orders placed)
      console.log('User account not found or no orders:', userErr);
      return NextResponse.json({
        orders: [],
        count: 0,
      });
    }
  } catch (error) {
    console.error('Error fetching pending orders:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch pending orders',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

