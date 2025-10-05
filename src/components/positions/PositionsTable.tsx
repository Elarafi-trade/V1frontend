/**
 * PositionsTable Component
 * Displays a table of open positions with live P&L
 */

'use client';

import { PositionRow } from './PositionRow';

// Flexible position type that works with any position data
export interface PositionData {
  id: string;
  longMarketSymbol: string;
  shortMarketSymbol: string;
  entryRatio: number;
  capitalUSDC: number;
  leverage: number;
  takeProfitPercent?: number | null;
  stopLossPercent?: number | null;
  currentRatio?: number;
  currentLongPrice?: number;
  currentShortPrice?: number;
  unrealizedPnL?: number;
  unrealizedPnLPercent?: number;
}

interface PositionsTableProps {
  positions: PositionData[];
  onClose: (positionId: string) => void;
  onCloseAll: () => void;
  loading?: boolean;
}

export function PositionsTable({ 
  positions, 
  onClose, 
  onCloseAll,
  loading = false 
}: PositionsTableProps) {
  if (positions.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <div className="text-lg">No open positions</div>
        <div className="text-sm mt-2">Open a position to see it here</div>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Close All Button */}
      <div className="flex justify-end mb-4">
        <button 
          onClick={onCloseAll}
          disabled={loading}
          className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg font-medium transition-colors"
        >
          Close All Positions ({positions.length})
        </button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-gray-800">
        <table className="w-full">
          <thead className="bg-gray-900/50">
            <tr className="border-b border-gray-700 text-gray-400 text-sm">
              <th className="text-left p-3 font-medium">Pair</th>
              <th className="text-right p-3 font-medium">Size</th>
              <th className="text-right p-3 font-medium">Entry Price</th>
              <th className="text-right p-3 font-medium">Mark Price</th>
              <th className="text-right p-3 font-medium">P&L</th>
              <th className="text-right p-3 font-medium">Margin</th>
              <th className="text-right p-3 font-medium">Liq Price</th>
              <th className="text-center p-3 font-medium">TP/SL</th>
              <th className="text-center p-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-gray-900/20">
            {positions.map(position => (
              <PositionRow 
                key={position.id}
                position={position}
                onClose={() => onClose(position.id)}
                loading={loading}
              />
            ))}
          </tbody>
        </table>
      </div>

      {/* Summary Stats */}
      <div className="mt-4 flex gap-6 text-sm text-gray-400">
        <div>
          <span className="font-medium">Total Positions:</span> {positions.length}
        </div>
        <div>
          <span className="font-medium">Total Capital:</span> $
          {positions.reduce((sum, p) => sum + p.capitalUSDC, 0).toLocaleString()}
        </div>
      </div>
    </div>
  );
}

