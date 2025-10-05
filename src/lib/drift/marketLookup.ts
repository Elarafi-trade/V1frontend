/**
 * Market Lookup - Get real Drift markets only
 */

import { DriftClient, PerpMarketAccount } from '@drift-labs/sdk';

/**
 * Decode market name from byte array
 */
export function decodeMarketName(nameBytes: any): string {
  try {
    // Handle if it's already a string
    if (typeof nameBytes === 'string') return nameBytes;
    
    // Decode byte array to string
    const buffer = Buffer.from(nameBytes);
    return buffer.toString('utf8').replace(/\0/g, '').trim();
  } catch (e) {
    console.error('Error decoding market name:', e);
    return '';
  }
}

/**
 * Get all available perpetual markets from Drift
 */
export async function getAllDriftMarkets(driftClient: DriftClient): Promise<{
  markets: PerpMarketAccount[];
  marketMap: Map<string, PerpMarketAccount>;
}> {
  const markets = driftClient.getPerpMarketAccounts();
  const marketMap = new Map<string, PerpMarketAccount>();

  markets.forEach(market => {
    const name = decodeMarketName(market.name);
    if (name) {
      marketMap.set(name, market);
      
      // Also add without -PERP suffix for easy lookup
      const baseName = name.replace('-PERP', '');
      marketMap.set(baseName, market);
    }
  });

  return { markets, marketMap };
}

/**
 * Find market by symbol (handles both "SOL" and "SOL-PERP")
 */
export function findMarketBySymbol(
  marketMap: Map<string, PerpMarketAccount>,
  symbol: string
): PerpMarketAccount | undefined {
  // Safety check
  if (!symbol || typeof symbol !== 'string') {
    console.error('Invalid symbol provided to findMarketBySymbol:', symbol);
    return undefined;
  }

  // Try exact match first
  let market = marketMap.get(symbol);
  if (market) return market;

  // Try with -PERP suffix
  market = marketMap.get(`${symbol}-PERP`);
  if (market) return market;

  // Try without -PERP suffix
  const baseSymbol = symbol.replace('-PERP', '');
  market = marketMap.get(baseSymbol);
  if (market) return market;

  return undefined;
}

/**
 * Get list of available token symbols for UI
 */
export function getAvailableTokens(marketMap: Map<string, PerpMarketAccount>): string[] {
  const tokens = new Set<string>();
  
  marketMap.forEach((market, key) => {
    // Only add base names (without -PERP)
    if (!key.includes('-PERP')) {
      tokens.add(key);
    }
  });

  return Array.from(tokens).sort();
}

/**
 * Check if a pair is available for trading
 */
export function isPairAvailable(
  marketMap: Map<string, PerpMarketAccount>,
  longToken: string,
  shortToken: string
): { available: boolean; longMarket?: PerpMarketAccount; shortMarket?: PerpMarketAccount } {
  const longMarket = findMarketBySymbol(marketMap, longToken);
  const shortMarket = findMarketBySymbol(marketMap, shortToken);

  return {
    available: !!(longMarket && shortMarket),
    longMarket,
    shortMarket,
  };
}

