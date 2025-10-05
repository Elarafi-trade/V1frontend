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
    <tr className="border-b border-gray-800 hover:bg-gray-900/50 transition-colors">
      {/* Pair */}
      <td className="p-3">
        <PairLogo 
          longSymbol={position.longMarketSymbol}
          shortSymbol={position.shortMarketSymbol}
        />
      </td>
      
      {/* Size */}
      <td className="text-right p-3 font-medium text-gray-200">
        {formatCurrency(position.capitalUSDC, 0)}
      </td>
      
      {/* Entry Price (Ratio) */}
      <td className="text-right p-3 text-gray-300">
        {formatNumber(position.entryRatio, 6)}
      </td>
      
      {/* Mark Price (Current Ratio) */}
      <td className="text-right p-3 font-medium text-gray-200">
        {position.currentRatio 
          ? formatNumber(position.currentRatio, 6)
          : <span className="text-gray-500">-</span>
        }
      </td>
      
      {/* P&L */}
      <td className="text-right p-3">
        <div className={pnlColor}>
          <div className="font-semibold">
            {position.unrealizedPnLPercent !== undefined
              ? formatPercent(position.unrealizedPnLPercent)
              : '-'
            }
          </div>
          <div className="text-sm opacity-80">
            {position.unrealizedPnL !== undefined
              ? `${position.unrealizedPnL >= 0 ? '+' : ''}${formatCurrency(position.unrealizedPnL)}`
              : '-'
            }
          </div>
        </div>
      </td>
      
      {/* Margin */}
      <td className="text-right p-3 text-gray-300">
        {formatCurrency(margin)}
      </td>
      
      {/* Liq Price */}
      <td className="text-right p-3">
        <div className="text-yellow-500 font-medium">
          {formatNumber(liqPrice, 2)}
        </div>
        {health !== undefined && (
          <div className={`text-xs ${healthColor}`}>
            {health.toFixed(0)}% health
          </div>
        )}
      </td>
      
      {/* TP/SL */}
      <td className="text-center p-3">
        {(position.takeProfitPercent !== null && position.takeProfitPercent !== undefined) || 
         (position.stopLossPercent !== null && position.stopLossPercent !== undefined) ? (
          <div className="text-sm space-y-0.5">
            <div className="text-green-500">
              {(position.takeProfitPercent !== null && position.takeProfitPercent !== undefined)
                ? `+${position.takeProfitPercent}%` 
                : '-'}
            </div>
            <div className="text-red-500">
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
      <td className="text-center p-3">
        <button
          onClick={onClose}
          disabled={loading}
          className="px-4 py-1.5 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded text-sm font-medium transition-colors"
        >
          {loading ? 'Closing...' : 'Close'}
        </button>
      </td>
    </tr>
  );
}

