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
  closingPositions?: Set<string>;
}

export function PositionsTable({ 
  positions, 
  onClose, 
  onCloseAll,
  loading = false,
  closingPositions = new Set()
}: PositionsTableProps) {
  if (positions.length === 0) {
    return (
      <div className="text-center py-12 text-[#717171]">
        <div className="text-sm">No open positions</div>
        <div className="text-xs mt-2">Open a position to see it here</div>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Close All Button */}
      <div className="flex justify-end mb-3">
        <button 
          onClick={onCloseAll}
          disabled={loading}
          className="px-3 py-1.5 bg-[#A2DB5C] hover:bg-[#8cc745] disabled:bg-[#1a1a1a] disabled:cursor-not-allowed disabled:text-[#717171] rounded-lg text-black font-semibold text-xs transition-colors"
        >
          Close All ({positions.length})
        </button>
      </div>

      {/* Table - pear.garden style */}
      <div className="overflow-x-auto rounded-lg border border-[#1a1a1a]">
        <table className="w-full">
          <thead className="bg-[#080807]">
            <tr className="border-b border-[#1a1a1a] text-[#717171] text-xs">
              <th className="text-left p-2 font-semibold">Pair</th>
              <th className="text-right p-2 font-semibold">Size</th>
              <th className="text-right p-2 font-semibold">Entry</th>
              <th className="text-right p-2 font-semibold">Mark</th>
              <th className="text-right p-2 font-semibold">P&L</th>
              <th className="text-right p-2 font-semibold">Margin</th>
              <th className="text-right p-2 font-semibold">Liq</th>
              <th className="text-center p-2 font-semibold">TP/SL</th>
              <th className="text-center p-2 font-semibold">Action</th>
            </tr>
          </thead>
          <tbody className="bg-[#0F110F]/30">
            {positions.map(position => (
              <PositionRow 
                key={position.id}
                position={position}
                onClose={() => onClose(position.id)}
                loading={closingPositions.has(position.id)}
              />
            ))}
          </tbody>
        </table>
      </div>

      {/* Summary Stats */}
      <div className="mt-3 flex gap-4 text-xs text-[#717171]">
        <div>
          <span className="font-medium">Positions:</span> <span className="text-white">{positions.length}</span>
        </div>
        <div>
          <span className="font-medium">Capital:</span> <span className="text-white">${positions.reduce((sum, p) => sum + p.capitalUSDC, 0).toLocaleString()}</span>
        </div>
      </div>
    </div>
  );
}

