import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

/**
 * GET /api/positions?wallet={address}&status={OPEN|CLOSED}
 * Get all positions for a wallet
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const walletAddress = searchParams.get('wallet');
    const status = searchParams.get('status');

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
        count: 0,
      });
    }

    // Build query
    const where: any = { userId: user.id };
    if (status) {
      where.status = status;
    }

    // Get positions
    const positions = await prisma.position.findMany({
      where,
      orderBy: { entryTimestamp: 'desc' },
      include: {
        user: {
          select: {
            walletAddress: true,
            username: true,
          },
        },
      },
    });

    return NextResponse.json({
      positions,
      count: positions.length,
    });

  } catch (error) {
    console.error('Error fetching positions:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to fetch positions',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

