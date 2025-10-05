'use client';

import { useState, useEffect, useCallback } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { TrendingUp, TrendingDown, Clock, CheckCircle, XCircle, X } from 'lucide-react';
import { usePositionWebSocket } from '@/hooks/usePositionWebSocket';
import { usePairTrading } from '@/hooks/usePairTrading';
import { PositionsTable } from './positions/PositionsTable';
import { OrdersTable } from './positions/OrdersTable';
import { PendingOrder } from './positions/OrderRow';
import { TradeHistoryTable } from './positions/TradeHistoryTable';
import { ClosedTrade } from './positions/TradeHistoryRow';
import { positionEvents } from '@/lib/events/positionEvents';

interface Trade {
  id: string;
  action: string;
  marketSymbol: string;
  amount: number;
  price: number;
  timestamp: string;
  signature: string;
}

interface Position {
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

interface OrderHistoryProps {
  longToken: string;
  shortToken: string;
}

export default function OrderHistory({ longToken, shortToken }: OrderHistoryProps) {
  const wallet = useWallet();
  const { closePairTrade, cancelPartialPosition } = usePairTrading();
  const [activeTab, setActiveTab] = useState<'positions' | 'orders' | 'history' | 'twap'>('positions');
  const [openPositions, setOpenPositions] = useState<Position[]>([]);
  const [closedPositions, setClosedPositions] = useState<Position[]>([]);
  const [tradeHistory, setTradeHistory] = useState<Trade[]>([]);
  const [pendingOrders, setPendingOrders] = useState<PendingOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [closingPosition, setClosingPosition] = useState<string | null>(null);

  // Fetch initial data from database (ONCE)
  useEffect(() => {
    if (!wallet.publicKey) {
      setOpenPositions([]);
      setClosedPositions([]);
      setTradeHistory([]);
      setPendingOrders([]);
      return;
    }

    const fetchData = async () => {
      setLoading(true);
      try {
        // Fetch open positions with live P&L (worker handles sync in background)
        const posRes = await fetch(`/api/positions/live-pnl?wallet=${wallet.publicKey?.toString()}`);
        if (posRes.ok) {
          const posData = await posRes.json();
          const positions = posData.positions || [];
          console.log(`📊 Fetched ${positions.length} open positions:`, positions.map((p: any) => 
            `${p.longMarketSymbol}/${p.shortMarketSymbol}`
          ));
          setOpenPositions(positions);
        }

        // Fetch all positions including closed
        const allPosRes = await fetch(`/api/positions?wallet=${wallet.publicKey?.toString()}`);
        if (allPosRes.ok) {
          const allPosData = await allPosRes.json();
          const allPositions = allPosData.positions || [];
          
          // Separate closed positions and sort by close time (newest first)
          const closed = allPositions
            .filter((p: any) => p.status === 'CLOSED' && p.closeTimestamp)
            .sort((a: any, b: any) => 
              new Date(b.closeTimestamp).getTime() - new Date(a.closeTimestamp).getTime()
            );
          setClosedPositions(closed);
          
          // Trade history is just the closed positions (displayed as pairs)
          setTradeHistory([]);
        }

        // Fetch partial positions (one leg filled, one leg pending)
        const ordersRes = await fetch(`/api/orders/partial?wallet=${wallet.publicKey?.toString()}`);
        if (ordersRes.ok) {
          const ordersData = await ordersRes.json();
          const orders: PendingOrder[] = (ordersData.orders || []).map((order: any) => ({
            id: order.id, // position ID
            positionId: order.positionId,
            pairLong: order.pairLong,
            pairShort: order.pairShort,
            market: order.market,
            action: order.action,
            orderType: order.orderType,
            size: order.size,
            filled: order.filled,
            price: order.price,
            createdAt: new Date(order.createdAt),
          }));
          console.log(`📋 Fetched ${orders.length} partial orders`);
          setPendingOrders(orders);
        }
      } catch (error) {
        console.error('Error fetching order history:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    // NO MORE POLLING - WebSocket will handle live updates
  }, [wallet.publicKey]);

  // Handle WebSocket position updates (P&L only, no full reload)
  const handlePositionUpdate = useCallback((update: any) => {
    console.log('📊 Position update received:', update);
    setOpenPositions((prevPositions) =>
      prevPositions.map((pos) =>
        pos.id === update.id
          ? {
              ...pos,
              unrealizedPnL: update.unrealizedPnL ?? update.unrealizedPnl,  // Support both casings
              unrealizedPnLPercent: update.unrealizedPnLPercent ?? update.unrealizedPnlPercent,  // Support both casings
              currentRatio: update.currentRatio,
              currentLongPrice: update.currentLongPrice,
              currentShortPrice: update.currentShortPrice,
            }
          : pos
      )
    );
  }, []);

  // Connect to WebSocket for real-time P&L updates
  const { isConnected } = usePositionWebSocket(handlePositionUpdate);

  // Listen for new position events (optimistic updates)
  useEffect(() => {
    const unsubscribe = positionEvents.subscribe((newPosition) => {
      console.log('🆕 New position event received:', newPosition);
      
      // Route to correct tab based on position status
      if (newPosition.status === 'PARTIAL') {
        // Add to pending orders (Open Orders tab)
        console.log('   → Adding to Open Orders (partial fill)');
        setPendingOrders((prev) => {
          const exists = prev.some(p => p.id === newPosition.id);
          if (exists) return prev;
          
          // Convert to PendingOrder format
          const pendingOrder: PendingOrder = {
            id: newPosition.id,
            positionId: newPosition.id,
            pairLong: newPosition.longMarketSymbol,
            pairShort: newPosition.shortMarketSymbol,
            market: newPosition.partialLeg === 'SHORT' ? newPosition.shortMarketSymbol : newPosition.longMarketSymbol,
            action: newPosition.partialLeg === 'SHORT' ? 'SHORT' : 'LONG',
            orderType: 'Market' as any,
            size: newPosition.partialLeg === 'SHORT' ? 
              (newPosition.capitalUSDC * newPosition.leverage * newPosition.shortWeight / newPosition.entryShortPrice) :
              (newPosition.capitalUSDC * newPosition.leverage * newPosition.longWeight / newPosition.entryLongPrice),
            filled: newPosition.partialLeg === 'SHORT' ? 
              (newPosition.shortFillPercent || 0) : 
              (newPosition.longFillPercent || 0),
            price: newPosition.partialLeg === 'SHORT' ? newPosition.entryShortPrice : newPosition.entryLongPrice,
            createdAt: new Date(newPosition.entryTimestamp),
          };
          
          return [pendingOrder, ...prev];
        });
      } else if (newPosition.status === 'OPEN') {
        // Add to open positions (Open Positions tab)
        console.log('   → Adding to Open Positions (both legs filled)');
        setOpenPositions((prev) => {
          const exists = prev.some(p => p.id === newPosition.id);
          if (exists) return prev;
          
          return [newPosition, ...prev];
        });
      }
    });

    return unsubscribe;
  }, []);

  // Filter positions for current pair
  const filteredPositions = openPositions.filter(pos => 
    (pos.longMarketSymbol === longToken && pos.shortMarketSymbol === shortToken) ||
    (pos.shortMarketSymbol === longToken && pos.longMarketSymbol === shortToken)
  );

  // Handle close single position (updated signature for new table)
  const handleCloseSinglePosition = async (positionId: string) => {
    if (!wallet.publicKey) return;
    
    setClosingPosition(positionId);
    try {
      console.log('🔒 Closing position:', positionId);
      await closePairTrade(positionId);
      
      // Remove from open positions immediately (optimistic update)
      setOpenPositions(prev => prev.filter(p => p.id !== positionId));
      
      // Refetch closed positions to update Trade History
      const allPosRes = await fetch(`/api/positions?wallet=${wallet.publicKey?.toString()}`);
      if (allPosRes.ok) {
        const allPosData = await allPosRes.json();
        const allPositions = allPosData.positions || [];
        const closed = allPositions
          .filter((p: any) => p.status === 'CLOSED' && p.closeTimestamp)
          .sort((a: any, b: any) => 
            new Date(b.closeTimestamp).getTime() - new Date(a.closeTimestamp).getTime()
          );
        setClosedPositions(closed);
      }
      
      console.log('✅ Position closed and UI updated');
    } catch (error) {
      console.error('Error closing position:', error);
      alert(`Failed to close position: ${error}`);
    } finally {
      setClosingPosition(null);
    }
  };

  // Keep old signature for backwards compatibility
  const handleClosePosition = async (position: Position) => {
    await handleCloseSinglePosition(position.id);
  };

  // Handle close all positions
  const handleCloseAll = async () => {
    if (!wallet.publicKey || filteredPositions.length === 0) return;
    
    if (!confirm(`Are you sure you want to close all ${filteredPositions.length} position(s)?`)) {
      return;
    }

    // Close all positions one by one
    for (const position of filteredPositions) {
      await handleCloseSinglePosition(position.id);
    }
  };

  // Handle cancel order (cancel partial position)
  const handleCancelOrder = async (orderId: string) => {
    if (!wallet.publicKey) return;
    
    try {
      console.log('🗑️ Canceling partial position:', orderId);
      
      // Remove from pending orders immediately (optimistic update)
      setPendingOrders(prev => prev.filter(o => o.id !== orderId));
      
      // Use the hook function to handle Drift transactions + DB update
      await cancelPartialPosition(orderId);
      
      console.log('✅ Partial position cancelled successfully');
    } catch (error) {
      console.error('Error canceling order:', error);
      alert(`Failed to cancel order: ${error}`);
      
      // Refresh orders to get accurate state
      const ordersRes = await fetch(`/api/orders/partial?wallet=${wallet.publicKey?.toString()}`);
      if (ordersRes.ok) {
        const ordersData = await ordersRes.json();
        const orders: PendingOrder[] = (ordersData.orders || []).map((order: any) => ({
          id: order.id,
          positionId: order.positionId,
          pairLong: order.pairLong,
          pairShort: order.pairShort,
          market: order.market,
          action: order.action,
          orderType: order.orderType,
          size: order.size,
          filled: order.filled,
          price: order.price,
          createdAt: new Date(order.createdAt),
        }));
        setPendingOrders(orders);
      }
    }
  };

  // Handle cancel all orders (cancel all partial positions)
  const handleCancelAllOrders = async () => {
    if (!wallet.publicKey || pendingOrders.length === 0) return;
    
    if (!confirm(`Are you sure you want to cancel all ${pendingOrders.length} partial position(s)?`)) {
      return;
    }

    try {
      console.log('🗑️ Canceling all partial positions');
      
      // Clear pending orders immediately (optimistic update)
      const ordersToCancel = [...pendingOrders];
      setPendingOrders([]);
      
      // Cancel each position one by one
      for (const order of ordersToCancel) {
        try {
          await cancelPartialPosition(order.id);
          console.log(`✅ Canceled position ${order.id}`);
        } catch (error) {
          console.error(`❌ Failed to cancel position ${order.id}:`, error);
        }
      }
      
      console.log('✅ All partial positions canceled');
    } catch (error) {
      console.error('Error canceling all orders:', error);
      alert(`Failed to cancel all orders: ${error}`);
      
      // Refresh orders to get accurate state
      const ordersRes = await fetch(`/api/orders/partial?wallet=${wallet.publicKey?.toString()}`);
      if (ordersRes.ok) {
        const ordersData = await ordersRes.json();
        const orders: PendingOrder[] = (ordersData.orders || []).map((order: any) => ({
          id: order.id,
          positionId: order.positionId,
          pairLong: order.pairLong,
          pairShort: order.pairShort,
          market: order.market,
          action: order.action,
          orderType: order.orderType,
          size: order.size,
          filled: order.filled,
          price: order.price,
          createdAt: new Date(order.createdAt),
        }));
        setPendingOrders(orders);
      }
    }
  };

  return (
    <div className="rounded-2xl border border-border/60 bg-background/30 backdrop-blur-xl p-4">
      {/* Tabs */}
      <div className="flex gap-1 border-b border-border/40 pb-2">
        <button
          onClick={() => setActiveTab('positions')}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
            activeTab === 'positions'
              ? 'bg-purple-600 text-white'
              : 'text-foreground/60 hover:text-foreground hover:bg-background/40'
          }`}
        >
          Open Positions ({filteredPositions.length})
        </button>
        <button
          onClick={() => setActiveTab('orders')}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
            activeTab === 'orders'
              ? 'bg-purple-600 text-white'
              : 'text-foreground/60 hover:text-foreground hover:bg-background/40'
          }`}
        >
          Open Orders
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
            activeTab === 'history'
              ? 'bg-purple-600 text-white'
              : 'text-foreground/60 hover:text-foreground hover:bg-background/40'
          }`}
        >
          Trade History
        </button>
        <button
          onClick={() => setActiveTab('twap')}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
            activeTab === 'twap'
              ? 'bg-purple-600 text-white'
              : 'text-foreground/60 hover:text-foreground hover:bg-background/40'
          }`}
        >
          TWAP
        </button>
      </div>

      {/* Content */}
      <div className="mt-4">
        {activeTab === 'positions' && (
          <PositionsTable
            positions={filteredPositions}
            onClose={handleCloseSinglePosition}
            onCloseAll={handleCloseAll}
            loading={!!closingPosition}
          />
        )}

        {activeTab === 'orders' && (
          <OrdersTable
            orders={pendingOrders}
            onCancel={handleCancelOrder}
            onCancelAll={handleCancelAllOrders}
            loading={loading}
          />
        )}

        {activeTab === 'history' && (() => {
          // Filter closed positions for current pair and convert to ClosedTrade format
          const filteredClosed: ClosedTrade[] = closedPositions
            .filter(pos => 
              (pos.longMarketSymbol === longToken && pos.shortMarketSymbol === shortToken) ||
              (pos.shortMarketSymbol === longToken && pos.longMarketSymbol === shortToken)
            )
            .map(pos => ({
              id: pos.id,
              longMarketSymbol: pos.longMarketSymbol,
              shortMarketSymbol: pos.shortMarketSymbol,
              closeTimestamp: new Date(pos.closeTimestamp || pos.entryTimestamp),
              realizedPnL: pos.realizedPnL || 0,
              realizedPnLPercent: pos.realizedPnLPercent || 0,
              capitalUSDC: pos.capitalUSDC,
              leverage: pos.leverage,
              entryLongPrice: pos.entryLongPrice,
              entryShortPrice: pos.entryShortPrice,
              entryRatio: pos.entryRatio,
              closeLongPrice: pos.closeLongPrice || pos.entryLongPrice,
              closeShortPrice: pos.closeShortPrice || pos.entryShortPrice,
              closeRatio: pos.closeRatio || pos.entryRatio,
            }));

          return (
            <TradeHistoryTable 
              trades={filteredClosed}
              loading={loading}
            />
          );
        })()}

        {activeTab === 'twap' && (
          <div className="py-8 text-center">
            <div className="text-foreground/60 text-sm">
              <p className="font-semibold">Average Pair Ratio</p>
              <div className="mt-4 p-4 rounded-lg bg-background/40 border border-border/40">
                {(() => {
                  // Calculate average ratio from recent closed positions
                  const recentClosed = closedPositions.filter(pos => {
                    if (!pos.closeTimestamp) return false;
                    const dayAgo = new Date().getTime() - 86400000; // 24 hours
                    return new Date(pos.closeTimestamp).getTime() > dayAgo;
                  });

                  if (recentClosed.length === 0) {
                    return (
                      <div className="text-foreground/60">
                        <div className="text-lg">No data</div>
                        <div className="text-xs mt-1">Close positions to see average ratio</div>
                      </div>
                    );
                  }

                  const avgRatio = recentClosed.reduce((sum, p) => sum + (p.closeRatio || p.entryRatio), 0) / recentClosed.length;

                  return (
                    <>
                      <div className="text-2xl font-bold text-purple-400">{avgRatio.toFixed(6)}</div>
                      <div className="text-xs text-foreground/60 mt-1">
                        24h Avg Ratio for {longToken}/{shortToken}
                      </div>
                      <div className="text-[10px] text-foreground/50 mt-1">
                        Based on {recentClosed.length} closed position(s)
                      </div>
                    </>
                  );
                })()}
              </div>
              <p className="text-xs mt-4 text-foreground/50">
                Average ratio helps identify typical price relationships between pairs
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

