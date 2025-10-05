/**
 * API Route: /api/orders/cancel
 * Marks partially filled positions as canceled in the database.
 * The actual Drift transaction (canceling orders and closing positions) 
 * should be handled by the frontend using the user's wallet.
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { positionId, walletAddress, cancelAll = false } = body;

    if (!walletAddress) {
      return NextResponse.json(
        { error: 'Wallet address is required' },
        { status: 400 }
      );
    }

    console.log(`🗑️ Marking partial position(s) as canceled: ${cancelAll ? 'ALL' : positionId}`);

    // Fetch position(s) to cancel
    const positions = cancelAll
      ? await prisma.position.findMany({
          where: {
            user: { walletAddress },
            status: 'PARTIAL',
          },
        })
      : await prisma.position.findMany({
          where: {
            id: positionId,
            user: { walletAddress },
            status: 'PARTIAL',
          },
        });

    if (positions.length === 0) {
      return NextResponse.json(
        { error: 'No partial positions found' },
        { status: 404 }
      );
    }

    console.log(`📊 Found ${positions.length} position(s) to cancel`);

    const canceledPositions = [];

    // Update each position's status in database
    for (const position of positions) {
      try {
        const partialLegInfo = (position as any).partialLeg || 'unknown';
        await prisma.position.update({
          where: { id: position.id },
          data: {
            status: 'CLOSED',
            closeTimestamp: new Date(),
            notes: position.notes 
              ? `${position.notes} | Canceled partial position (${partialLegInfo} leg unfilled)`
              : `Canceled partial position (${partialLegInfo} leg unfilled)`,
          },
        });

        canceledPositions.push(position.id);
        console.log(`✅ Position ${position.id} marked as closed in database`);
      } catch (error: any) {
        console.error(`❌ Error updating position ${position.id}:`, error);
      }
    }

    return NextResponse.json({
      success: true,
      canceled: canceledPositions.length,
      canceledPositions,
      message: 'Positions marked as canceled in database. Frontend should handle Drift transactions.',
    });
  } catch (error: any) {
    console.error('❌ Error in cancel order API:', error);
    return NextResponse.json(
      {
        error: 'Failed to cancel orders',
        details: error.message,
      },
      { status: 500 }
    );
  }
}
