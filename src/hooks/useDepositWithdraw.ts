'use client';

import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { useState, useCallback } from 'react';
import { createDriftClient } from '@/lib/drift/client';
import BN from 'bn.js';
import { LAMPORTS_PER_SOL } from '@solana/web3.js';

const SOL_MARKET_INDEX = 1;
// ACTUAL observed weight on Drift devnet: ~28-30% (not 75%!)
// This is likely the "asset weight" for SOL spot deposits
const SOL_COLLATERAL_WEIGHT = 0.29; // Drift applies ~71% haircut on SOL (devnet)

export const useDepositWithdraw = () => {
  const { connection } = useConnection();
  const wallet = useWallet();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const deposit = useCallback(
    async (amountSOL: number): Promise<string> => {
      if (!wallet.publicKey || !wallet.signTransaction) {
        throw new Error('Wallet not connected');
      }

      setLoading(true);
      setError(null);

      try {
        const anchorWallet = wallet as any;
        // Skip initial subscribe, we'll do it once below
        const driftClient = await createDriftClient({
          connection,
          wallet: anchorWallet,
          env: 'devnet',
        }, true);

        // Subscribe once for all operations  
        await driftClient.subscribe();

        // Check SOL balance
        const solBalance = await connection.getBalance(wallet.publicKey);
        const solBalanceInSol = solBalance / LAMPORTS_PER_SOL;
        
        console.log(`💰 Wallet SOL balance: ${solBalanceInSol.toFixed(4)} SOL`);
        
        if (solBalanceInSol < amountSOL + 0.05) {
          throw new Error(
            `Insufficient SOL balance!\n\n` +
            `You have: ${solBalanceInSol.toFixed(4)} SOL\n` +
            `Need: ${(amountSOL + 0.05).toFixed(4)} SOL (${amountSOL} + 0.05 for fees)\n\n` +
            `Get more SOL: solana airdrop 1 --url devnet`
          );
        }

        const depositAmount = new BN(Math.floor(amountSOL * LAMPORTS_PER_SOL));
        
        // Get SOL price for logging
        const solOracle = driftClient.getOracleDataForSpotMarket(SOL_MARKET_INDEX);
        const solPrice = solOracle.price.toNumber() / 1e6;
        const marketValue = amountSOL * solPrice;
        const estimatedCollateral = marketValue * SOL_COLLATERAL_WEIGHT;
        
        console.log(`\n💸 Depositing ${amountSOL} SOL to Drift...`);
        console.log(`   Market value: $${marketValue.toFixed(2)} (@ $${solPrice.toFixed(2)}/SOL)`);
        console.log(`   Expected collateral: $${estimatedCollateral.toFixed(2)} (~${(SOL_COLLATERAL_WEIGHT * 100).toFixed(0)}% weight on devnet)`);

        // Check if user has Drift account
        try {
          const user = driftClient.getUser();
          
          // Log current state BEFORE deposit
          const totalCollatBefore = user.getTotalCollateral().toNumber() / 1e6;
          const freeCollatBefore = user.getFreeCollateral().toNumber() / 1e6;
          const usedMarginBefore = totalCollatBefore - freeCollatBefore;
          
          console.log(`\n📊 BEFORE deposit:`);
          console.log(`   Total collateral: $${totalCollatBefore.toFixed(2)}`);
          console.log(`   Used margin: $${usedMarginBefore.toFixed(2)} (from existing positions)`);
          console.log(`   Free collateral: $${freeCollatBefore.toFixed(2)}`);
          
          // Account exists, just deposit
          const txSig = await driftClient.deposit(
            depositAmount,
            SOL_MARKET_INDEX,
            wallet.publicKey,
            0
          );
          
          // Wait for transaction to settle
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          // Log state AFTER deposit
          const totalCollatAfter = user.getTotalCollateral().toNumber() / 1e6;
          const freeCollatAfter = user.getFreeCollateral().toNumber() / 1e6;
          const usedMarginAfter = totalCollatAfter - freeCollatAfter;
          const actualIncrease = totalCollatAfter - totalCollatBefore;
          
          console.log(`\n📊 AFTER deposit:`);
          console.log(`   Total collateral: $${totalCollatAfter.toFixed(2)} (+$${actualIncrease.toFixed(2)})`);
          console.log(`   Used margin: $${usedMarginAfter.toFixed(2)}`);
          console.log(`   Free collateral: $${freeCollatAfter.toFixed(2)}`);
          console.log(`\n✅ Deposit successful: ${txSig}`);
          
          setLoading(false);
          return txSig;
        } catch (err) {
          // No account, initialize with deposit
          console.log('🚀 Initializing Drift account with deposit...');
          
          const [txSig] = await driftClient.initializeUserAccountAndDepositCollateral(
            depositAmount,
            wallet.publicKey,
            SOL_MARKET_INDEX,
            0,
            'default'
          );
          
          // Wait for transaction to settle
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          const user = driftClient.getUser();
          const totalCollatAfter = user.getTotalCollateral().toNumber() / 1e6;
          const freeCollatAfter = user.getFreeCollateral().toNumber() / 1e6;
          
          console.log(`\n📊 AFTER initialization:`);
          console.log(`   Total collateral: $${totalCollatAfter.toFixed(2)}`);
          console.log(`   Free collateral: $${freeCollatAfter.toFixed(2)}`);
          console.log(`\n✅ Account initialized with deposit: ${txSig}`);
          
          setLoading(false);
          return txSig;
        }
      } catch (err: any) {
        console.error('Deposit failed:', err);
        const errorMsg = err.message || 'Failed to deposit';
        setError(errorMsg);
        setLoading(false);
        throw err;
      }
    },
    [connection, wallet]
  );

  const withdraw = useCallback(
    async (amountSOL: number): Promise<string> => {
      if (!wallet.publicKey || !wallet.signTransaction) {
        throw new Error('Wallet not connected');
      }

      setLoading(true);
      setError(null);

      try {
        const anchorWallet = wallet as any;
        // Skip initial subscribe, we'll do it once below
        const driftClient = await createDriftClient({
          connection,
          wallet: anchorWallet,
          env: 'devnet',
        }, true);

        // Subscribe once for all operations
        await driftClient.subscribe();

        // Check user has account
        const userAccount = driftClient.getUser();
        const freeCollateral = userAccount.getFreeCollateral();
        const freeCollateralUSD = freeCollateral.toNumber() / 1e6;
        
        // Get SOL price to convert USD → SOL
        const solOracle = driftClient.getOracleDataForSpotMarket(SOL_MARKET_INDEX);
        const solPrice = solOracle.price.toNumber() / 1e6;
        
        const withdrawValueUSD = amountSOL * solPrice;
        
        console.log(`💰 Free collateral: $${freeCollateralUSD.toFixed(2)}`);
        console.log(`📊 Withdraw amount: ${amountSOL} SOL (~$${withdrawValueUSD.toFixed(2)})`);
        
        if (withdrawValueUSD > freeCollateralUSD) {
          throw new Error(
            `Insufficient free collateral!\n\n` +
            `Free: $${freeCollateralUSD.toFixed(2)}\n` +
            `Want to withdraw: $${withdrawValueUSD.toFixed(2)}\n\n` +
            `Close some positions first or withdraw less.`
          );
        }

        const withdrawAmount = new BN(Math.floor(amountSOL * LAMPORTS_PER_SOL));
        
        console.log(`💸 Withdrawing ${amountSOL} SOL from Drift...`);

        const txSig = await driftClient.withdraw(
          withdrawAmount,
          SOL_MARKET_INDEX,
          wallet.publicKey
        );
        
        console.log('✅ Withdrawal successful:', txSig);
        setLoading(false);
        return txSig;
      } catch (err: any) {
        console.error('Withdrawal failed:', err);
        const errorMsg = err.message || 'Failed to withdraw';
        setError(errorMsg);
        setLoading(false);
        throw err;
      }
    },
    [connection, wallet]
  );

  return {
    deposit,
    withdraw,
    loading,
    error,
  };
};

