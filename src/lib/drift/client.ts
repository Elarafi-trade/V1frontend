import { Connection, PublicKey } from '@solana/web3.js';
import { AnchorProvider, Wallet } from '@coral-xyz/anchor';
import { DriftClient, PerpMarketAccount } from '@drift-labs/sdk';
import BN from 'bn.js';

// Drift program ID on devnet
const DRIFT_PROGRAM_ID = new PublicKey('dRiftyHA39MWEi3m9aunc5MzRF1JYuBsbn6VPcn33UH');

// RPC endpoint
export const SOLANA_RPC = process.env.NEXT_PUBLIC_SOLANA_RPC || 'https://api.devnet.solana.com';

export interface DriftClientConfig {
  connection: Connection;
  wallet: Wallet;
  env?: 'devnet' | 'mainnet-beta';
}

/**
 * Initialize Drift client for trading
 * @param skipSubscribe - Skip subscription for faster initialization (use when you'll subscribe manually)
 */
export async function createDriftClient(
  config: DriftClientConfig, 
  skipSubscribe = false
): Promise<DriftClient> {
  const { connection, wallet, env = 'devnet' } = config;

  // Create Anchor provider
  const provider = new AnchorProvider(
    connection,
    wallet,
    { commitment: 'confirmed', preflightCommitment: 'confirmed' }
  );

  // Initialize Drift SDK
  const driftClient = new DriftClient({
    connection,
    wallet: provider.wallet,
    programID: DRIFT_PROGRAM_ID,
    env,
  });

  

  // Subscribe to Drift state (unless explicitly skipped)
  if (!skipSubscribe) {
    await driftClient.subscribe();
  }

  return driftClient;
}

/**
 * Get connection to Solana
 */
export function getSolanaConnection(): Connection {
  return new Connection(SOLANA_RPC, 'confirmed');
}

/**
 * Get all perpetual markets from Drift
 */
export async function getAllPerpMarkets(driftClient: DriftClient): Promise<PerpMarketAccount[]> {
  return driftClient.getPerpMarketAccounts();
}

/**
 * Get specific perpetual market by symbol
 * Decodes market name from byte array
 */
export function getPerpMarketBySymbol(
  driftClient: DriftClient,
  symbol: string
): PerpMarketAccount | undefined {
  const markets = driftClient.getPerpMarketAccounts();
  return markets.find(market => {
    // Decode market name from byte array
    const marketName = Buffer.from(market.name as any).toString('utf8').replace(/\0/g, '');
    return marketName === symbol || marketName === `${symbol}-PERP`;
  });
}

/**
 * Get current market price from Drift oracle
 */
export async function getMarketPrice(
  driftClient: DriftClient,
  marketIndex: number
): Promise<number> {
  const market = driftClient.getPerpMarketAccount(marketIndex);
  if (!market) {
    throw new Error(`Market ${marketIndex} not found`);
  }

  // Get oracle price (in base precision)
  const oracleData = market.amm.historicalOracleData;
  const price = oracleData.lastOraclePrice;
  
  // Convert from BN to number (oracle prices are in 1e6 precision for most tokens)
  const priceNum = price.toNumber() / 1e6;
  
  return priceNum;
}

/**
 * Calculate current ratio between two markets
 */
export async function getCurrentRatio(
  driftClient: DriftClient,
  longMarketIndex: number,
  shortMarketIndex: number
): Promise<number> {
  const longPrice = await getMarketPrice(driftClient, longMarketIndex);
  const shortPrice = await getMarketPrice(driftClient, shortMarketIndex);
  
  return longPrice / shortPrice;
}

/**
 * Convert USDC amount to base asset amount for Drift
 */
export function usdcToBaseAssetAmount(
  usdcAmount: number,
  marketPrice: number
): BN {
  // Calculate how many tokens we can buy with USDC
  const baseAmount = usdcAmount / marketPrice;
  
  // Convert to base precision (usually 1e9 for most tokens on Solana)
  const baseAmountBN = new BN(Math.floor(baseAmount * 1e9));
  
  return baseAmountBN;
}

/**
 * Get funding rate for a market
 */
export function getFundingRate(
  driftClient: DriftClient,
  marketIndex: number
): number {
  const market = driftClient.getPerpMarketAccount(marketIndex);
  if (!market) return 0;
  
  // Funding rate is in basis points (1e-6)
  const fundingRate = market.amm.lastFundingRate.toNumber() / 1e6;
  
  return fundingRate;
}

/**
 * Get 24h volume for a market
 */
export function getMarketVolume24h(
  driftClient: DriftClient,
  marketIndex: number
): number {
  const market = driftClient.getPerpMarketAccount(marketIndex);
  if (!market) return 0;
  
  // Volume in USDC (total fee gives approximate volume)
  const volume24h = market.amm.totalFee.toNumber() / 1e6;
  
  return volume24h;
}

/**
 * Get open interest for a market
 */
export function getMarketOpenInterest(
  driftClient: DriftClient,
  marketIndex: number
): number {
  const market = driftClient.getPerpMarketAccount(marketIndex);
  if (!market) return 0;
  
  // Total long positions (in base asset)
  const openInterestLong = market.amm.baseAssetAmountLong.toNumber() / 1e9;
  
  return openInterestLong;
}

export default {
  createDriftClient,
  getSolanaConnection,
  getAllPerpMarkets,
  getPerpMarketBySymbol,
  getMarketPrice,
  getCurrentRatio,
  usdcToBaseAssetAmount,
  getFundingRate,
  getMarketVolume24h,
  getMarketOpenInterest,
};

