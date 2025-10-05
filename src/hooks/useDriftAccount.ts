'use client';

import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { useState, useEffect, useCallback } from 'react';
import { createDriftClient } from '../lib/drift/client';

export interface DriftAccountBalance {
  totalCollateral: number; // Total collateral in USD
  freeCollateral: number;  // Available for new positions
  usedMargin: number;      // Currently used by positions
  equity: number;          // Total account value (collateral + unrealized P&L)
}

export const useDriftAccount = () => {
  const { connection } = useConnection();
  const wallet = useWallet();
  const [balance, setBalance] = useState<DriftAccountBalance | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isRateLimited, setIsRateLimited] = useState(false);

  const fetchBalance = useCallback(async () => {
    if (!wallet.publicKey || !wallet.signTransaction) {
      setBalance(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const anchorWallet = wallet as any;
      const driftClient = await createDriftClient({
        connection,
        wallet: anchorWallet,
        env: 'devnet',
      });

      await driftClient.subscribe();

      // Check if user has a Drift account
      try {
        const userAccount = driftClient.getUser();
        
        // Get balances
        const totalCollateral = userAccount.getTotalCollateral();
        const freeCollateral = userAccount.getFreeCollateral();
        
        // Calculate used margin
        const totalCollateralUSD = totalCollateral.toNumber() / 1e6;
        const freeCollateralUSD = freeCollateral.toNumber() / 1e6;
        const usedMarginUSD = totalCollateralUSD - freeCollateralUSD;

        // Get unrealized P&L for equity calculation
        const unrealizedPnl = userAccount.getUnrealizedPNL();
        const unrealizedPnlUSD = unrealizedPnl.toNumber() / 1e6;
        const equityUSD = totalCollateralUSD + unrealizedPnlUSD;

        setBalance({
          totalCollateral: totalCollateralUSD,
          freeCollateral: freeCollateralUSD,
          usedMargin: usedMarginUSD,
          equity: equityUSD,
        });
      } catch (err) {
        // No Drift account yet
        setBalance({
          totalCollateral: 0,
          freeCollateral: 0,
          usedMargin: 0,
          equity: 0,
        });
      }
    } catch (err: any) {
      console.error('Failed to fetch Drift balance:', err);
      
      // Check if it's a rate limit error
      if (err.message?.includes('429') || err.message?.includes('Too many requests')) {
        setIsRateLimited(true);
        setError('Rate limited. Please wait a moment...');
      } else {
        setError(err.message || 'Failed to fetch balance');
      }
    } finally {
      setLoading(false);
    }
  }, [connection, wallet.publicKey, wallet.signTransaction]);

  // DON'T auto-fetch on mount to avoid rate limits
  // Balance will be fetched when user opens deposit/withdraw modal
  // or manually calls refetch()

  return {
    balance,
    loading,
    error,
    refetch: fetchBalance,
  };
};

