/**
 * Hook to fetch available Drift markets
 * Returns ONLY markets that are SUPPORTED by our system
 */

import { useState, useEffect } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { AnchorProvider, Wallet } from '@coral-xyz/anchor';
import { createDriftClient } from '@/lib/drift/client';
import { getAllDriftMarkets, getAvailableTokens } from '@/lib/drift/marketLookup';

// Markets we actively support (must match WebSocket subscriptions in server-ws-v2.js)
const SUPPORTED_MARKETS = ['SOL', 'BTC', 'ETH'];

export interface DriftMarketInfo {
  symbol: string;
  marketIndex: number;
  price: number;
  available: boolean;
}

export function useDriftMarkets() {
  const { connection } = useConnection();
  const wallet = useWallet();
  const [markets, setMarkets] = useState<DriftMarketInfo[]>([]);
  const [availableTokens, setAvailableTokens] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function fetchMarkets() {
      if (!wallet.publicKey) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        // Create Drift client
        const anchorWallet = wallet as any as Wallet;
        const driftClient = await createDriftClient({
          connection,
          wallet: anchorWallet,
          env:'devnet'
        });

        // Get all markets
        const { markets: perpMarkets, marketMap } = await getAllDriftMarkets(driftClient);
        const allTokens = getAvailableTokens(marketMap);
        
        // Filter to only SUPPORTED markets
        const tokens = allTokens.filter(token => SUPPORTED_MARKETS.includes(token));

        if (!mounted) return;

        // Build market info list (only for supported markets)
        const marketInfos: DriftMarketInfo[] = perpMarkets
          .map(market => {
            const price = market.amm.historicalOracleData.lastOraclePrice.toNumber() / 1e6;
            const name = Buffer.from(market.name as any).toString('utf8').replace(/\0/g, '').trim();
            const symbol = name.replace('-PERP', '');

            return {
              symbol,
              marketIndex: market.marketIndex,
              price,
              available: true,
            };
          })
          .filter(market => SUPPORTED_MARKETS.includes(market.symbol)); // Filter here too

        setMarkets(marketInfos);
        setAvailableTokens(tokens);

        console.log('✅ Loaded Drift markets (filtered to supported):', tokens);
        console.log(`   Available on Drift: ${allTokens.length} markets`);
        console.log(`   Supported by us: ${tokens.length} markets`);
      } catch (err: any) {
        console.error('Error fetching Drift markets:', err);
        if (mounted) {
          setError(err.message || 'Failed to fetch markets');
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    fetchMarkets();

    return () => {
      mounted = false;
    };
  }, [wallet.publicKey, connection]);

  return {
    markets,
    availableTokens,
    loading,
    error,
  };
}

