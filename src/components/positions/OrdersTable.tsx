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
      <div className="text-center py-12 text-gray-500">
        <div className="text-lg">No pending orders</div>
        <div className="text-sm mt-2">Orders waiting to be filled will appear here</div>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Cancel All Button */}
      <div className="flex justify-end mb-4">
        <button 
          onClick={onCancelAll}
          disabled={loading}
          className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg font-medium transition-colors"
        >
          Cancel All Orders ({orders.length})
        </button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-gray-800">
        <table className="w-full">
          <thead className="bg-gray-900/50">
            <tr className="border-b border-gray-700 text-gray-400 text-sm">
              <th className="text-left p-3 font-medium">Time</th>
              <th className="text-left p-3 font-medium">Pair</th>
              <th className="text-left p-3 font-medium">Market</th>
              <th className="text-center p-3 font-medium">Action</th>
              <th className="text-center p-3 font-medium">Type</th>
              <th className="text-right p-3 font-medium">Size</th>
              <th className="text-right p-3 font-medium">Filled</th>
              <th className="text-right p-3 font-medium">Price</th>
              <th className="text-center p-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-gray-900/20">
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
      <div className="mt-4 text-sm text-gray-400">
        <span className="font-medium">Total Pending:</span> {orders.length} order{orders.length !== 1 ? 's' : ''}
      </div>
    </div>
  );
}

