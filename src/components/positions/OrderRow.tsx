/**
 * OrderRow Component
 * Displays a single pending order row in the orders table
 */

'use client';

import { PairLogo } from './PairLogo';
import { formatCurrency, formatRelativeTime } from '@/lib/calculations/formatters';

export interface PendingOrder {
  id: string;
  positionId?: string;
  pairLong: string;
  pairShort: string;
  market: string;
  action: 'LONG' | 'SHORT';
  orderType: 'Oracle' | 'Market' | 'Limit';
  size: number;
  filled: number;
  price: number;
  createdAt: Date;
}

interface OrderRowProps {
  order: PendingOrder;
  onCancel: () => void;
  loading?: boolean;
}

export function OrderRow({ order, onCancel, loading = false }: OrderRowProps) {
  const actionColor = order.action === 'LONG' ? 'text-green-500' : 'text-red-500';

  return (
    <tr className="border-b border-[#1a1a1a] hover:bg-[#1C221C] transition-colors">
      {/* Time */}
      <td className="p-2 text-[#717171] text-xs">
        {formatRelativeTime(order.createdAt)}
      </td>
      
      {/* Pair */}
      <td className="p-2">
        <PairLogo 
          longSymbol={order.pairLong}
          shortSymbol={order.pairShort}
          size="sm"
        />
      </td>
      
      {/* Market (which leg) */}
      <td className="p-2 text-white font-medium text-xs">
        {order.market}
      </td>
      
      {/* Action */}
      <td className="text-center p-2">
        <span className={`${actionColor} font-semibold text-xs`}>
          {order.action}
        </span>
      </td>
      
      {/* Type */}
      <td className="text-center p-2 text-[#717171] text-xs">
        {order.orderType}
      </td>
      
      {/* Size */}
      <td className="text-right p-2 text-white text-xs">
        {order.size}
      </td>
      
      {/* Filled */}
      <td className="text-right p-2">
        <span className={`${order.filled > 0 ? 'text-yellow-400' : 'text-[#717171]'} text-xs`}>
          {order.filled}
        </span>
      </td>
      
      {/* Price */}
      <td className="text-right p-2 text-white text-xs">
        {formatCurrency(order.price)}
      </td>
      
      {/* Actions */}
      <td className="text-center p-2">
        <button
          onClick={onCancel}
          disabled={loading}
          className="px-3 py-1 bg-red-500/20 hover:bg-red-500/30 disabled:bg-[#1a1a1a] disabled:cursor-not-allowed disabled:text-[#717171] rounded text-red-400 text-xs font-semibold transition-colors border border-red-500/30"
        >
          {loading ? 'Canceling...' : 'Cancel'}
        </button>
      </td>
    </tr>
  );
}

