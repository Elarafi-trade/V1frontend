/**
 * Liquidation and margin calculation utilities for Drift Protocol positions
 * 
 * IMPORTANT: These calculations align with Drift Protocol's actual liquidation logic
 * References:
 * - https://drift-labs.github.io/v2-teacher/
 * - https://docs.drift.trade/liquidations/liquidations
 */

import { Position } from '@prisma/client';
import type { DriftClient, PerpMarketAccount } from '@drift-labs/sdk';

// Drift Protocol constants (from official docs)
const QUOTE_PRECISION = 1e6;  // USDC has 6 decimals
const PRICE_PRECISION = 1e6;

/**
 * Calculate ACTUAL margin requirement using Drift Protocol's formula
 * 
 * For pair positions, we need to calculate margin for BOTH legs:
 * Margin = Sum of (baseAmount * oraclePrice * marginRatio) for each leg
 * 
 * @param position - Position data from database
 * @param longMarket - Drift perp market for long leg (optional, for accurate calc)
 * @param shortMarket - Drift perp market for short leg (optional, for accurate calc)
 * @returns Initial margin requirement in USDC
 */
export function calculateMargin(
  capitalUSDC: number,
  leverage: number,
  longMarket?: PerpMarketAccount,
  shortMarket?: PerpMarketAccount
): number {
  // If market data available, use actual margin ratios
  if (longMarket && shortMarket) {
    // Get initial margin ratios from markets (in basis points, e.g., 500 = 5%)
    const longIMR = longMarket.marginRatioInitial / 10000;  // Convert from basis points
    const shortIMR = shortMarket.marginRatioInitial / 10000;
    
    // For pair position, margin is calculated per leg
    // Total margin = (longNotional * longIMR) + (shortNotional * shortIMR)
    // Since we use equal weights by default (0.5/0.5):
    const avgIMR = (longIMR + shortIMR) / 2;
    const totalNotional = capitalUSDC * leverage;
    
    return totalNotional * avgIMR;
  }
  
  // Fallback: Estimate based on typical Drift margins
  // Devnet typical IMR: ~10-12% for most markets
  const ESTIMATED_IMR = 0.11; // 11% average initial margin
  const totalNotional = capitalUSDC * leverage;
  
  return totalNotional * ESTIMATED_IMR;
}

/**
 * Calculate liquidation price for a PAIR position using Drift's maintenance margin
 * 
 * Drift liquidation formula:
 * Health = 100% - (MaintenanceMargin / TotalCollateral)
 * Liquidation occurs when Health reaches 0% (or TotalCollateral <= MaintenanceMargin)
 * 
 * For pair positions:
 * - We profit when ratio increases (long outperforms short)
 * - We lose when ratio decreases
 * - Liquidation when: Capital + UnrealizedPnL <= MaintenanceMargin
 * 
 * @param position - Position data
 * @param longMarket - Optional: Actual long market for precise MMR
 * @param shortMarket - Optional: Actual short market for precise MMR
 * @returns The ratio at which position would be liquidated
 */
export function calculateLiquidationPrice(
  position: { 
    entryRatio: number;
    capitalUSDC: number;
    leverage: number;
    longWeight?: number;
    shortWeight?: number;
  },
  longMarket?: PerpMarketAccount,
  shortMarket?: PerpMarketAccount
): number {
  const { entryRatio, capitalUSDC, leverage } = position;
  const longWeight = position.longWeight || 0.5;
  const shortWeight = position.shortWeight || 0.5;
  
  // Get maintenance margin ratios
  let longMMR = 0.0625;  // Default: 6.25% (Drift's typical MMR for 10x leverage)
  let shortMMR = 0.0625;
  
  if (longMarket && shortMarket) {
    // Use actual market maintenance margin ratios
    longMMR = longMarket.marginRatioMaintenance / 10000;  // Convert from basis points
    shortMMR = shortMarket.marginRatioMaintenance / 10000;
  }
  
  // Calculate notional values per leg
  const longNotional = capitalUSDC * leverage * longWeight;
  const shortNotional = capitalUSDC * leverage * shortWeight;
  
  // Total maintenance margin required
  const totalMMR = (longNotional * longMMR) + (shortNotional * shortMMR);
  
  // Liquidation occurs when: Capital + UnrealizedPnL = MaintenanceMargin
  // UnrealizedPnL = Capital * Leverage * RatioChange
  // So: Capital + (Capital * Leverage * RatioChange) = MMR
  // Solving for RatioChange when liquidation occurs:
  const pnlAtLiquidation = totalMMR - capitalUSDC;
  const ratioChangeAtLiquidation = pnlAtLiquidation / (capitalUSDC * leverage);
  
  // Convert ratio change to actual liquidation ratio
  const liquidationRatio = entryRatio * (1 + ratioChangeAtLiquidation);
  
  return liquidationRatio;
}

/**
 * Calculate position health (0-100%)
 * 
 * Drift Protocol formula:
 * Health = 100% - (MaintenanceMargin / TotalCollateral)
 * 
 * @param position - Position with current P&L
 * @param longMarket - Optional: Long market for accurate MMR
 * @param shortMarket - Optional: Short market for accurate MMR  
 * @returns Health percentage (0-100)
 */
export function calculatePositionHealth(
  position: {
    capitalUSDC: number;
    leverage: number;
    unrealizedPnL?: number;
    longWeight?: number;
    shortWeight?: number;
  },
  longMarket?: PerpMarketAccount,
  shortMarket?: PerpMarketAccount
): number {
  const { capitalUSDC, leverage, unrealizedPnL = 0 } = position;
  const longWeight = position.longWeight || 0.5;
  const shortWeight = position.shortWeight || 0.5;
  
  // Total collateral = initial capital + unrealized P&L
  const totalCollateral = capitalUSDC + unrealizedPnL;
  
  // Calculate maintenance margin requirement
  let longMMR = 0.0625;
  let shortMMR = 0.0625;
  
  if (longMarket && shortMarket) {
    longMMR = longMarket.marginRatioMaintenance / 10000;
    shortMMR = shortMarket.marginRatioMaintenance / 10000;
  }
  
  const longNotional = capitalUSDC * leverage * longWeight;
  const shortNotional = capitalUSDC * leverage * shortWeight;
  const totalMMR = (longNotional * longMMR) + (shortNotional * shortMMR);
  
  // Health = 100% - (MMR / TotalCollateral)
  if (totalCollateral <= 0) return 0; // Already liquidated
  
  const health = 100 - ((totalMMR / totalCollateral) * 100);
  
  // Clamp between 0-100%
  return Math.min(Math.max(health, 0), 100);
}

/**
 * SERVER-SIDE: Get accurate margin and liquidation data using DriftClient
 * 
 * This function should be called from API routes with access to DriftClient
 * It returns the ACTUAL margin requirements and liquidation price from Drift Protocol
 * 
 * @param driftClient - Initialized DriftClient instance
 * @param position - Position data from database
 * @returns Accurate margin, liquidation, and health data
 */
export async function getAccuratePositionMetrics(
  driftClient: DriftClient,
  position: {
    longMarketIndex: number;
    shortMarketIndex: number;
    entryRatio: number;
    capitalUSDC: number;
    leverage: number;
    longWeight?: number;
    shortWeight?: number;
    unrealizedPnL?: number;
  }
): Promise<{
  initialMargin: number;
  maintenanceMargin: number;
  liquidationRatio: number;
  health: number;
  longMMR: number;
  shortMMR: number;
  longIMR: number;
  shortIMR: number;
}> {
  // Get actual market data from Drift
  const longMarket = driftClient.getPerpMarketAccount(position.longMarketIndex);
  const shortMarket = driftClient.getPerpMarketAccount(position.shortMarketIndex);
  
  if (!longMarket || !shortMarket) {
    throw new Error('Markets not found');
  }
  
  // Calculate using actual market margin ratios
  const initialMargin = calculateMargin(
    position.capitalUSDC,
    position.leverage,
    longMarket,
    shortMarket
  );
  
  const liquidationRatio = calculateLiquidationPrice(
    position,
    longMarket,
    shortMarket
  );
  
  const health = calculatePositionHealth(
    position,
    longMarket,
    shortMarket
  );
  
  // Extract margin ratios for reference
  const longMMR = longMarket.marginRatioMaintenance / 10000;
  const shortMMR = shortMarket.marginRatioMaintenance / 10000;
  const longIMR = longMarket.marginRatioInitial / 10000;
  const shortIMR = shortMarket.marginRatioInitial / 10000;
  
  const longWeight = position.longWeight || 0.5;
  const shortWeight = position.shortWeight || 0.5;
  const longNotional = position.capitalUSDC * position.leverage * longWeight;
  const shortNotional = position.capitalUSDC * position.leverage * shortWeight;
  const maintenanceMargin = (longNotional * longMMR) + (shortNotional * shortMMR);
  
  return {
    initialMargin,
    maintenanceMargin,
    liquidationRatio,
    health,
    longMMR,
    shortMMR,
    longIMR,
    shortIMR,
  };
}

/**
 * Calculate max position size based on available collateral and market margin requirements
 * 
 * @param collateral - Available USDC collateral
 * @param leverage - Desired leverage
 * @param initialMarginRatio - Market's initial margin ratio (optional, defaults to 0.11)
 * @returns Maximum position size in USDC
 */
export function calculateMaxPositionSize(
  collateral: number,
  leverage: number,
  initialMarginRatio: number = 0.11
): number {
  // Max position size is limited by margin requirement
  // Position Size * Leverage * IMR <= Collateral
  // So: Position Size <= Collateral / (Leverage * IMR)
  
  const maxSize = collateral / (leverage * initialMarginRatio);
  
  // Also respect Drift's max leverage (typically 10x for most markets)
  const maxLeverageSize = collateral * 10;
  
  return Math.min(maxSize, maxLeverageSize);
}

