/**
 * TradeHistoryRow Component
 * Displays a single closed trade in the trade history table
 */

'use client';

import { PairLogo } from './PairLogo';
import { formatRelativeTime, formatCurrency, formatPercent, formatNumber } from '@/lib/calculations/formatters';

export interface ClosedTrade {
  id: string;
  longMarketSymbol: string;
  shortMarketSymbol: string;
  closeTimestamp: Date;
  realizedPnL: number;
  realizedPnLPercent: number;
  capitalUSDC: number;
  leverage: number;
  
  // Entry data
  entryLongPrice: number;
  entryShortPrice: number;
  entryRatio: number;
  
  // Close data
  closeLongPrice: number;
  closeShortPrice: number;
  closeRatio: number;
  
  // Size data (calculated from capital and leverage)
  longSize?: number;
  shortSize?: number;
}

interface TradeHistoryRowProps {
  trade: ClosedTrade;
}

export function TradeHistoryRow({ trade }: TradeHistoryRowProps) {
  const isProfitable = trade.realizedPnL >= 0;
  const pnlColor = isProfitable ? 'text-green-500' : 'text-red-500';
  
  // Calculate size for each leg
  const longSize = trade.longSize || (trade.capitalUSDC * 0.5 * trade.leverage) / trade.entryLongPrice;
  const shortSize = trade.shortSize || (trade.capitalUSDC * 0.5 * trade.leverage) / trade.entryShortPrice;
  
  // Calculate price change % for each leg
  const longPriceChange = ((trade.closeLongPrice - trade.entryLongPrice) / trade.entryLongPrice) * 100;
  const shortPriceChange = ((trade.closeShortPrice - trade.entryShortPrice) / trade.entryShortPrice) * 100;

  return (
    <tr className="border-b border-[#1a1a1a] hover:bg-[#080807]/50 transition-colors">
      {/* Market (Pair) */}
      <td className="p-2 text-left">
        <PairLogo 
          longSymbol={trade.longMarketSymbol}
          shortSymbol={trade.shortMarketSymbol}
          size="sm"
        />
      </td>
      
      {/* Time */}
      <td className="p-2 text-left text-[#717171] text-xs">
        {formatRelativeTime(trade.closeTimestamp)}
      </td>
      
      {/* P&L */}
      <td className="p-2 text-right">
        <div className={`text-xs font-semibold ${pnlColor}`}>
          {isProfitable ? '+' : ''}{formatCurrency(trade.realizedPnL)}
        </div>
        <div className={`text-[10px] ${pnlColor}`}>
          {formatPercent(trade.realizedPnLPercent)}
        </div>
      </td>
      
      {/* Size */}
      <td className="p-2 text-right text-xs">
        <div className="text-white">{formatNumber(longSize, 2)} {trade.longMarketSymbol}</div>
        <div className="text-[#717171] text-[10px]">{formatNumber(shortSize, 2)} {trade.shortMarketSymbol}</div>
      </td>
      
      {/* Entry Price */}
      <td className="p-2 text-right text-xs">
        <div className="text-white">{formatCurrency(trade.entryLongPrice)}</div>
        <div className="text-[#717171] text-[10px]">{formatCurrency(trade.entryShortPrice)}</div>
      </td>
      
      {/* Exit Price */}
      <td className="p-2 text-right text-xs">
        <div className="text-white">{formatCurrency(trade.closeLongPrice)}</div>
        <div className="text-[#717171] text-[10px]">{formatCurrency(trade.closeShortPrice)}</div>
      </td>
      
      {/* Price % Change */}
      <td className="p-2 text-right text-xs">
        <div className={longPriceChange >= 0 ? 'text-green-500' : 'text-red-500'}>
          {formatPercent(longPriceChange)}
        </div>
        <div className={`text-[10px] ${shortPriceChange >= 0 ? 'text-green-500' : 'text-red-500'}`}>
          {formatPercent(shortPriceChange)}
        </div>
      </td>
    </tr>
  );
}

