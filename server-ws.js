/**
 * WebSocket Server for Real-Time Position Updates
 * 
 * This server:
 * 1. Connects to Drift's DLOB WebSocket for real-time price feeds
 * 2. Calculates live P&L for open positions
 * 3. Pushes delta updates to connected clients (no full reload)
 * 
 * Based on: https://drift-labs.github.io/v2-teacher/#websocket-subscribing
 */

const WebSocket = require('ws');
const { PrismaClient } = require('@prisma/client');
const { Connection, PublicKey } = require('@solana/web3.js');
const { DriftClient, Wallet } = require('@drift-labs/sdk');

const prisma = new PrismaClient();
const PORT = 3001;

console.log('🚀 WebSocket server starting...');

// Drift WebSocket connection
const DRIFT_WS_URL = 'wss://master.dlob.drift.trade/ws';

// Store active connections by wallet address
const connections = new Map();

// Store latest prices from Drift
const latestPrices = new Map();

// Create WebSocket server
console.log(`📡 Creating WebSocket server on port ${PORT}...`);
const wss = new WebSocket.Server({ port: PORT });
console.log(`✅ WebSocket server running on ws://localhost:${PORT}`);

// Connect to Drift's WebSocket for real-time price feeds
let driftWs = null;

function connectToDriftWS() {
  console.log('📡 Connecting to Drift WebSocket...');
  
  driftWs = new WebSocket(DRIFT_WS_URL);
  
  driftWs.on('open', () => {
    console.log('✅ Connected to Drift WebSocket');
    
    // Subscribe to market data for SOL, BTC, ETH
    const subscribeMessage = {
      type: 'subscribe',
      marketType: 'perp',
      channel: 'trades',
      market: 'SOL-PERP'
    };
    driftWs.send(JSON.stringify(subscribeMessage));
    
    // Subscribe to BTC
    driftWs.send(JSON.stringify({ ...subscribeMessage, market: 'BTC-PERP' }));
    
    // Subscribe to ETH
    driftWs.send(JSON.stringify({ ...subscribeMessage, market: 'ETH-PERP' }));
    
    console.log('📊 Subscribed to SOL, BTC, ETH market data');
  });
  
  driftWs.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString());
      
      // Update latest prices from trade data
      if (message.channel === 'trades' && message.data) {
        const { marketIndex, price } = message.data;
        if (price) {
          latestPrices.set(marketIndex, parseFloat(price));
          
          // Broadcast P&L updates to all connected clients
          broadcastPnLUpdates();
        }
      }
    } catch (err) {
      console.error('Error parsing Drift WS message:', err);
    }
  });
  
  driftWs.on('error', (error) => {
    console.error('❌ Drift WebSocket error:', error);
  });
  
  driftWs.on('close', () => {
    console.log('🔌 Drift WebSocket closed. Reconnecting in 5s...');
    setTimeout(connectToDriftWS, 5000);
  });
  
  // Ping every 30 seconds to keep connection alive
  setInterval(() => {
    if (driftWs && driftWs.readyState === WebSocket.OPEN) {
      driftWs.send(JSON.stringify({ type: 'ping' }));
    }
  }, 30000);
}

// Calculate P&L for a position with current prices
function calculatePositionPnL(position, longPrice, shortPrice) {
  if (!longPrice || !shortPrice) return null;
  
  const currentRatio = longPrice / shortPrice;
  const entryRatio = position.entryRatio;
  
  // Calculate P&L based on ratio change
  const ratioChange = (currentRatio - entryRatio) / entryRatio;
  const unrealizedPnl = position.capitalUSDC * position.leverage * ratioChange;
  const unrealizedPnlPercent = (unrealizedPnl / position.capitalUSDC) * 100;
  
  return {
    id: position.id,
    unrealizedPnl: parseFloat(unrealizedPnl.toFixed(2)),
    unrealizedPnlPercent: parseFloat(unrealizedPnlPercent.toFixed(2)),
    currentRatio: parseFloat(currentRatio.toFixed(6)),
    currentLongPrice: parseFloat(longPrice.toFixed(2)),
    currentShortPrice: parseFloat(shortPrice.toFixed(2)),
  };
}

// Broadcast P&L updates to all connected clients
async function broadcastPnLUpdates() {
  for (const [walletAddress, ws] of connections.entries()) {
    try {
      // Fetch open positions for this wallet
      const positions = await prisma.position.findMany({
        where: {
          userId: walletAddress,
          status: 'OPEN',
        },
      });
      
      // Calculate and send updates for each position
      for (const position of positions) {
        const longPrice = latestPrices.get(position.longMarketIndex);
        const shortPrice = latestPrices.get(position.shortMarketIndex);
        
        if (longPrice && shortPrice) {
          const update = calculatePositionPnL(position, longPrice, shortPrice);
          
          if (update && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
              type: 'position_update',
              data: update,
            }));
          }
        }
      }
    } catch (err) {
      console.error(`Error broadcasting to ${walletAddress}:`, err);
    }
  }
}

// Handle client connections
wss.on('connection', (ws, req) => {
  const params = new URLSearchParams(req.url.split('?')[1]);
  const walletAddress = params.get('wallet');
  
  if (!walletAddress) {
    ws.send(JSON.stringify({ type: 'error', message: 'Wallet address required' }));
    ws.close();
    return;
  }
  
  console.log(`👤 Client connected: ${walletAddress.substring(0, 8)}...`);
  
  // Store connection
  connections.set(walletAddress, ws);
  
  // Send confirmation
  ws.send(JSON.stringify({ type: 'subscribed', message: 'Subscribed to position updates' }));
  
  // Handle incoming messages
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message.toString());
      
      if (data.type === 'ping') {
        ws.send(JSON.stringify({ type: 'pong' }));
      }
    } catch (err) {
      console.error('Error parsing client message:', err);
    }
  });
  
  // Handle disconnection
  ws.on('close', () => {
    console.log(`👋 Client disconnected: ${walletAddress.substring(0, 8)}...`);
    connections.delete(walletAddress);
  });
  
  ws.on('error', (error) => {
    console.error(`Error for ${walletAddress}:`, error);
    connections.delete(walletAddress);
  });
});

// Initialize
console.log(`🚀 WebSocket server starting on port ${PORT}...`);
connectToDriftWS();

console.log(`✅ WebSocket server running on ws://localhost:${PORT}`);
console.log(`📡 Clients can connect with: ws://localhost:${PORT}/positions?wallet=<WALLET_ADDRESS>`);

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down WebSocket server...');
  
  // Close all client connections
  for (const ws of connections.values()) {
    ws.close();
  }
  
  // Close Drift connection
  if (driftWs) {
    driftWs.close();
  }
  
  // Close Prisma
  await prisma.$disconnect();
  
  process.exit(0);
});

