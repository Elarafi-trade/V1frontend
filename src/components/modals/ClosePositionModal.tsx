'use client';

import React from 'react';
import { X, AlertTriangle } from 'lucide-react';

interface Position {
  id: string;
  longMarketSymbol: string;
  shortMarketSymbol: string;
  capitalUSDC: number;
  entryRatio: number;
  currentRatio?: number;
  unrealizedPnL?: number;
  unrealizedPnLPercent?: number;
}

interface ClosePositionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  position: Position | null;
  loading?: boolean;
}

export default function ClosePositionModal({
  isOpen,
  onClose,
  onConfirm,
  position,
  loading = false,
}: ClosePositionModalProps) {
  if (!isOpen || !position) return null;

  const pnl = position.unrealizedPnL || 0;
  const pnlPercent = position.unrealizedPnLPercent || 0;
  const isProfitable = pnl >= 0;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
        onClick={!loading ? onClose : undefined}
      />

      {/* Modal */}
      <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[90%] max-w-md">
        <div className="bg-[#0F110F] rounded-2xl border border-[#212621] shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-[#212621]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-red-500" />
              </div>
              <h2 className="text-xl font-bold text-white">Close Position</h2>
            </div>
            {!loading && (
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>

          {/* Body */}
          <div className="p-6 space-y-6">
            {/* Warning Message */}
            <p className="text-gray-300 text-sm">
              Are you sure you want to close this position? This action cannot be undone.
            </p>

            {/* Position Details */}
            <div className="bg-[#151815] rounded-lg p-4 space-y-3">
              {/* Pair */}
              <div className="flex items-center justify-between">
                <span className="text-gray-400 text-sm">Pair</span>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-1 bg-green-500/20 text-green-400 rounded text-xs font-semibold">
                    {position.longMarketSymbol}
                  </span>
                  <span className="text-gray-500">/</span>
                  <span className="px-2 py-1 bg-red-500/20 text-red-400 rounded text-xs font-semibold">
                    {position.shortMarketSymbol}
                  </span>
                </div>
              </div>

              {/* Size */}
              <div className="flex items-center justify-between">
                <span className="text-gray-400 text-sm">Position Size</span>
                <span className="text-white font-semibold">
                  ${position.capitalUSDC.toFixed(2)}
                </span>
              </div>

              {/* Entry Price */}
              <div className="flex items-center justify-between">
                <span className="text-gray-400 text-sm">Entry Ratio</span>
                <span className="text-gray-300 font-mono text-sm">
                  {position.entryRatio.toFixed(6)}
                </span>
              </div>

              {/* Current Price */}
              {position.currentRatio && (
                <div className="flex items-center justify-between">
                  <span className="text-gray-400 text-sm">Current Ratio</span>
                  <span className="text-white font-mono text-sm font-semibold">
                    {position.currentRatio.toFixed(6)}
                  </span>
                </div>
              )}

              {/* Divider */}
              <div className="border-t border-[#212621] pt-3 mt-3">
                {/* Estimated P&L */}
                <div className="flex items-center justify-between">
                  <span className="text-gray-400 text-sm">Estimated P&L</span>
                  <div className="text-right">
                    <div className={`font-bold text-base ${isProfitable ? 'text-green-500' : 'text-red-500'}`}>
                      {isProfitable ? '+' : ''}${pnl.toFixed(2)}
                    </div>
                    <div className={`text-xs ${isProfitable ? 'text-green-400' : 'text-red-400'}`}>
                      {isProfitable ? '+' : ''}{pnlPercent.toFixed(2)}%
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Warning Notice */}
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3">
              <p className="text-yellow-400 text-xs">
                <span className="font-semibold">Note:</span> Both long and short positions will be closed simultaneously with a single signature.
              </p>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center gap-3 p-6 bg-[#151815] border-t border-[#212621]">
            <button
              onClick={onClose}
              disabled={loading}
              className="flex-1 px-4 py-3 bg-[#202919] hover:bg-[#2a2f2a] disabled:opacity-50 disabled:cursor-not-allowed text-gray-300 rounded-lg font-semibold transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              disabled={loading}
              className="flex-1 px-4 py-3 bg-red-500 hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-semibold transition-colors"
            >
              {loading ? 'Closing...' : 'Close Position'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

