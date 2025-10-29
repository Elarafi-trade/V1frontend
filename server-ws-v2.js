/**
 * WebSocket Server V2 - Production-Grade with Redis Pub/Sub
 * 
 * Improvements over V1:
 * - Redis Pub/Sub for horizontal scaling
 * - Price caching with change detection
 * - Selective broadcasts (only significant changes)
 * - Memory-efficient per-user position tracking
 * - Graceful degradation if Redis unavailable
 * 
 * Architecture:
 * Drift DLOB → Redis Pub/Sub → [WS Server 1, WS Server 2, ...] → Clients
 * 
 * Scales to 1000+ concurrent users across multiple servers.
 */

const WebSocket = require('ws');
const { PrismaClient } = require('@prisma/client');
const { Connection } = require('@solana/web3.js');
const http = require('http');

// Dynamic imports for ES modules
let priceCache, redisPubSub, getReadOnlyDriftClient;

const prisma = new PrismaClient();
const PORT = process.env.WS_PORT || 3001;
const SERVER_ID = process.env.SERVER_ID || `ws-${process.pid}`;
const LOG_PREFIX = '[WSv2]';

// Back-pressure and reconnection config
const MAX_BUFFER_SIZE = 1e6; // 1MB max buffered data per client
const MAX_RECONNECT_DELAY = 60000; // 60 seconds max delay
const INITIAL_RECONNECT_DELAY = 1000; // 1 second initial delay
let reconnectAttempts = 0;

// Structured logging helper
function log(level, event, data = {}) {
  const logData = {
    timestamp: new Date().toISOString(),
    level,
    event,
    serverId: SERVER_ID,
    ...data
  };
  console.log(`${LOG_PREFIX} ${JSON.stringify(logData)}`);
}

log('info', 'server_starting', { port: PORT });

// Drift WebSocket connection
const DRIFT_WS_URL = 'wss://master.dlob.drift.trade/ws';

// Store active connections by wallet address
const connections = new Map();

// Connection statistics
const stats = {
  totalConnections: 0,
  activeConnections: 0,
  priceUpdates: 0,
  broadcastsSent: 0,
  messagesDropped: 0,
  reconnectAttempts: 0,
  startTime: Date.now(),
};

/**
 * Initialize services
 */
async function initialize() {
  try {
    // Import ES modules (compiled to .js)
    const priceCacheModule = await import('./src/services/priceCache.js');
    const redisPubSubModule = await import('./src/services/redisPubSub.js');
    const clientManagerModule = await import('./src/lib/drift/clientManager.js');
    
    priceCache = priceCacheModule.priceCache || priceCacheModule.default?.priceCache;
    redisPubSub = redisPubSubModule.redisPubSub || redisPubSubModule.default?.redisPubSub;
    getReadOnlyDriftClient = clientManagerModule.getReadOnlyDriftClient || clientManagerModule.default?.getReadOnlyDriftClient;
    
    // Debug log
    if (!priceCache || !redisPubSub || !getReadOnlyDriftClient) {
      console.error('Failed to import modules:', {
        priceCache: !!priceCache,
        redisPubSub: !!redisPubSub,
        getReadOnlyDriftClient: !!getReadOnlyDriftClient
      });
    }

    // Connect to Redis (optional - graceful degradation)
    try {
      await redisPubSub.connect();
      
      // Subscribe to price updates from other servers
      await redisPubSub.subscribeToPrice((update) => {
        log('info', 'redis_price_received', { 
          symbol: update.symbol, 
          price: update.price 
        });
        broadcastToRelevantClients(update);
      });
      
      // Send health pings every 30s
      setInterval(() => {
        redisPubSub.publishHealth(SERVER_ID);
      }, 30000);
      
      log('info', 'redis_connected', { status: 'connected' });
    } catch (err) {
      log('warn', 'redis_unavailable', { 
        error: err.message, 
        mode: 'local-only' 
      });
    }

    log('info', 'services_initialized', { status: 'ready' });
  } catch (error) {
    console.error('❌ Initialization error:', error);
    throw error;
  }
}

/**
 * Create HTTP server for WebSocket + health endpoints
 */
const server = http.createServer((req, res) => {
  // Health endpoint
  if (req.url === '/health') {
    const health = {
      status: 'healthy',
      serverId: SERVER_ID,
      connections: stats.activeConnections,
      uptime: (Date.now() - stats.startTime) / 1000,
      drift: driftWs?.readyState === WebSocket.OPEN ? 'connected' : 'disconnected',
      redis: redisPubSub?.getStatus ? redisPubSub.getStatus() : { connected: false },
    };
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(health));
    return;
  }
  
  // Metrics endpoint for Prometheus
  if (req.url === '/metrics') {
    const metrics = {
      serverId: SERVER_ID,
      stats: {
        ...stats,
        uptime: (Date.now() - stats.startTime) / 1000,
      },
      drift: {
        connected: driftWs?.readyState === WebSocket.OPEN,
        reconnectAttempts,
      },
      redis: redisPubSub?.getStatus ? redisPubSub.getStatus() : { connected: false },
      memory: process.memoryUsage(),
      timestamp: new Date().toISOString(),
    };
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(metrics));
    return;
  }
  
  res.writeHead(404);
  res.end('Not Found');
});

/**
 * Create WebSocket server
 */
const wss = new WebSocket.Server({ server });

server.listen(PORT, () => {
  log('info', 'websocket_server_started', { 
    port: PORT, 
    endpoints: ['/health', '/metrics'] 
  });
});

/**
 * Handle new client connections
 */
wss.on('connection', async (ws, req) => {
  stats.totalConnections++;
  stats.activeConnections++;
  
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const wallet = url.searchParams.get('wallet');
  
  if (!wallet) {
    ws.close(1008, 'Missing wallet parameter');
    stats.activeConnections--;
    return;
  }

  log('info', 'client_connected', { 
    wallet: wallet.substring(0, 8), 
    total: stats.activeConnections 
  });

  // Store connection
  if (!connections.has(wallet)) {
    connections.set(wallet, []);
  }
  connections.get(wallet).push(ws);

  // Send initial snapshot of cached prices
  sendPriceSnapshot(ws);

  // Handle disconnection
  ws.on('close', () => {
    const walletConnections = connections.get(wallet);
    if (walletConnections) {
      const index = walletConnections.indexOf(ws);
      if (index > -1) {
        walletConnections.splice(index, 1);
      }
      if (walletConnections.length === 0) {
        connections.delete(wallet);
      }
    }
    stats.activeConnections--;
    log('info', 'client_disconnected', { 
      wallet: wallet.substring(0, 8), 
      total: stats.activeConnections 
    });
  });

  ws.on('error', (error) => {
    log('error', 'client_error', { 
      wallet: wallet.substring(0, 8), 
      error: error.message 
    });
  });

  // Handle incoming messages (ping/pong, etc.)
  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString());
      if (message.type === 'ping') {
        ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
      }
    } catch (err) {
      console.error('❌ Error parsing client message:', err);
    }
  });
});

/**
 * Send message with back-pressure handling
 * ✅ Checks bufferedAmount to prevent memory bloat
 * ✅ Drops messages for slow clients
 */
function safeSend(ws, message) {
  if (ws.readyState !== WebSocket.OPEN) {
    return false;
  }
  
  // Check back-pressure: drop message if buffer is full
  if (ws.bufferedAmount > MAX_BUFFER_SIZE) {
    stats.messagesDropped++;
    log('warn', 'message_dropped', { 
      bufferedAmount: ws.bufferedAmount, 
      maxBuffer: MAX_BUFFER_SIZE 
    });
    return false;
  }
  
  try {
    ws.send(message);
    return true;
  } catch (err) {
    log('error', 'send_failed', { error: err.message });
    return false;
  }
}

/**
 * Send initial price snapshot to new client
 */
function sendPriceSnapshot(ws) {
  // Safety check: priceCache might not be initialized yet
  if (!priceCache || !priceCache.getAllPrices) {
    log('warn', 'price_snapshot_skipped', { reason: 'priceCache_not_ready' });
    return;
  }
  
  const prices = priceCache.getAllPrices();
  const snapshot = {
    type: 'price_snapshot',
    prices: Array.from(prices.entries()).map(([marketIndex, price]) => ({
      marketIndex,
      price,
    })),
    timestamp: Date.now(),
  };
  
  safeSend(ws, JSON.stringify(snapshot));
}

/**
 * Connect to Drift DLOB WebSocket with exponential backoff
 */
let driftWs = null;
let driftHeartbeatInterval = null;

function connectToDriftWS() {
  const delay = Math.min(
    INITIAL_RECONNECT_DELAY * Math.pow(2, reconnectAttempts),
    MAX_RECONNECT_DELAY
  );
  
  log('info', 'drift_connecting', { 
    attempt: reconnectAttempts + 1, 
    delay 
  });
  
  driftWs = new WebSocket(DRIFT_WS_URL);
  
  driftWs.on('open', () => {
    reconnectAttempts = 0; // Reset on successful connection
    
    log('info', 'drift_connected', { status: 'connected' });
    
    // Subscribe to markets
    const markets = [
      { name: 'SOL-PERP', index: 0 },
      { name: 'BTC-PERP', index: 1 },
      { name: 'ETH-PERP', index: 2 }
    ];
    
    markets.forEach(({ name, index }) => {
      const subscribeMessage = {
        type: 'subscribe',
        marketType: 'perp',
        channel: 'trades',
        market: name,
      };
      driftWs.send(JSON.stringify(subscribeMessage));
      log('info', 'market_subscribe_sent', { market: name, marketIndex: index });
    });
    
    // Start heartbeat
    startDriftHeartbeat();
  });
  
  driftWs.on('message', async (data) => {
    try {
      const message = JSON.parse(data.toString());
      
      // Handle heartbeat messages (ignore)
      if (message.channel === 'heartbeat') {
        return;
      }
      
      // Handle subscription confirmations
      if (message.message && message.message.includes('Subscribe received')) {
        log('info', 'drift_subscribed', { message: message.message });
        return;
      }
      
      // Handle trade messages (format: trades_perp_X where X is marketIndex)
      if (message.channel && message.channel.startsWith('trades_perp_') && message.data) {
        try {
          // Parse the nested JSON string
          const tradeData = JSON.parse(message.data);
          
          const marketIndex = tradeData.marketIndex;
          const oraclePrice = tradeData.oraclePrice;
          
          if (marketIndex === undefined || !oraclePrice) {
            return;
          }

          const priceNum = parseFloat(oraclePrice);
          stats.priceUpdates++;

          // Check if price changed significantly (deduplication)
          const shouldBroadcast = priceCache && priceCache.shouldBroadcast 
            ? priceCache.shouldBroadcast(marketIndex, priceNum)
            : true; // Default to broadcast if cache not ready
          
          if (shouldBroadcast) {
            const update = {
              marketIndex,
              symbol: getMarketSymbol(marketIndex),
              price: priceNum,
              timestamp: Date.now(),
            };

            log('info', 'price_update', { 
              market: update.symbol, 
              price: update.price,
              channel: message.channel
            });

            // Publish to Redis for other servers
            if (redisPubSub) {
              await redisPubSub.publishPrice(update);
            }

            // Broadcast to local clients
            broadcastToRelevantClients(update);
          }
        } catch (parseErr) {
          log('error', 'drift_trade_parse_error', { 
            error: parseErr.message,
            channel: message.channel 
          });
        }
      }
    } catch (err) {
      log('error', 'drift_message_parse_error', { error: err.message });
    }
  });
  
  driftWs.on('error', (error) => {
    log('error', 'drift_error', { error: error.message });
  });
  
  driftWs.on('close', () => {
    stopDriftHeartbeat();
    reconnectAttempts++;
    stats.reconnectAttempts++;
    
    const delay = Math.min(
      INITIAL_RECONNECT_DELAY * Math.pow(2, reconnectAttempts - 1),
      MAX_RECONNECT_DELAY
    );
    
    log('warn', 'drift_disconnected', { 
      reconnectIn: delay, 
      attempt: reconnectAttempts 
    });
    
    setTimeout(connectToDriftWS, delay);
  });
}

/**
 * Start heartbeat for Drift WebSocket
 * ✅ Ping every 10s to detect silent disconnects
 * ✅ Auto-reconnect if connection is dead
 */
function startDriftHeartbeat() {
  if (driftHeartbeatInterval) {
    clearInterval(driftHeartbeatInterval);
  }
  
  driftHeartbeatInterval = setInterval(() => {
    if (driftWs && driftWs.readyState === WebSocket.OPEN) {
      try {
        driftWs.ping();
      } catch (err) {
        log('error', 'drift_ping_failed', { error: err.message });
      }
    } else if (driftWs && driftWs.readyState !== WebSocket.CONNECTING) {
      // Connection is dead, reconnect
      log('warn', 'drift_heartbeat_failed', { 
        state: driftWs.readyState 
      });
      stopDriftHeartbeat();
      connectToDriftWS();
    }
  }, 10000); // Every 10 seconds
}

/**
 * Stop heartbeat interval
 */
function stopDriftHeartbeat() {
  if (driftHeartbeatInterval) {
    clearInterval(driftHeartbeatInterval);
    driftHeartbeatInterval = null;
  }
}

/**
 * Broadcast price update to relevant clients
 * ✅ Uses safeSend with back-pressure handling
 * ✅ Drops messages for slow clients
 */
async function broadcastToRelevantClients(update) {
  const message = JSON.stringify({
    type: 'price_update',
    data: update,
  });

  let sent = 0;
  let dropped = 0;
  
  connections.forEach((walletConnections) => {
    walletConnections.forEach(ws => {
      if (safeSend(ws, message)) {
        sent++;
      } else {
        dropped++;
      }
    });
  });

  stats.broadcastsSent += sent;
  
  if (dropped > 0) {
    log('warn', 'broadcast_partial', { 
      sent, 
      dropped, 
      market: update.symbol 
    });
  }
}

/**
 * Calculate live P&L for user positions
 * (Called periodically or on demand)
 */
async function broadcastPnLUpdates() {
  // Get all users with active connections
  const wallets = Array.from(connections.keys());
  if (wallets.length === 0) return;

  try {
    // Use singleton DriftClient (fast!)
    const driftClient = await getReadOnlyDriftClient();

    for (const wallet of wallets) {
      // Get open positions for this wallet
      const positions = await prisma.position.findMany({
        where: {
          user: { walletAddress: wallet },
          status: 'OPEN',
        },
      });

      if (positions.length === 0) continue;

      // Calculate live P&L
      const positionsWithPnL = positions.map(position => {
        // Safety check: priceCache might not be initialized yet
        if (!priceCache || !priceCache.getPrice) return null;
        
        const longPrice = priceCache.getPrice(position.longMarketIndex);
        const shortPrice = priceCache.getPrice(position.shortMarketIndex);

        if (!longPrice || !shortPrice) return null;

        const currentRatio = longPrice / shortPrice;
        const ratioDiff = currentRatio - position.entryRatio;
        const pnlPercent = (ratioDiff / position.entryRatio) * 100;
        const unrealizedPnL = (position.capitalUSDC * position.leverage * pnlPercent) / 100;

        return {
          id: position.id,
          longMarketSymbol: position.longMarketSymbol,
          shortMarketSymbol: position.shortMarketSymbol,
          currentRatio,
          currentLongPrice: longPrice,
          currentShortPrice: shortPrice,
          unrealizedPnL: unrealizedPnL,  // Capital L for UI consistency
          unrealizedPnLPercent: pnlPercent,  // Capital L for UI consistency
        };
      }).filter(Boolean);

      // Send to all connections for this wallet
      const message = JSON.stringify({
        type: 'pnl_update',
        positions: positionsWithPnL,
        timestamp: Date.now(),
      });

      const walletConnections = connections.get(wallet);
      walletConnections?.forEach(ws => {
        safeSend(ws, message);
      });
    }
  } catch (error) {
    log('error', 'pnl_broadcast_error', { error: error.message });
  }
}

/**
 * Get market symbol from index
 */
function getMarketSymbol(marketIndex) {
  const symbols = {
    0: 'SOL',
    1: 'BTC',
    2: 'ETH',
  };
  return symbols[marketIndex] || `Market-${marketIndex}`;
}

/**
 * Stats logging (every minute)
 */
setInterval(() => {
  log('info', 'stats', {
    activeConnections: stats.activeConnections,
    priceUpdates: stats.priceUpdates,
    broadcastsSent: stats.broadcastsSent,
    messagesDropped: stats.messagesDropped,
    reconnectAttempts: stats.reconnectAttempts,
    uptime: Math.round((Date.now() - stats.startTime) / 1000),
  });
}, 60000);

/**
 * P&L update loop (every 10 seconds)
 */
setInterval(broadcastPnLUpdates, 10000);

/**
 * Graceful shutdown
 */
process.on('SIGINT', async () => {
  log('info', 'server_shutting_down', { reason: 'SIGINT' });
  
  // Stop heartbeat
  stopDriftHeartbeat();
  
  // Close Drift connection
  if (driftWs) {
    driftWs.close();
  }
  
  // Close all client connections
  connections.forEach((walletConnections) => {
    walletConnections.forEach(ws => ws.close(1000, 'Server shutting down'));
  });
  
  // Disconnect Redis
  if (redisPubSub) {
    await redisPubSub.disconnect();
  }
  
  wss.close(() => {
    server.close(() => {
      log('info', 'server_stopped', { status: 'shutdown_complete' });
    process.exit(0);
    });
  });
});

// Initialize and start
initialize().then(() => {
  connectToDriftWS();
  log('info', 'server_ready', { 
    status: 'operational', 
    features: ['redis_pubsub', 'price_caching', 'back_pressure', 'heartbeat', 'exponential_backoff'] 
  });
}).catch(err => {
  log('error', 'server_failed_to_start', { error: err.message });
  process.exit(1);
});

