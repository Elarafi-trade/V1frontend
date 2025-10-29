/**
 * OrdersTable Component
 * Displays a table of pending orders
 */

'use client';

import { OrderRow, PendingOrder } from './OrderRow';

interface OrdersTableProps {
  orders: PendingOrder[];
  onCancel: (orderId: string) => void;
  onCancelAll: () => void;
  loading?: boolean;
}

export function OrdersTable({ 
  orders, 
  onCancel, 
  onCancelAll,
  loading = false 
}: OrdersTableProps) {
  if (orders.length === 0) {
    return (
      <div className="text-center py-12 text-[#717171]">
        <div className="text-sm">No pending orders</div>
        <div className="text-xs mt-2">Orders waiting to be filled will appear here</div>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Cancel All Button */}
      <div className="flex justify-end mb-3">
        <button 
          onClick={onCancelAll}
          disabled={loading}
          className="px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 disabled:bg-[#1a1a1a] disabled:cursor-not-allowed disabled:text-[#717171] rounded-lg text-red-400 font-semibold text-xs transition-colors border border-red-500/30"
        >
          Cancel All ({orders.length})
        </button>
      </div>

      {/* Table - pear.garden style */}
      <div className="overflow-x-auto rounded-lg border border-[#1a1a1a]">
        <table className="w-full">
          <thead className="bg-[#080807]">
            <tr className="border-b border-[#1a1a1a] text-[#717171] text-xs">
              <th className="text-left p-2 font-semibold">Time</th>
              <th className="text-left p-2 font-semibold">Pair</th>
              <th className="text-left p-2 font-semibold">Market</th>
              <th className="text-center p-2 font-semibold">Side</th>
              <th className="text-center p-2 font-semibold">Type</th>
              <th className="text-right p-2 font-semibold">Size</th>
              <th className="text-right p-2 font-semibold">Filled</th>
              <th className="text-right p-2 font-semibold">Price</th>
              <th className="text-center p-2 font-semibold">Action</th>
            </tr>
          </thead>
          <tbody className="bg-[#0F110F]/30">
            {orders.map(order => (
              <OrderRow 
                key={order.id}
                order={order}
                onCancel={() => onCancel(order.id)}
                loading={loading}
              />
            ))}
          </tbody>
        </table>
      </div>

      {/* Summary */}
      <div className="mt-3 text-xs text-[#717171]">
        <span className="font-medium">Pending:</span> <span className="text-white">{orders.length}</span>
      </div>
    </div>
  );
}

