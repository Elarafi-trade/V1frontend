'use client';

import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { useState, useCallback } from 'react';
import { Wallet } from '@coral-xyz/anchor';
import { 
  DriftClient, 
  PositionDirection, 
  OrderType, 
  standardizeBaseAssetAmount,
  getOrderParams,
  MarketType,
} from '@drift-labs/sdk';
import { createDriftClient } from '@/lib/drift/client';
import BN from 'bn.js';
import { LAMPORTS_PER_SOL, Transaction, ComputeBudgetProgram, PublicKey, TransactionInstruction } from '@solana/web3.js';
import { getAllDriftMarkets, findMarketBySymbol } from '@/lib/drift/marketLookup';

const SOL_MARKET_INDEX = 1;

// Minimum order values per market (in USD) - Based on actual Drift Protocol minimums
const MINIMUM_ORDER_VALUES = {
  'SOL': 20,    // ~0.1 SOL minimum
  'BTC': 120,   // 0.001 BTC minimum (~$110 + buffer)
  'ETH': 40,    // ~0.01 ETH minimum
  'DEFAULT': 20
};

export interface OpenPairTradeParams {
  longToken: string;
  shortToken: string;
  capitalUSDC: number;
  leverage: number;
  longWeight?: number;
  shortWeight?: number;
  takeProfitPercent?: number;
  stopLossPercent?: number;
}

export interface OpenPairTradeResult {
  positionId: string;
  longTxSig: string;
  shortTxSig: string;
  entryRatio: number;
}

export const usePairTrading = () => {
  const { connection } = useConnection();
  const wallet = useWallet();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false); // Transaction lock

  const openPairTrade = useCallback(
    async (params: OpenPairTradeParams): Promise<OpenPairTradeResult> => {
      if (!wallet.publicKey || !wallet.signTransaction) {
        throw new Error('Wallet not connected');
      }

      // Prevent double-submission
      if (isProcessing) {
        console.warn('⚠️ Transaction already in progress, ignoring duplicate call');
        throw new Error('Transaction already in progress');
      }

      setIsProcessing(true);
      setLoading(true);
      setError(null);

      try {
        console.log('🚀 Opening pair trade...');

        // Create Drift client
        const anchorWallet = wallet as any as Wallet;
        const driftClient = await createDriftClient({
          connection,
          wallet: anchorWallet,
          env: 'devnet',
        });

        await driftClient.subscribe();
        console.log('✅ Drift client ready');

        // Get markets
        const { marketMap } = await getAllDriftMarkets(driftClient);
        const longSymbol = (params.longToken || '').toUpperCase();
        const shortSymbol = (params.shortToken || '').toUpperCase();
        const longMarket = findMarketBySymbol(marketMap, longSymbol);
        const shortMarket = findMarketBySymbol(marketMap, shortSymbol);

        if (!longMarket || !shortMarket) {
          throw new Error(`Markets not found: ${params.longToken}/${params.shortToken}`);
        }

        // Verify indices exist on-chain and log all available perps
        const allPerps = driftClient.getPerpMarketAccounts();
        const available = allPerps.map(m => ({
          symbol: Buffer.from((m as any).name).toString('utf8').replace(/\0/g, '').trim(),
          marketIndex: m.marketIndex,
        }));
        console.log('🧭 Devnet Perp Markets (symbol → index):');
        console.table(available);
        const idxSet = new Set(allPerps.map(m => m.marketIndex));
        if (!idxSet.has(longMarket.marketIndex) || !idxSet.has(shortMarket.marketIndex)) {
          throw new Error(
            `Resolved market indices not present on devnet. ` +
            `Long ${longSymbol}→${longMarket.marketIndex} present=${idxSet.has(longMarket.marketIndex)}, ` +
            `Short ${shortSymbol}→${shortMarket.marketIndex} present=${idxSet.has(shortMarket.marketIndex)}`
          );
        }

        // Calculate position sizes
        let longWeight = params.longWeight ?? 0.5;
        let shortWeight = params.shortWeight ?? 0.5;
        const weightSum = longWeight + shortWeight;
        if (weightSum <= 0) {
          throw new Error('Invalid weights: longWeight + shortWeight must be > 0');
        }
        // Normalize weights to sum to 1
        longWeight = longWeight / weightSum;
        shortWeight = shortWeight / weightSum;
        
        // Simple calculation: split capital by weights
        const longCapital = params.capitalUSDC * longWeight;
        const shortCapital = params.capitalUSDC * shortWeight;

        console.log(`💰 Capital: $${params.capitalUSDC} → Long: $${longCapital}, Short: $${shortCapital}`);

        // Get current prices
        const longPrice = longMarket.amm.historicalOracleData.lastOraclePrice.toNumber() / 1e6;
        const shortPrice = shortMarket.amm.historicalOracleData.lastOraclePrice.toNumber() / 1e6;
        
        console.log(`📊 Prices: ${params.longToken} = $${longPrice.toFixed(2)}, ${params.shortToken} = $${shortPrice.toFixed(2)}`);

        // Calculate order values WITH leverage
        const longNotionalValue = longCapital * params.leverage;
        const shortNotionalValue = shortCapital * params.leverage;

        console.log(`💵 Order values (${params.leverage}x leverage):`);
        console.log(`   Long: $${longNotionalValue.toFixed(2)}`);
        console.log(`   Short: $${shortNotionalValue.toFixed(2)}`);

        // ⚠️ VALIDATION: Check minimum order sizes BEFORE placing anything
        const minLong = (MINIMUM_ORDER_VALUES as any)[params.longToken] || MINIMUM_ORDER_VALUES.DEFAULT;
        const minShort = (MINIMUM_ORDER_VALUES as any)[params.shortToken] || MINIMUM_ORDER_VALUES.DEFAULT;

        if (longNotionalValue < minLong) {
          const minCapitalNeeded = Math.ceil((minLong / longWeight) / params.leverage);
          throw new Error(
            `❌ ${params.longToken} order too small!\n\n` +
            `Your order: $${longNotionalValue.toFixed(2)}\n` +
            `Minimum: $${minLong} per order\n\n` +
            `${params.longToken === 'BTC' ? '💡 BTC minimum: 0.001 BTC (~$110)\n' : ''}` +
            `${params.longToken === 'ETH' ? '💡 ETH minimum: ~0.01 ETH (~$38)\n' : ''}` +
            `${params.longToken === 'SOL' ? '💡 SOL minimum: ~0.1 SOL (~$19)\n' : ''}` +
            `\n💡 Solutions:\n` +
            `   - Increase capital to at least $${minCapitalNeeded}\n` +
            `   - Or reduce leverage\n` +
            `   - Or use a different token with lower minimums`
          );
        }

        if (shortNotionalValue < minShort) {
          const minCapitalNeeded = Math.ceil((minShort / shortWeight) / params.leverage);
          throw new Error(
            `❌ ${params.shortToken} order too small!\n\n` +
            `Your order: $${shortNotionalValue.toFixed(2)}\n` +
            `Minimum: $${minShort} per order\n\n` +
            `${params.shortToken === 'BTC' ? '💡 BTC minimum: 0.001 BTC (~$110)\n' : ''}` +
            `${params.shortToken === 'ETH' ? '💡 ETH minimum: ~0.01 ETH (~$38)\n' : ''}` +
            `${params.shortToken === 'SOL' ? '💡 SOL minimum: ~0.1 SOL (~$19)\n' : ''}` +
            `\n💡 Solutions:\n` +
            `   - Increase capital to at least $${minCapitalNeeded}\n` +
            `   - Or reduce leverage\n` +
            `   - Or use a different token with lower minimums`
          );
        }

        // Calculate base amounts
        const longAmount = (longNotionalValue / longPrice) * 1e9;
        const shortAmount = (shortNotionalValue / shortPrice) * 1e9;

        // Quantize to step sizes
        const longBaseAmount = standardizeBaseAssetAmount(
          new BN(Math.ceil(longAmount)),
          longMarket.amm.orderStepSize
        );
        const shortBaseAmount = standardizeBaseAssetAmount(
          new BN(Math.ceil(shortAmount)),
          shortMarket.amm.orderStepSize
        );

        // Compute per-leg minimum base chunk from USD minimums
        const longMinUsd = minLong;
        const shortMinUsd = minShort;
        const longMinBaseFromUsd = standardizeBaseAssetAmount(
          new BN(Math.ceil((longMinUsd / longPrice) * 1e9)),
          longMarket.amm.orderStepSize
        );
        const shortMinBaseFromUsd = standardizeBaseAssetAmount(
          new BN(Math.ceil((shortMinUsd / shortPrice) * 1e9)),
          shortMarket.amm.orderStepSize
        );

        const longQty = longBaseAmount.toNumber() / 1e9;
        const shortQty = shortBaseAmount.toNumber() / 1e9;

        console.log(`📦 Final order quantities:`);
        console.log(`   Long: ${longQty.toFixed(6)} ${params.longToken}`);
        console.log(`   Short: ${shortQty.toFixed(6)} ${params.shortToken}`);

        // Ensure user has Drift account with sufficient collateral
        let userExists = false;
        try {
          const userAccount = driftClient.getUser();
          userExists = true;
        } catch {
          userExists = false;
        }

        // Calculate total collateral needed for BOTH legs (estimate IMR + fees buffer)
        const notionalSum = longNotionalValue + shortNotionalValue;
        const ESTIMATED_IMR = 0.12; // approx initial margin rate per leg on devnet
        const FEES_BUFFER = 0.01;   // trading fees/slippage buffer
        const requiredByImr = notionalSum * (ESTIMATED_IMR + FEES_BUFFER);
        // Use the higher of user's base capital or IMR estimate, add LARGER overhead
        // 1.20 = 20% buffer to account for:
        // - Both legs' margin locked simultaneously
        // - Price slippage during execution
        // - Funding rate changes
        const collateralNeeded = Math.max(params.capitalUSDC, requiredByImr) * 1.20;
        
        if (!userExists) {
          console.log('🆕 Initializing Drift account with collateral...');
          
          const solPrice = driftClient.getOracleDataForSpotMarket(SOL_MARKET_INDEX).price.toNumber() / 1e6;
          
          // Account for SOL collateral weight on Drift devnet
          // ACTUAL observed: ~28-30% (much lower than expected!)
          const SOL_COLLATERAL_WEIGHT = 0.29; // Observed from real deposits
          const SAFETY_MULTIPLIER = 1.5; // 50% extra buffer
          
          const solToDeposit = (collateralNeeded / SOL_COLLATERAL_WEIGHT) * SAFETY_MULTIPLIER / solPrice;
          const depositAmount = new BN(Math.ceil(solToDeposit * LAMPORTS_PER_SOL));

          console.log(`💸 Depositing ${(depositAmount.toNumber() / LAMPORTS_PER_SOL).toFixed(4)} SOL ($${collateralNeeded.toFixed(2)} est.)`);
          console.log(`   Accounting for SOL collateral weight (${SOL_COLLATERAL_WEIGHT}) + ${((SAFETY_MULTIPLIER - 1) * 100).toFixed(0)}% safety buffer`);

          await driftClient.initializeUserAccountAndDepositCollateral(
            depositAmount,
            wallet.publicKey,
            SOL_MARKET_INDEX,
            0,
            'default'
          );

          await new Promise(resolve => setTimeout(resolve, 3000));
          console.log('✅ Account initialized');
        } else {
          // Check if we need more collateral
          const user = driftClient.getUser();
          const totalCollateral = user.getTotalCollateral().toNumber() / 1e6;
          const freeCollateral = user.getFreeCollateral().toNumber() / 1e6;
          const usedMargin = totalCollateral - freeCollateral;
          
          console.log(`💰 Total collateral: $${totalCollateral.toFixed(2)}`);
          console.log(`💰 Used margin: $${usedMargin.toFixed(2)} (from existing positions)`);
          console.log(`💰 Free collateral: $${freeCollateral.toFixed(2)}`);
          console.log(`💰 Needed for this trade (est.): $${collateralNeeded.toFixed(2)}`);

          if (freeCollateral < collateralNeeded) {
            const shortfall = collateralNeeded - freeCollateral;
            const solPrice = driftClient.getOracleDataForSpotMarket(SOL_MARKET_INDEX).price.toNumber() / 1e6;
            
            // Account for SOL collateral weight on Drift devnet
            // ACTUAL observed: ~28-30% (much lower than expected!)
            const SOL_COLLATERAL_WEIGHT = 0.29; // Observed from real deposits
            const SAFETY_MULTIPLIER = 1.5; // 50% extra buffer
            
            const solNeeded = (shortfall / SOL_COLLATERAL_WEIGHT) * SAFETY_MULTIPLIER / solPrice;
            const depositAmount = new BN(Math.ceil(solNeeded * LAMPORTS_PER_SOL));

            console.log(`💸 Depositing ${(depositAmount.toNumber() / LAMPORTS_PER_SOL).toFixed(4)} SOL to cover shortfall...`);
            console.log(`   Shortfall: $${shortfall.toFixed(2)}, SOL price: $${solPrice.toFixed(2)}`);
            console.log(`   Accounting for SOL collateral weight (${SOL_COLLATERAL_WEIGHT}) + ${((SAFETY_MULTIPLIER - 1) * 100).toFixed(0)}% safety buffer`);

            await driftClient.deposit(
              depositAmount,
              SOL_MARKET_INDEX,
              wallet.publicKey
            );

            await new Promise(resolve => setTimeout(resolve, 2000));
            console.log('✅ Collateral topped up');
            
            // Double-check we actually have enough now
            const newFreeCollateral = driftClient.getUser().getFreeCollateral().toNumber() / 1e6;
            const newTotalCollateral = driftClient.getUser().getTotalCollateral().toNumber() / 1e6;
            console.log(`💰 New total collateral: $${newTotalCollateral.toFixed(2)}`);
            console.log(`💰 New free collateral: $${newFreeCollateral.toFixed(2)}`);
            
            // With SOL collateral weight, we need at least 90% of target
            if (newFreeCollateral < collateralNeeded * 0.9) {
              throw new Error(
                `Still insufficient collateral after deposit.\n` +
                `Have: $${newFreeCollateral.toFixed(2)}, Need: $${collateralNeeded.toFixed(2)}\n` +
                `This might be due to:\n` +
                `1. Existing open positions consuming margin\n` +
                `2. SOL collateral weight on Drift Protocol\n` +
                `3. Not enough SOL in wallet\n\n` +
                `Try: Close existing positions or add more SOL to your wallet`
              );
            }
          } else {
            console.log('✅ Sufficient collateral available');
          }
        }

        // Combined transaction: Both LONG and SHORT in ONE signature
        console.log('\n🎯 Creating COMBINED transaction for LONG + SHORT...');

        // Convert amounts to perp precision
        const longBaseAssetAmountBN = driftClient.convertToPerpPrecision(longQty);
        const shortBaseAssetAmountBN = driftClient.convertToPerpPrecision(shortQty);

        console.log(`   LONG: ${longQty.toFixed(4)} ${params.longToken} (${longBaseAssetAmountBN.toString()} base units)`);
        console.log(`   SHORT: ${shortQty.toFixed(4)} ${params.shortToken} (${shortBaseAssetAmountBN.toString()} base units)`);

        // Get order params for both legs
        const longOrderParams = getOrderParams({
          orderType: OrderType.MARKET,
          marketType: MarketType.PERP,
          marketIndex: longMarket.marketIndex,
          direction: PositionDirection.LONG,
          baseAssetAmount: longBaseAssetAmountBN,
          reduceOnly: false,
        });

        const shortOrderParams = getOrderParams({
          orderType: OrderType.MARKET,
          marketType: MarketType.PERP,
          marketIndex: shortMarket.marketIndex,
          direction: PositionDirection.SHORT,
          baseAssetAmount: shortBaseAssetAmountBN,
          reduceOnly: false,
        });

        // Get instructions for both orders
        const longOrderIx = await driftClient.getPlacePerpOrderIx(longOrderParams);
        const shortOrderIx = await driftClient.getPlacePerpOrderIx(shortOrderParams);

        // Create single transaction with both instructions
        const transaction = new Transaction();
        
        // Add compute budget for complex transaction
        const computeUnits = 400_000; // Increased for two orders
        const computeBudgetIx = ComputeBudgetProgram.setComputeUnitLimit({
          units: computeUnits,
        });
        transaction.add(computeBudgetIx);
        
        // Add both order instructions
        transaction.add(longOrderIx);
        transaction.add(shortOrderIx);

        console.log('📝 Transaction created with 2 order instructions');
        console.log('✍️  Requesting signature and sending...');

        // Use wallet adapter's sendTransaction (handles signing + sending in one step)
        // This prevents double-submission issues
        let txSig: string;
        try {
          if (wallet.sendTransaction) {
            // Modern wallet adapter - use sendTransaction
            txSig = await wallet.sendTransaction(transaction, connection, {
              skipPreflight: true, // Skip simulation to avoid "already processed" errors
              preflightCommitment: 'confirmed',
              maxRetries: 3,
            });
          } else {
            // Fallback: manual sign and send
            const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
            transaction.recentBlockhash = blockhash;
            transaction.feePayer = wallet.publicKey;
            
            const signedTx = await wallet.signTransaction!(transaction);
            
            txSig = await connection.sendRawTransaction(signedTx.serialize(), {
              skipPreflight: true, // Skip preflight to avoid double submission
              maxRetries: 0, // Don't retry on this level
            });
            
            // Confirm manually
            await connection.confirmTransaction({
              signature: txSig,
              blockhash,
              lastValidBlockHeight,
            }, 'confirmed');
          }
        } catch (err: any) {
          // Better error handling for common issues
          if (err.message?.includes('already been processed')) {
            console.warn('⚠️ Transaction already processed, this might be a duplicate submission');
            throw new Error('Transaction already submitted. Please wait a moment and check your positions.');
          }
          throw err;
        }

        console.log(`✅ Combined transaction sent: ${txSig}`);
        console.log('⏳ Waiting for confirmation...');

        // Ensure transaction is confirmed
        await connection.confirmTransaction(txSig, 'confirmed');

        console.log('✅ Transaction confirmed! Both orders placed in single signature');
        
        const longTxSig = txSig; // Same signature for both
        const shortTxSig = txSig; // Same signature for both

        // Wait for orders to fill and settle on-chain (devnet can be VERY slow)
        console.log('\n⏳ Waiting 10s for orders to fill and settle on devnet...');
        await new Promise(r => setTimeout(r, 10000)); // 10 seconds for slow devnet keepers
        
        await driftClient.getUser().fetchAccounts();
        const finalLongFilled = driftClient.getUser().getUserAccount().perpPositions.find(p => p.marketIndex === longMarket.marketIndex)?.baseAssetAmount.abs() || new BN(0);
        const finalShortFilled = driftClient.getUser().getUserAccount().perpPositions.find(p => p.marketIndex === shortMarket.marketIndex)?.baseAssetAmount.abs() || new BN(0);
        
        console.log(`📊 Fill status:`);
        console.log(`   LONG filled: ${(finalLongFilled.toNumber() / 1e9).toFixed(6)} (expected: ${(longBaseAmount.toNumber() / 1e9).toFixed(6)})`);
        console.log(`   SHORT filled: ${(finalShortFilled.toNumber() / 1e9).toFixed(6)} (expected: ${(shortBaseAmount.toNumber() / 1e9).toFixed(6)})`);

        // Check fill percentages
        const longFillPct = (finalLongFilled.toNumber() / longBaseAmount.toNumber()) * 100;
        const shortFillPct = (finalShortFilled.toNumber() / shortBaseAmount.toNumber()) * 100;
        const MIN_FILL_PCT = 90; // Require at least 90% fill for complete position

        console.log(`📊 Fill percentages:`);
        console.log(`   LONG: ${longFillPct.toFixed(1)}%`);
        console.log(`   SHORT: ${shortFillPct.toFixed(1)}%`);

        // Determine position status based on fills
        let positionStatus: 'OPEN' | 'PARTIAL' = 'OPEN';
        let partialLeg: 'LONG' | 'SHORT' | null = null;

        if (longFillPct < MIN_FILL_PCT && shortFillPct >= MIN_FILL_PCT) {
          positionStatus = 'PARTIAL';
          partialLeg = 'LONG';
          console.warn(`⏳ Partial fill: SHORT leg filled, LONG leg pending (${longFillPct.toFixed(1)}%)`);
        } else if (shortFillPct < MIN_FILL_PCT && longFillPct >= MIN_FILL_PCT) {
          positionStatus = 'PARTIAL';
          partialLeg = 'SHORT';
          console.warn(`⏳ Partial fill: LONG leg filled, SHORT leg pending (${shortFillPct.toFixed(1)}%)`);
        } else if (longFillPct < MIN_FILL_PCT && shortFillPct < MIN_FILL_PCT) {
          // Both legs failed - reject trade
          const errorMsg = `⚠️ Both legs failed to fill! LONG: ${longFillPct.toFixed(1)}%, SHORT: ${shortFillPct.toFixed(1)}%. Trade rejected.`;
          console.error(errorMsg);
          setLoading(false);
          throw new Error(errorMsg + '\n\nTry again with smaller size or better market conditions.');
        }

        const entryRatio = longPrice / shortPrice;
        const positionId = `${params.longToken}-${params.shortToken}-${Date.now()}`;

        // Save to database based on fill status
        if (positionStatus === 'PARTIAL') {
          console.log(`\n💾 Saving PARTIAL position to database (${partialLeg} leg pending)...`);
          console.log(`   This will appear in "Open Orders" tab`);
          console.log(`   User can cancel or wait for remaining leg to fill`);
        } else {
          console.log(`\n💾 Saving COMPLETE position to database (both legs filled)...`);
        }

        // use batch tx signature for both legs

        const saveResponse = await fetch('/api/pair/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            walletAddress: wallet.publicKey.toString(),
            longMarketIndex: longMarket.marketIndex,
            longMarketSymbol: params.longToken,
            shortMarketIndex: shortMarket.marketIndex,
            shortMarketSymbol: params.shortToken,
            capitalUSDC: params.capitalUSDC,
            leverage: params.leverage,
            longWeight,
            shortWeight,
            entryRatio,
            entryLongPrice: longPrice,
            entryShortPrice: shortPrice,
            takeProfitPercent: params.takeProfitPercent || null,
            stopLossPercent: params.stopLossPercent || null,
            longTxSignature: longTxSig,
            shortTxSignature: shortTxSig,
            status: positionStatus, // 'OPEN' or 'PARTIAL'
            partialLeg: partialLeg, // 'LONG', 'SHORT', or null
            longFillPercent: longFillPct,
            shortFillPercent: shortFillPct,
          }),
        });

        const saveData = await saveResponse.json();
        console.log(`\n🎉 Pair trade submitted: ${params.longToken}/${params.shortToken}`);

        // Fetch complete position data with calculated metrics (margin, liquidation, health)
        // This ensures immediate display of P&L and liquidation price
        console.log('📊 Fetching live position data with calculated metrics...');
        const liveDataRes = await fetch(`/api/positions/live-pnl?wallet=${wallet.publicKey.toString()}`);
        let completePositionData = null;
        
        if (liveDataRes.ok) {
          const liveData = await liveDataRes.json();
          // Find the position we just created
          completePositionData = liveData.positions?.find(
            (p: any) => p.id === (saveData.position?.id || positionId)
          );
          console.log('✅ Got complete position data:', completePositionData ? 'YES' : 'NO');
        }

        // Emit event for immediate UI update with COMPLETE data
        const { positionEvents } = await import('@/lib/events/positionEvents');
        positionEvents.emit(completePositionData || {
          id: saveData.position?.id || positionId,
          longMarketSymbol: params.longToken,
          shortMarketSymbol: params.shortToken,
          longMarketIndex: longMarket.marketIndex,
          shortMarketIndex: shortMarket.marketIndex,
          entryRatio,
          entryLongPrice: longPrice,
          entryShortPrice: shortPrice,
          capitalUSDC: params.capitalUSDC,
          leverage: params.leverage,
          longWeight,
          shortWeight,
          takeProfitPercent: params.takeProfitPercent || null,
          stopLossPercent: params.stopLossPercent || null,
          status: positionStatus, // Use actual status (OPEN or PARTIAL)
          partialLeg: partialLeg,
          entryTimestamp: new Date().toISOString(),
          currentLongPrice: longPrice,
          currentShortPrice: shortPrice,
          currentRatio: entryRatio,
          unrealizedPnL: 0,
          unrealizedPnLPercent: 0,
        });

        setLoading(false);
        return {
          positionId: saveData.position?.id || positionId,
          longTxSig,
          shortTxSig,
          entryRatio,
        };

      } catch (err: any) {
        console.error('❌ Error:', err);
        setError(err.message || 'Failed to open position');
        setLoading(false);
        setIsProcessing(false); // Release lock on error
        throw err;
      } finally {
        setIsProcessing(false); // Always release lock
      }
    },
    [connection, wallet, isProcessing]
  );

  const closePairTrade = useCallback(
    async (positionId: string): Promise<{ closeTxSig: string; realizedPnl: number }> => {
      if (!wallet.publicKey || !wallet.signTransaction) {
        throw new Error('Wallet not connected');
      }

      setLoading(true);
      setError(null);

      try {
        console.log(`🔴 Closing position ${positionId}...`);

        // Fetch position
        const res = await fetch(`/api/positions/${positionId}`);
        if (!res.ok) throw new Error('Position not found');
        
        const data = await res.json();
        const position = data.position || data;

        // Create Drift client
        const anchorWallet = wallet as any as Wallet;
        const driftClient = await createDriftClient({
          connection,
          wallet: anchorWallet,
          env: 'devnet',
        });

        await driftClient.subscribe();
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Get markets
        const { marketMap } = await getAllDriftMarkets(driftClient);
        const longMarket = findMarketBySymbol(marketMap, position.longMarketSymbol);
        const shortMarket = findMarketBySymbol(marketMap, position.shortMarketSymbol);

        if (!longMarket || !shortMarket) {
          throw new Error('Markets not found');
        }

        // Get positions
        await driftClient.getUser().fetchAccounts();
        const perpPositions = driftClient.getUser().getUserAccount().perpPositions;

        const longPos = perpPositions.find(p => p.marketIndex === longMarket.marketIndex && !p.baseAssetAmount.isZero());
        const shortPos = perpPositions.find(p => p.marketIndex === shortMarket.marketIndex && !p.baseAssetAmount.isZero());

        if (!longPos && !shortPos) {
          throw new Error('No positions found');
        }

        // Get current prices
        const currentLongPrice = longMarket.amm.historicalOracleData.lastOraclePrice.toNumber() / 1e6;
        const currentShortPrice = shortMarket.amm.historicalOracleData.lastOraclePrice.toNumber() / 1e6;
        const currentRatio = currentLongPrice / currentShortPrice;

        console.log(`📊 Entry: ${position.entryRatio.toFixed(6)}, Current: ${currentRatio.toFixed(6)}`);

        // Close both positions in ONE transaction
        console.log('🔴 Creating COMBINED close transaction for both legs...');
        
        const transaction = new Transaction();
        
        // Add compute budget
        const computeUnits = 400_000;
        const computeBudgetIx = ComputeBudgetProgram.setComputeUnitLimit({
          units: computeUnits,
        });
        transaction.add(computeBudgetIx);

        // Add close instructions for both legs
        if (longPos) {
          console.log(`   Closing LONG: ${(longPos.baseAssetAmount.abs().toNumber() / 1e9).toFixed(6)} ${position.longMarketSymbol}`);
          const closeLongIx = await driftClient.getPlacePerpOrderIx({
            orderType: OrderType.MARKET,
            marketIndex: longMarket.marketIndex,
            direction: PositionDirection.SHORT,
            baseAssetAmount: longPos.baseAssetAmount.abs(),
            reduceOnly: true,
          });
          transaction.add(closeLongIx);
        }

        if (shortPos) {
          console.log(`   Closing SHORT: ${(shortPos.baseAssetAmount.abs().toNumber() / 1e9).toFixed(6)} ${position.shortMarketSymbol}`);
          const closeShortIx = await driftClient.getPlacePerpOrderIx({
            orderType: OrderType.MARKET,
            marketIndex: shortMarket.marketIndex,
            direction: PositionDirection.LONG,
            baseAssetAmount: shortPos.baseAssetAmount.abs(),
            reduceOnly: true,
          });
          transaction.add(closeShortIx);
        }

        console.log('✍️  Requesting signature for combined close...');

        // Send combined transaction
        let closeTxSig: string;
        try {
          if (wallet.sendTransaction) {
            closeTxSig = await wallet.sendTransaction(transaction, connection, {
              skipPreflight: true,
              preflightCommitment: 'confirmed',
              maxRetries: 3,
            });
          } else {
            const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
            transaction.recentBlockhash = blockhash;
            transaction.feePayer = wallet.publicKey;
            
            const signedTx = await wallet.signTransaction!(transaction);
            closeTxSig = await connection.sendRawTransaction(signedTx.serialize(), {
              skipPreflight: true,
              maxRetries: 0,
            });
            
            await connection.confirmTransaction({
              signature: closeTxSig,
              blockhash,
              lastValidBlockHeight,
            }, 'confirmed');
          }
        } catch (err: any) {
          if (err.message?.includes('already been processed')) {
            throw new Error('Close transaction already submitted. Please wait a moment.');
          }
          throw err;
        }

        console.log(`✅ Combined close transaction sent: ${closeTxSig}`);
        await connection.confirmTransaction(closeTxSig, 'confirmed');
        console.log('✅ Both positions closed in single signature!');

        // Calculate P&L
        const ratioChange = (currentRatio - position.entryRatio) / position.entryRatio;
        const estimatedPnl = position.capitalUSDC * position.leverage * ratioChange;

        console.log(`💰 P&L: ${estimatedPnl >= 0 ? '+' : ''}$${estimatedPnl.toFixed(2)} (${(ratioChange * 100).toFixed(2)}%)`);

        // Update database
        await fetch('/api/pair/close-update', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            positionId,
            closeTxSig,
            realizedPnl: estimatedPnl,
            exitRatio: currentRatio,
          }),
        });

        setLoading(false);
        return { closeTxSig, realizedPnl: estimatedPnl };

      } catch (err: any) {
        console.error('❌ Error closing:', err);
        setError(err.message || 'Failed to close position');
        setLoading(false);
        throw err;
      }
    },
    [connection, wallet]
  );

  const cancelPartialPosition = useCallback(
    async (positionId: string): Promise<void> => {
      if (!wallet.publicKey || !wallet.signTransaction) {
        throw new Error('Wallet not connected');
      }

      setLoading(true);
      setError(null);

      try {
        console.log('🗑️ Canceling partial position:', positionId);

        // Fetch position details from database
        const posRes = await fetch(`/api/positions/${positionId}`);
        if (!posRes.ok) {
          throw new Error('Failed to fetch position details');
        }
        const position = await posRes.json();

        if (position.status !== 'PARTIAL' || !position.partialLeg) {
          throw new Error('Position is not a partial fill');
        }

        // Create Drift client
        const anchorWallet = wallet as any as Wallet;
        const driftClient = await createDriftClient({
          connection,
          wallet: anchorWallet,
          env: 'devnet',
        });

        await driftClient.subscribe();

        // Get markets
        const { marketMap } = await getAllDriftMarkets(driftClient);
        const longMarket = findMarketBySymbol(marketMap, position.longMarketSymbol);
        const shortMarket = findMarketBySymbol(marketMap, position.shortMarketSymbol);

        if (!longMarket || !shortMarket) {
          throw new Error('Markets not found');
        }

        const isPendingLong = position.partialLeg === 'LONG';
        const pendingMarketIndex = isPendingLong ? longMarket.marketIndex : shortMarket.marketIndex;
        const filledMarketIndex = isPendingLong ? shortMarket.marketIndex : longMarket.marketIndex;

        console.log(`📋 Pending leg: ${position.partialLeg}, Market: ${pendingMarketIndex}`);

        // Step 1: Cancel unfilled orders for pending market
        try {
          await driftClient.cancelOrders(
            MarketType.PERP,
            pendingMarketIndex
          );
          console.log(`✅ Canceled orders for market ${pendingMarketIndex}`);
        } catch (error: any) {
          console.warn(`⚠️ Could not cancel orders (may already be filled/canceled): ${error.message}`);
        }

        // Step 2: Close the filled leg
        try {
          const perpPositions = driftClient.getUser().getUserAccount().perpPositions;
          const filledPos = perpPositions.find(p => p.marketIndex === filledMarketIndex && !p.baseAssetAmount.isZero());
          
          if (filledPos) {
            const closeDirection = filledPos.baseAssetAmount.gt(new BN(0)) 
              ? PositionDirection.SHORT 
              : PositionDirection.LONG;
            
            const closeTx = await driftClient.placePerpOrder({
              orderType: OrderType.MARKET,
              marketIndex: filledMarketIndex,
              direction: closeDirection,
              baseAssetAmount: filledPos.baseAssetAmount.abs(),
              reduceOnly: true,
            });
            
            console.log(`✅ Closed filled leg at market ${filledMarketIndex}: ${closeTx}`);
          } else {
            console.warn(`⚠️ No position found to close for market ${filledMarketIndex}`);
          }
        } catch (error: any) {
          console.warn(`⚠️ Could not close filled leg: ${error.message}`);
        }

        // Step 3: Update database via API
        const cancelRes = await fetch('/api/orders/cancel', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            positionId,
            walletAddress: wallet.publicKey.toString(),
            cancelAll: false,
          }),
        });

        if (!cancelRes.ok) {
          const errorData = await cancelRes.json();
          throw new Error(errorData.error || 'Failed to update database');
        }

        console.log('✅ Partial position canceled successfully');
        setLoading(false);

        await driftClient.unsubscribe();

      } catch (err: any) {
        console.error('❌ Error canceling partial position:', err);
        setError(err.message || 'Failed to cancel partial position');
        setLoading(false);
        throw err;
      }
    },
    [connection, wallet]
  );

  return {
    openPairTrade,
    closePairTrade,
    cancelPartialPosition,
    loading,
    error,
    isProcessing, // Expose processing state for UI
  };
};
