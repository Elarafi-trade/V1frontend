/**
 * Markets API - Cached market data and search
 */

import { getReadOnlyDriftClient } from './clientManager';
import { getAllDriftMarkets, decodeMarketName } from './marketLookup';

// Simple in-memory cache
let marketsCache: any[] = [];
let cacheTimestamp: number = 0;
const CACHE_TTL = 60000; // 1 minute

/**
 * Get cached markets or fetch fresh data
 */
export async function getCachedMarkets() {
  const now = Date.now();
  
  // Return cached data if still valid
  if (marketsCache.length > 0 && (now - cacheTimestamp) < CACHE_TTL) {
    return marketsCache;
  }
  
  try {
    const driftClient = await getReadOnlyDriftClient();
    const { markets } = await getAllDriftMarkets(driftClient);
    
    // Transform to simple format
    marketsCache = markets.map(market => ({
      marketIndex: market.marketIndex,
      symbol: decodeMarketName(market.name),
      name: decodeMarketName(market.name),
    }));
    
    cacheTimestamp = now;
    return marketsCache;
  } catch (error) {
    console.error('Error fetching markets:', error);
    // Return cached data even if expired on error
    return marketsCache;
  }
}

/**
 * Search markets by symbol
 */
export async function searchMarkets(query: string) {
  const markets = await getCachedMarkets();
  const lowerQuery = query.toLowerCase();
  
  return markets.filter(market => 
    market.symbol.toLowerCase().includes(lowerQuery)
  );
}

/**
 * Get popular trading pairs
 */
export async function getPopularPairs(limit: number = 10) {
  const markets = await getCachedMarkets();
  
  // Popular pairs based on common tokens
  const popular = ['SOL', 'BTC', 'ETH', 'JUP', 'JITO', 'DRIFT'];
  const filtered = markets.filter(m => 
    popular.some(p => m.symbol.includes(p))
  );
  
  return filtered.slice(0, limit);
}

