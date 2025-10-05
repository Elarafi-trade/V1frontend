const WebSocket = require('ws');

console.log('🚀 Starting test WebSocket server...');

const wss = new WebSocket.Server({ port: 3001 });

console.log('✅ WebSocket server running on ws://localhost:3001');

wss.on('connection', (ws) => {
  console.log('👤 Client connected');
  
  ws.send(JSON.stringify({ type: 'connected', message: 'Hello from server!' }));
  
  ws.on('message', (message) => {
    console.log('📨 Received:', message.toString());
  });
  
  ws.on('close', () => {
    console.log('👋 Client disconnected');
  });
});

console.log('Server ready and listening...');

