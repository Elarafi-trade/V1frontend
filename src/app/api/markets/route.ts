import { NextRequest, NextResponse } from 'next/server';
import { getCachedMarkets, searchMarkets, getPopularPairs } from '@/lib/drift/markets';

/**
 * GET /api/markets?search={query}&popular={true}
 * Get all Drift perpetual markets or search
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const searchQuery = searchParams.get('search');
    const showPopular = searchParams.get('popular') === 'true';

    if (showPopular) {
      // Get popular trading pairs
      const pairs = await getPopularPairs(10);
      return NextResponse.json({ pairs });
    }

    if (searchQuery) {
      // Search markets by symbol
      const markets = await searchMarkets(searchQuery);
      return NextResponse.json({ markets, count: markets.length });
    }

    // Get all cached markets
    const markets = await getCachedMarkets();
    
    return NextResponse.json({
      markets,
      count: markets.length,
    });

  } catch (error) {
    console.error('Error fetching markets:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to fetch markets',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

