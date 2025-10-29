'use client';

import React from 'react';
import { useDriftAccount } from '@/hooks/useDriftAccount';
import { Wallet, TrendingUp, Lock } from 'lucide-react';

export default function AccountBalance() {
  const { balance } = useDriftAccount();

  // Hide if no balance loaded yet
  if (!balance) {
    return null;
  }

  const pnl = balance.equity - balance.totalCollateral;
  const isProfitable = pnl >= 0;

  return (
    <div className="flex items-center gap-4 px-4 py-2 rounded-lg bg-background/40 border border-border backdrop-blur-sm">
      {/* Total Equity */}
      <div className="flex items-center gap-2">
        <Wallet className="w-4 h-4 text-purple-400" />
        <div className="flex flex-col">
          <span className="text-xs text-foreground/60">Equity</span>
          <span className="text-sm font-semibold text-foreground">
            ${balance.equity.toFixed(2)}
          </span>
        </div>
      </div>

      <div className="h-6 w-px bg-border" />

      {/* Free Collateral */}
      <div className="flex items-center gap-2">
        <TrendingUp className="w-4 h-4 text-emerald-400" />
        <div className="flex flex-col">
          <span className="text-xs text-foreground/60">Available</span>
          <span className="text-sm font-semibold text-emerald-400">
            ${balance.freeCollateral.toFixed(2)}
          </span>
        </div>
      </div>

      <div className="h-6 w-px bg-border" />

      {/* Used in Positions */}
      <div className="flex items-center gap-2">
        <Lock className="w-4 h-4 text-amber-400" />
        <div className="flex flex-col">
          <span className="text-xs text-foreground/60">In Positions</span>
          <span className="text-sm font-semibold text-amber-400">
            ${balance.usedMargin.toFixed(2)}
          </span>
        </div>
      </div>

      {/* P&L Indicator */}
      {balance.usedMargin > 0 && (
        <>
          <div className="h-6 w-px bg-border" />
          <div className="flex flex-col">
            <span className="text-xs text-foreground/60">Unrealized P&L</span>
            <span className={`text-sm font-semibold ${isProfitable ? 'text-emerald-400' : 'text-rose-400'}`}>
              {isProfitable ? '+' : ''}${pnl.toFixed(2)}
            </span>
          </div>
        </>
      )}
    </div>
  );
}

