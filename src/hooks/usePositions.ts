/**
 * usePositions Hook
 * Manages position state with optimistic updates and real-time WebSocket sync
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { usePositionWebSocket } from './usePositionWebSocket';

export interface Position {
  id: string;
  longMarketSymbol: string;
  shortMarketSymbol: string;
  entryRatio: number;
  entryLongPrice: number;
  entryShortPrice: number;
  capitalUSDC: number;
  leverage: number;
  entryTimestamp: string;
  unrealizedPnL?: number;
  unrealizedPnLPercent?: number;
  currentRatio?: number;
  currentLongPrice?: number;
  currentShortPrice?: number;
  status: string;
  closeTimestamp?: string;
  closeRatio?: number;
  closeLongPrice?: number;
  closeShortPrice?: number;
  realizedPnL?: number;
  realizedPnLPercent?: number;
  takeProfitPercent?: number;
  stopLossPercent?: number;
}

export function usePositions() {
  const wallet = useWallet();
  const [openPositions, setOpenPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchPositions = useCallback(async () => {
    if (!wallet.publicKey) {
      setOpenPositions([]);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/positions/live-pnl?wallet=${wallet.publicKey.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setOpenPositions(data.positions || []);
        console.log(`📊 Fetched ${data.positions?.length || 0} open positions`);
      }
    } catch (error) {
      console.error('Error fetching positions:', error);
    } finally {
      setLoading(false);
    }
  }, [wallet.publicKey]);

  // Initial fetch
  useEffect(() => {
    fetchPositions();
  }, [fetchPositions]);

  // WebSocket updates for real-time P&L
  const handlePositionUpdate = useCallback((update: any) => {
    setOpenPositions((prev) =>
      prev.map((pos) =>
        pos.id === update.id
          ? {
              ...pos,
              unrealizedPnL: update.unrealizedPnL,
              unrealizedPnLPercent: update.unrealizedPnLPercent,
              currentRatio: update.currentRatio,
              currentLongPrice: update.currentLongPrice,
              currentShortPrice: update.currentShortPrice,
            }
          : pos
      )
    );
  }, []);

  usePositionWebSocket(handlePositionUpdate);

  // Optimistic add (for immediate feedback after opening position)
  const addOptimisticPosition = useCallback((position: Partial<Position>) => {
    const tempPosition: Position = {
      id: position.id || `temp_${Date.now()}`,
      longMarketSymbol: position.longMarketSymbol || '',
      shortMarketSymbol: position.shortMarketSymbol || '',
      entryRatio: position.entryRatio || 0,
      entryLongPrice: position.entryLongPrice || 0,
      entryShortPrice: position.entryShortPrice || 0,
      capitalUSDC: position.capitalUSDC || 0,
      leverage: position.leverage || 1,
      entryTimestamp: new Date().toISOString(),
      status: 'OPEN',
      unrealizedPnL: 0,
      unrealizedPnLPercent: 0,
      takeProfitPercent: position.takeProfitPercent,
      stopLossPercent: position.stopLossPercent,
    };

    setOpenPositions((prev) => [tempPosition, ...prev]);

    // Refresh from server after 2 seconds to get actual data
    setTimeout(() => {
      fetchPositions();
    }, 2000);
  }, [fetchPositions]);

  // Optimistic remove (for immediate feedback after closing position)
  const removeOptimisticPosition = useCallback((positionId: string) => {
    setOpenPositions((prev) => prev.filter((p) => p.id !== positionId));
  }, []);

  return {
    openPositions,
    loading,
    refetch: fetchPositions,
    addOptimisticPosition,
    removeOptimisticPosition,
  };
}
