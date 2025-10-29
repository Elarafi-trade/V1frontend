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
        <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-solid border-[#A855F7] border-r-transparent"></div>
        <div className="mt-2 text-[#717171] text-xs">Loading...</div>
      </div>
    );
  }

  if (trades.length === 0) {
    return (
      <div className="text-center py-12 text-[#717171]">
        <div className="text-sm">No closed positions</div>
        <div className="text-xs mt-2">Your trade history will appear here</div>
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
      {/* Summary Stats - pear.garden style */}
      <div className="grid grid-cols-4 gap-3 mb-3 p-3 bg-[#0F110F] rounded-lg border border-[#1a1a1a]">
        <div>
          <div className="text-[10px] text-[#717171]">Total P&L</div>
          <div className={`text-sm font-semibold ${totalPnL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {totalPnL >= 0 ? '+' : ''}${totalPnL.toFixed(2)}
          </div>
        </div>
        <div>
          <div className="text-[10px] text-[#717171]">Win Rate</div>
          <div className="text-sm font-semibold text-white">
            {winRate.toFixed(1)}%
          </div>
        </div>
        <div>
          <div className="text-[10px] text-[#717171]">Avg P&L</div>
          <div className={`text-sm font-semibold ${avgPnL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {avgPnL >= 0 ? '+' : ''}${avgPnL.toFixed(2)}
          </div>
        </div>
        <div>
          <div className="text-[10px] text-[#717171]">Trades</div>
          <div className="text-sm font-semibold text-white">
            {trades.length}
          </div>
        </div>
      </div>

      {/* Trade History Table - pear.garden style */}
      <div className="overflow-x-auto rounded-lg border border-[#1a1a1a]">
        <table className="w-full">
          <thead className="bg-[#080807]">
            <tr className="border-b border-[#1a1a1a] text-[#717171] text-xs">
              <th className="text-left p-2 font-semibold">Market</th>
              <th className="text-left p-2 font-semibold">Time</th>
              <th className="text-right p-2 font-semibold">P&L</th>
              <th className="text-right p-2 font-semibold">Size</th>
              <th className="text-right p-2 font-semibold">Entry</th>
              <th className="text-right p-2 font-semibold">Exit</th>
              <th className="text-right p-2 font-semibold">%</th>
            </tr>
          </thead>
          <tbody className="bg-[#0F110F]/30">
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
      <div className="mt-3 text-xs text-[#717171] flex justify-between">
        <span>
          <span className="font-medium">Total:</span> <span className="text-white">{trades.length}</span>
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

