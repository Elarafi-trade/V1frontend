import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

/**
 * GET /api/positions/[id]
 * Get a specific position by ID
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const position = await prisma.position.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            walletAddress: true,
            username: true,
          },
        },
      },
    });

    if (!position) {
      return NextResponse.json(
        { error: 'Position not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ position });

  } catch (error) {
    console.error('Error fetching position:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to fetch position',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

