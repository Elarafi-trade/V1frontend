/**
 * TradeHistoryTable Component
 * Displays a table of closed trades
 */

'use client';

import { TradeHistoryRow, ClosedTrade } from './TradeHistoryRow';

export type { ClosedTrade };

interface TradeHistoryTableProps {
  trades: ClosedTrade[];
  loading?: boolean;
}

export function TradeHistoryTable({ trades, loading = false }: TradeHistoryTableProps) {
  if (loading) {
    return (
      <div className="py-12 text-center">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-purple-500 border-r-transparent"></div>
        <div className="mt-2 text-gray-400">Loading trade history...</div>
      </div>
    );
  }

  if (trades.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <div className="text-lg">No closed positions</div>
        <div className="text-sm mt-2">Your trade history will appear here</div>
      </div>
    );
  }

  // Calculate summary stats
  const totalPnL = trades.reduce((sum, trade) => sum + trade.realizedPnL, 0);
  const profitableTrades = trades.filter(t => t.realizedPnL > 0).length;
  const winRate = (profitableTrades / trades.length) * 100;
  const avgPnL = totalPnL / trades.length;

  return (
    <div className="relative">
      {/* Summary Stats */}
      <div className="grid grid-cols-4 gap-4 mb-4 p-4 bg-gray-900/30 rounded-lg border border-gray-800">
        <div>
          <div className="text-xs text-gray-400">Total P&L</div>
          <div className={`text-lg font-semibold ${totalPnL >= 0 ? 'text-green-500' : 'text-red-500'}`}>
            {totalPnL >= 0 ? '+' : ''}${totalPnL.toFixed(2)}
          </div>
        </div>
        <div>
          <div className="text-xs text-gray-400">Win Rate</div>
          <div className="text-lg font-semibold text-gray-200">
            {winRate.toFixed(1)}%
          </div>
        </div>
        <div>
          <div className="text-xs text-gray-400">Avg P&L</div>
          <div className={`text-lg font-semibold ${avgPnL >= 0 ? 'text-green-500' : 'text-red-500'}`}>
            {avgPnL >= 0 ? '+' : ''}${avgPnL.toFixed(2)}
          </div>
        </div>
        <div>
          <div className="text-xs text-gray-400">Total Trades</div>
          <div className="text-lg font-semibold text-gray-200">
            {trades.length}
          </div>
        </div>
      </div>

      {/* Trade History Table */}
      <div className="overflow-x-auto rounded-lg border border-gray-800">
        <table className="w-full">
          <thead className="bg-gray-900/50">
            <tr className="border-b border-gray-700 text-gray-400 text-sm">
              <th className="text-left p-3 font-medium">Market</th>
              <th className="text-left p-3 font-medium">Time</th>
              <th className="text-left p-3 font-medium">P&L</th>
              <th className="text-left p-3 font-medium">Size</th>
              <th className="text-left p-3 font-medium">Entry Price</th>
              <th className="text-left p-3 font-medium">Exit Price</th>
              <th className="text-left p-3 font-medium">Price %</th>
            </tr>
          </thead>
          <tbody className="bg-gray-900/20">
            {trades.map(trade => (
              <TradeHistoryRow 
                key={trade.id}
                trade={trade}
              />
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer Summary */}
      <div className="mt-4 text-sm text-gray-400 flex justify-between">
        <span>
          <span className="font-medium">Showing:</span> {trades.length} trade{trades.length !== 1 ? 's' : ''}
        </span>
        <span>
          <span className="text-green-500">{profitableTrades} wins</span>
          {' • '}
          <span className="text-red-500">{trades.length - profitableTrades} losses</span>
        </span>
      </div>
    </div>
  );
}

