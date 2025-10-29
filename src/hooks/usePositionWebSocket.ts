'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';

interface PositionUpdate {
  id: string;
  unrealizedPnl: number;
  unrealizedPnlPercent: number;
  currentRatio: number;
  currentLongPrice: number;
  currentShortPrice: number;
}

interface WebSocketMessage {
  type: 'position_update' | 'pong' | 'subscribed' | 'error';
  data?: PositionUpdate;
  message?: string;
}

export const usePositionWebSocket = (onUpdate: (update: PositionUpdate) => void) => {
  const wallet = useWallet();
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const onUpdateRef = useRef(onUpdate); // Store callback in ref to prevent reconnections
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Update the ref when callback changes
  useEffect(() => {
    onUpdateRef.current = onUpdate;
  }, [onUpdate]);

  const cleanup = useCallback(() => {
    // Only cleanup on client-side
    if (typeof window === 'undefined') return;
    
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = null;
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (wsRef.current) {
      // Remove error handler before closing to prevent error events during navigation
      wsRef.current.onerror = null;
      wsRef.current.onclose = null;
      wsRef.current.close();
      wsRef.current = null;
    }
  }, []);

  const connect = useCallback(() => {
    // Only run on client-side
    if (typeof window === 'undefined') return;
    if (!wallet.publicKey) return;

    cleanup();

    try {
      // Connect to our backend WebSocket (we'll create this endpoint)
      const ws = new WebSocket(`ws://localhost:3001/positions?wallet=${wallet.publicKey.toString()}`);
      
      ws.onopen = () => {
        console.log('✅ WebSocket connected for position updates');
        setIsConnected(true);
        setError(null);

        // Send ping every 30 seconds to keep connection alive
        pingIntervalRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'ping' }));
          }
        }, 30000);
      };

      ws.onmessage = (event) => {
        try {
          const message: any = JSON.parse(event.data);
          
          // Handle both position_update and pnl_update message types
          if (message.type === 'position_update' && message.data) {
            onUpdateRef.current(message.data);
          } else if (message.type === 'pnl_update' && message.positions) {
            // Server sends array of positions with updated P&L
            // Update each position individually
            message.positions.forEach((positionUpdate: any) => {
              onUpdateRef.current(positionUpdate);
            });
          } else if (message.type === 'price_update') {
            // Ignore raw price updates (server calculates P&L)
            return;
          } else if (message.type === 'pong') {
            // Connection is alive
            return;
          } else if (message.type === 'subscribed') {
            console.log('📡 Subscribed to position updates');
          } else if (message.type === 'error') {
            console.error('WebSocket error:', message.message);
            setError(message.message || 'Unknown error');
          }
        } catch (err) {
          console.error('Failed to parse WebSocket message:', err);
        }
      };

      ws.onerror = (error) => {
        // Don't use console.error - it triggers Next.js error overlay
        // This is expected during page navigation
        setIsConnected(false);
      };

      ws.onclose = () => {
        console.log('🔌 WebSocket disconnected. Reconnecting in 5s...');
        setIsConnected(false);
        
        // Attempt to reconnect after 5 seconds
        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, 5000);
      };

      wsRef.current = ws;
    } catch (err) {
      // Don't use console.error - it triggers Next.js error overlay
      // WebSocket will auto-reconnect if needed
    }
  }, [wallet.publicKey, cleanup]); // Removed onUpdate from dependencies

  useEffect(() => {
    connect();
    return cleanup;
  }, [connect, cleanup]);

  return {
    isConnected,
    error,
    reconnect: connect,
  };
};

