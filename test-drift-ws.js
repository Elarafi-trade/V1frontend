/**
 * Test script to directly connect to Drift WebSocket and see what messages we receive
 */

const WebSocket = require('ws');

const DRIFT_WS_URL = 'wss://master.dlob.drift.trade/ws';

console.log('🔌 Connecting to Drift DLOB WebSocket...');
console.log('URL:', DRIFT_WS_URL);

const ws = new WebSocket(DRIFT_WS_URL);

ws.on('open', () => {
  console.log('✅ Connected to Drift!');
  console.log('📡 Subscribing to markets...\n');
  
  // Subscribe to SOL-PERP trades
  const subscribeSOL = {
    type: 'subscribe',
    marketType: 'perp',
    channel: 'trades',
    market: 'SOL-PERP',
  };
  
  // Subscribe to BTC-PERP trades
  const subscribeBTC = {
    type: 'subscribe',
    marketType: 'perp',
    channel: 'trades',
    market: 'BTC-PERP',
  };
  
  ws.send(JSON.stringify(subscribeSOL));
  console.log('📤 Sent subscription:', subscribeSOL);
  
  ws.send(JSON.stringify(subscribeBTC));
  console.log('📤 Sent subscription:', subscribeBTC);
  
  console.log('\n⏳ Waiting for messages...\n');
});

let messageCount = 0;

ws.on('message', (data) => {
  messageCount++;
  
  try {
    const message = JSON.parse(data.toString());
    
    console.log(`\n📨 Message #${messageCount}:`);
    console.log(JSON.stringify(message, null, 2));
    
    // Stop after 10 messages to avoid spam
    if (messageCount >= 10) {
      console.log('\n✅ Received 10 messages, closing connection...');
      ws.close();
    }
  } catch (err) {
    console.error('❌ Failed to parse message:', err.message);
    console.log('Raw data:', data.toString());
  }
});

ws.on('error', (error) => {
  console.error('❌ WebSocket error:', error.message);
});

ws.on('close', (code, reason) => {
  console.log('\n🔌 Disconnected from Drift');
  console.log('Close code:', code);
  console.log('Close reason:', reason?.toString() || 'No reason provided');
  console.log(`Total messages received: ${messageCount}`);
  process.exit(0);
});

// Timeout after 30 seconds if no messages
setTimeout(() => {
  console.log('\n⏱️ Timeout: No messages received after 30 seconds');
  console.log(`Total messages received: ${messageCount}`);
  ws.close();
}, 30000);

