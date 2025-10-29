/**
 * PositionRow Component
 * Displays a single position row in the positions table
 */

'use client';

import { PairLogo } from './PairLogo';
import { formatCurrency, formatNumber, formatPercent } from '@/lib/calculations/formatters';
import { calculateMargin, calculateLiquidationPrice } from '@/lib/calculations/liquidation';

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
  // Accurate Drift Protocol metrics (from server)
  initialMargin?: number;
  maintenanceMargin?: number;
  liquidationRatio?: number;
  health?: number;
  longMMR?: number;
  shortMMR?: number;
  longIMR?: number;
  shortIMR?: number;
}

interface PositionRowProps {
  position: PositionData;
  onClose: () => void;
  loading?: boolean;
}

export function PositionRow({ position, onClose, loading = false }: PositionRowProps) {
  const pnlColor = (position.unrealizedPnLPercent ?? 0) >= 0 
    ? 'text-green-500' 
    : 'text-red-500';
  
  // Use accurate metrics from server if available, otherwise fallback to estimates
  const margin = position.initialMargin || calculateMargin(position.capitalUSDC, position.leverage);
  const liqPrice = position.liquidationRatio || calculateLiquidationPrice({
    entryRatio: position.entryRatio,
    leverage: position.leverage,
  } as any);
  
  // Health indicator color
  const health = position.health;
  const healthColor = health !== undefined
    ? health > 50 ? 'text-green-500'
    : health > 25 ? 'text-yellow-500'
    : 'text-red-500'
    : 'text-gray-500';

  return (
    <tr className="border-b border-[#1a1a1a] hover:bg-[#1C221C] transition-colors">
      {/* Pair */}
      <td className="p-2">
        <PairLogo 
          longSymbol={position.longMarketSymbol}
          shortSymbol={position.shortMarketSymbol}
        />
      </td>
      
      {/* Size */}
      <td className="text-right p-2 font-medium text-white text-xs">
        {formatCurrency(position.capitalUSDC, 0)}
      </td>
      
      {/* Entry Price (Ratio) */}
      <td className="text-right p-2 text-[#717171] text-xs">
        {formatNumber(position.entryRatio, 6)}
      </td>
      
      {/* Mark Price (Current Ratio) */}
      <td className="text-right p-2 font-medium text-white text-xs">
        {position.currentRatio 
          ? formatNumber(position.currentRatio, 6)
          : <span className="text-[#717171]">-</span>
        }
      </td>
      
      {/* P&L */}
      <td className="text-right p-2">
        <div className={pnlColor}>
          <div className="font-semibold text-xs">
            {position.unrealizedPnLPercent !== undefined
              ? formatPercent(position.unrealizedPnLPercent)
              : '-'
            }
          </div>
          <div className="text-[10px] opacity-80">
            {position.unrealizedPnL !== undefined
              ? `${position.unrealizedPnL >= 0 ? '+' : ''}${formatCurrency(position.unrealizedPnL)}`
              : '-'
            }
          </div>
        </div>
      </td>
      
      {/* Margin */}
      <td className="text-right p-2 text-[#717171] text-xs">
        {formatCurrency(margin)}
      </td>
      
      {/* Liq Price */}
      <td className="text-right p-2">
        <div className="text-yellow-400 font-medium text-xs">
          {formatNumber(liqPrice, 2)}
        </div>
        {health !== undefined && (
          <div className={`text-[10px] ${healthColor}`}>
            {health.toFixed(0)}%
          </div>
        )}
      </td>
      
      {/* TP/SL */}
      <td className="text-center p-2">
        {(position.takeProfitPercent !== null && position.takeProfitPercent !== undefined) || 
         (position.stopLossPercent !== null && position.stopLossPercent !== undefined) ? (
          <div className="text-[10px] space-y-0.5">
            <div className="text-green-400">
              {(position.takeProfitPercent !== null && position.takeProfitPercent !== undefined)
                ? `+${position.takeProfitPercent}%` 
                : '-'}
            </div>
            <div className="text-red-400">
              {(position.stopLossPercent !== null && position.stopLossPercent !== undefined)
                ? `-${position.stopLossPercent}%` 
                : '-'}
            </div>
          </div>
        ) : (
          <span className="text-gray-500">-/-</span>
        )}
      </td>
      
      {/* Actions */}
      <td className="text-center p-2">
        <button
          onClick={onClose}
          disabled={loading}
          className="px-3 py-1 bg-red-500/20 hover:bg-red-500/30 disabled:bg-[#1a1a1a] disabled:cursor-not-allowed disabled:text-[#717171] rounded text-red-400 text-xs font-semibold transition-colors border border-red-500/30"
        >
          {loading ? 'Closing...' : 'Close'}
        </button>
      </td>
    </tr>
  );
}

