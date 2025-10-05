/**
 * Price Cache Service
 * 
 * In-memory cache for market prices with change detection.
 * Only broadcasts when prices change significantly (>0.1%).
 * 
 * Features:
 * - Deduplicates price updates
 * - Detects significant price changes
 * - Throttles broadcast frequency
 * - Memory-efficient storage
 */

export interface PriceData {
  marketIndex: number;
  symbol: string;
  price: number;
  timestamp: number;
  change24h?: number;
}

interface CachedPrice {
  price: number;
  lastBroadcast: number;
  lastUpdate: number;
}

class PriceCache {
  private cache: Map<number, CachedPrice> = new Map();
  
  // Only broadcast if price changes by more than 0.1%
  private readonly PRICE_CHANGE_THRESHOLD = 0.001; // 0.1%
  
  // Throttle: Don't broadcast same market more than once per 500ms
  private readonly BROADCAST_THROTTLE_MS = 500;

  /**
   * Update price and determine if it should be broadcast
   */
  shouldBroadcast(marketIndex: number, newPrice: number): boolean {
    const now = Date.now();
    const cached = this.cache.get(marketIndex);

    if (!cached) {
      // First time seeing this market - broadcast it
      this.cache.set(marketIndex, {
        price: newPrice,
        lastBroadcast: now,
        lastUpdate: now,
      });
      return true;
    }

    // Update timestamp
    cached.lastUpdate = now;

    // Check if price changed significantly
    const priceChange = Math.abs((newPrice - cached.price) / cached.price);
    const hasSignificantChange = priceChange >= this.PRICE_CHANGE_THRESHOLD;

    // Check if we've broadcast recently (throttle)
    const timeSinceLastBroadcast = now - cached.lastBroadcast;
    const isThrottled = timeSinceLastBroadcast < this.BROADCAST_THROTTLE_MS;

    if (hasSignificantChange && !isThrottled) {
      // Significant change + not throttled → broadcast
      cached.price = newPrice;
      cached.lastBroadcast = now;
      return true;
    }

    // Update price in cache but don't broadcast
    cached.price = newPrice;
    return false;
  }

  /**
   * Get cached price for a market
   */
  getPrice(marketIndex: number): number | undefined {
    return this.cache.get(marketIndex)?.price;
  }

  /**
   * Get all cached prices
   */
  getAllPrices(): Map<number, number> {
    const prices = new Map<number, number>();
    this.cache.forEach((cached, marketIndex) => {
      prices.set(marketIndex, cached.price);
    });
    return prices;
  }

  /**
   * Clear cache for a specific market
   */
  clear(marketIndex: number): void {
    this.cache.delete(marketIndex);
  }

  /**
   * Clear entire cache
   */
  clearAll(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getStats() {
    const now = Date.now();
    let staleCount = 0;
    let activeCount = 0;

    this.cache.forEach(cached => {
      const age = now - cached.lastUpdate;
      if (age > 60000) { // 1 minute
        staleCount++;
      } else {
        activeCount++;
      }
    });

    return {
      totalMarkets: this.cache.size,
      activeMarkets: activeCount,
      staleMarkets: staleCount,
      thresholdPercent: this.PRICE_CHANGE_THRESHOLD * 100,
      throttleMs: this.BROADCAST_THROTTLE_MS,
    };
  }
}

// Singleton instance
export const priceCache = new PriceCache();

