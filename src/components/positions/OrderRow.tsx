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
    <tr className="border-b border-gray-800 hover:bg-gray-900/50 transition-colors">
      {/* Time */}
      <td className="p-3 text-gray-400 text-sm">
        {formatRelativeTime(order.createdAt)}
      </td>
      
      {/* Pair */}
      <td className="p-3">
        <PairLogo 
          longSymbol={order.pairLong}
          shortSymbol={order.pairShort}
          size="sm"
        />
      </td>
      
      {/* Market (which leg) */}
      <td className="p-3 text-gray-200 font-medium">
        {order.market}
      </td>
      
      {/* Action */}
      <td className="text-center p-3">
        <span className={`${actionColor} font-semibold`}>
          {order.action}
        </span>
      </td>
      
      {/* Type */}
      <td className="text-center p-3 text-gray-300">
        {order.orderType}
      </td>
      
      {/* Size */}
      <td className="text-right p-3 text-gray-200">
        {order.size}
      </td>
      
      {/* Filled */}
      <td className="text-right p-3">
        <span className={order.filled > 0 ? 'text-yellow-500' : 'text-gray-500'}>
          {order.filled}
        </span>
      </td>
      
      {/* Price */}
      <td className="text-right p-3 text-gray-200">
        {formatCurrency(order.price)}
      </td>
      
      {/* Actions */}
      <td className="text-center p-3">
        <button
          onClick={onCancel}
          disabled={loading}
          className="px-3 py-1.5 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded text-sm font-medium transition-colors"
        >
          {loading ? 'Canceling...' : 'Cancel'}
        </button>
      </td>
    </tr>
  );
}

