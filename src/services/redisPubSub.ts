/**
 * Redis Pub/Sub Manager
 * 
 * Handles Redis pub/sub for broadcasting price updates to multiple
 * WebSocket server instances (horizontal scaling).
 * 
 * Architecture:
 * - Single Drift listener → Redis publisher
 * - Multiple WS servers → Redis subscribers
 * - Scales to N WebSocket servers behind load balancer
 * 
 * Features:
 * - Auto-reconnect
 * - Error handling
 * - Graceful shutdown
 * - Health checks
 */

import { createClient } from 'redis';
import type { RedisClientType } from 'redis';

export interface PriceUpdate {
  marketIndex: number;
  symbol: string;
  price: number;
  timestamp: number;
}

class RedisPubSubManager {
  private publisher: RedisClientType | null = null;
  private subscriber: RedisClientType | null = null;
  private isConnected = false;
  private reconnectAttempts = 0;
  private readonly MAX_RECONNECT_ATTEMPTS = 10;
  
  // Redis channels
  private readonly PRICE_CHANNEL = 'drift:prices';
  private readonly HEALTH_CHANNEL = 'drift:health';

  /**
   * Initialize Redis connections
   */
  async connect(redisUrl?: string): Promise<void> {
    const url = redisUrl || process.env.REDIS_URL || 'redis://localhost:6379';
    
    console.log('📡 Connecting to Redis...', url.replace(/:[^:]*@/, ':****@'));

    try {
      // Create publisher client
      this.publisher = createClient({ url });
      this.publisher.on('error', (err) => this.handleError('Publisher', err));
      this.publisher.on('reconnecting', () => console.log('🔄 Redis publisher reconnecting...'));
      await this.publisher.connect();

      // Create subscriber client
      this.subscriber = createClient({ url });
      this.subscriber.on('error', (err) => this.handleError('Subscriber', err));
      this.subscriber.on('reconnecting', () => console.log('🔄 Redis subscriber reconnecting...'));
      await this.subscriber.connect();

      this.isConnected = true;
      this.reconnectAttempts = 0;
      console.log('✅ Redis connected');
    } catch (error: any) {
      console.error('❌ Redis connection failed:', error.message);
      this.isConnected = false;
      
      // Try to reconnect
      if (this.reconnectAttempts < this.MAX_RECONNECT_ATTEMPTS) {
        this.reconnectAttempts++;
        console.log(`⏳ Retrying connection (${this.reconnectAttempts}/${this.MAX_RECONNECT_ATTEMPTS})...`);
        setTimeout(() => this.connect(url), 5000);
      } else {
        console.error('❌ Max reconnection attempts reached. Running in local-only mode.');
      }
    }
  }

  /**
   * Publish price update to Redis
   */
  async publishPrice(update: PriceUpdate): Promise<void> {
    if (!this.isConnected || !this.publisher) {
      return; // Silently fail if Redis unavailable (fallback to local)
    }

    try {
      const message = JSON.stringify(update);
      await this.publisher.publish(this.PRICE_CHANNEL, message);
    } catch (error: any) {
      console.error('❌ Redis publish error:', error.message);
    }
  }

  /**
   * Subscribe to price updates
   */
  async subscribeToPrice(callback: (update: PriceUpdate) => void): Promise<void> {
    if (!this.isConnected || !this.subscriber) {
      console.warn('⚠️ Redis not connected, skipping subscription');
      return;
    }

    try {
      await this.subscriber.subscribe(this.PRICE_CHANNEL, (message) => {
        try {
          const update: PriceUpdate = JSON.parse(message);
          callback(update);
        } catch (err) {
          console.error('❌ Error parsing Redis message:', err);
        }
      });
      console.log('✅ Subscribed to price updates via Redis');
    } catch (error: any) {
      console.error('❌ Redis subscribe error:', error.message);
    }
  }

  /**
   * Publish health ping
   */
  async publishHealth(serverId: string): Promise<void> {
    if (!this.isConnected || !this.publisher) {
      return;
    }

    try {
      const health = {
        serverId,
        timestamp: Date.now(),
        uptime: process.uptime(),
      };
      await this.publisher.publish(this.HEALTH_CHANNEL, JSON.stringify(health));
    } catch (error: any) {
      console.error('❌ Redis health publish error:', error.message);
    }
  }

  /**
   * Handle errors
   */
  private handleError(client: string, error: Error): void {
    console.error(`❌ Redis ${client} error:`, error.message);
    this.isConnected = false;
  }

  /**
   * Disconnect from Redis
   */
  async disconnect(): Promise<void> {
    console.log('🛑 Disconnecting from Redis...');
    
    try {
      if (this.subscriber) {
        await this.subscriber.unsubscribe();
        await this.subscriber.quit();
      }
      if (this.publisher) {
        await this.publisher.quit();
      }
      this.isConnected = false;
      console.log('✅ Redis disconnected');
    } catch (error: any) {
      console.error('❌ Error disconnecting Redis:', error.message);
    }
  }

  /**
   * Check if Redis is connected
   */
  getStatus(): { connected: boolean; attempts: number } {
    return {
      connected: this.isConnected,
      attempts: this.reconnectAttempts,
    };
  }
}

// Singleton instance
export const redisPubSub = new RedisPubSubManager();

