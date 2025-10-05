'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart, ReferenceLine } from 'recharts';
import { useWallet } from '@solana/wallet-adapter-react';
import { useConnection } from '@solana/wallet-adapter-react';
import { createDriftClient } from '@/lib/drift/client';
import DepositWithdrawModal from '@/components/DepositWithdrawModal';
import { usePairTrading } from '@/hooks/usePairTrading';
import { usePositionWebSocket } from '@/hooks/usePositionWebSocket';
import { PositionsTable, PositionData } from '@/components/positions/PositionsTable';
import { TradeHistoryTable, ClosedTrade } from '@/components/positions/TradeHistoryTable';
import { TrendingUp, TrendingDown, X, CheckCircle } from 'lucide-react';

interface Position {
  id: string;
  longMarketSymbol: string;
  shortMarketSymbol: string;
  entryRatio: number;
  entryLongPrice: number;
  entryShortPrice: number;
  capitalUSDC: number;
  leverage: number;
  entryTimestamp: string;
  unrealizedPnl?: number;
  unrealizedPnlPercent?: number;
  unrealizedPnL?: number;  // Alternative casing
  unrealizedPnLPercent?: number;  // Alternative casing
  currentRatio?: number;
  currentLongPrice?: number;
  currentShortPrice?: number;
  status: string;
  closeTimestamp?: string;
  closeRatio?: number;
  closeLongPrice?: number;
  closeShortPrice?: number;
  realizedPnL?: number;
  realizedPnLPercent?: number;
  initialMargin?: number;
  maintenanceMargin?: number;
  liquidationRatio?: number;
  health?: number;
  longMarketIndex: number;
  shortMarketIndex: number;
}

export default function DashboardPage() {
  const wallet = useWallet();
  const { connection } = useConnection();
  const { closePairTrade } = usePairTrading();
  const [selectedPeriod, setSelectedPeriod] = useState<'1D' | '1W' | '1M' | '1Y' | 'ALL'>('1W');
  const [selectedFilter, setSelectedFilter] = useState('All PnLs');
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [positionsTab, setPositionsTab] = useState<'open' | 'history'>('open');
  const [isDepositWithdrawOpen, setIsDepositWithdrawOpen] = useState(false);
  const [depositWithdrawTab, setDepositWithdrawTab] = useState<'deposit' | 'withdraw'>('deposit');
  
  // Position state
  const [openPositions, setOpenPositions] = useState<Position[]>([]);
  const [closedPositions, setClosedPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(false);
  const [closingPosition, setClosingPosition] = useState<string | null>(null);
  
  // Real data state
  const [accountBalance, setAccountBalance] = useState<number>(0);
  const [currentPnL, setCurrentPnL] = useState<number>(0);
  const [totalTrades, setTotalTrades] = useState<number>(0);
  const [historicalVolume, setHistoricalVolume] = useState<number>(0);
  const [chartData, setChartData] = useState<Array<{day: string; value: number}>>([]);
  const [profitSum, setProfitSum] = useState<number>(0);
  const [lossSum, setLossSum] = useState<number>(0);
  const [netPnL, setNetPnL] = useState<number>(0);

  // Fetch real Drift account balance
  const fetchAccountBalance = useCallback(async () => {
    if (!wallet.publicKey || !wallet.signTransaction) return;

    try {
      const anchorWallet = wallet as any;
      const driftClient = await createDriftClient({
        connection,
        wallet: anchorWallet,
        env: 'devnet',
      });
      await driftClient.subscribe();
      
      try {
        const user = driftClient.getUser();
        const totalCollateral = user.getTotalCollateral().toNumber() / 1e6; // Convert to USDC
        setAccountBalance(totalCollateral);
        console.log(`Dashboard: Account balance: $${totalCollateral.toFixed(2)}`);
      } catch (userErr) {
        console.log('Dashboard: No user account yet');
        setAccountBalance(0);
      }
      
      await driftClient.unsubscribe();
    } catch (error) {
      console.error('Dashboard: Error fetching account balance:', error);
      setAccountBalance(0);
    }
  }, [wallet.publicKey, wallet.signTransaction, connection]);

  useEffect(() => {
    fetchAccountBalance();
  }, [fetchAccountBalance]);
  
  // Expose refresh function globally for deposit/withdraw modal
  useEffect(() => {
    (window as any).refreshDashboard = fetchAccountBalance;
    return () => {
      delete (window as any).refreshDashboard;
    };
  }, [fetchAccountBalance]);

  // Fetch ALL positions (global - not filtered by pair)
  useEffect(() => {
    if (!wallet.publicKey) {
      setOpenPositions([]);
      setClosedPositions([]);
      return;
    }

    const fetchData = async () => {
      setLoading(true);
      try {
        // Fetch open positions with live P&L
        const posRes = await fetch(`/api/positions/live-pnl?wallet=${wallet.publicKey?.toString()}`);
        if (posRes.ok) {
          const posData = await posRes.json();
          const positions = posData.positions || [];
          console.log(`Dashboard: Fetched ${positions.length} open positions`);
          setOpenPositions(positions);
          
          // Calculate current P&L from open positions
          const currentPnLSum = positions.reduce((sum: number, pos: any) => {
            return sum + (pos.unrealizedPnL || pos.unrealizedPnl || 0);
          }, 0);
          setCurrentPnL(currentPnLSum);
        }

        // Fetch all positions including closed
        const allPosRes = await fetch(`/api/positions?wallet=${wallet.publicKey?.toString()}`);
        if (allPosRes.ok) {
          const allPosData = await allPosRes.json();
          const allPositions = allPosData.positions || [];
          
          // Get closed positions sorted by close time (newest first)
          const closed = allPositions
            .filter((p: any) => p.status === 'CLOSED' && p.closeTimestamp)
            .sort((a: any, b: any) => 
              new Date(b.closeTimestamp).getTime() - new Date(a.closeTimestamp).getTime()
            );
          setClosedPositions(closed);
          
          // Calculate stats from all positions
          setTotalTrades(closed.length);
          
          // Calculate historical volume (sum of all position capital * leverage)
          const volume = allPositions.reduce((sum: number, pos: any) => {
            return sum + (pos.capitalUSDC * pos.leverage);
          }, 0);
          setHistoricalVolume(volume);
          
          // Calculate profit/loss sums
          let profit = 0;
          let loss = 0;
          closed.forEach((pos: any) => {
            const pnl = pos.realizedPnL || 0;
            if (pnl > 0) {
              profit += pnl;
            } else {
              loss += pnl; // Will be negative
            }
          });
          setProfitSum(profit);
          setLossSum(Math.abs(loss));
          setNetPnL(profit + loss);
          
          // Generate chart data from closed positions
          generateChartData(closed, selectedPeriod);
        }
      } catch (error) {
        console.error('Dashboard: Error fetching positions:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [wallet.publicKey, selectedPeriod]);

  // Generate chart data from historical trades
  const generateChartData = useCallback((closedPos: Position[], period: string) => {
    if (closedPos.length === 0) {
      // Default empty chart
      setChartData([
        { day: 'Mon', value: 0 },
        { day: 'Tue', value: 0 },
        { day: 'Wed', value: 0 },
        { day: 'Thu', value: 0 },
        { day: 'Fri', value: 0 },
        { day: 'Sat', value: 0 },
        { day: 'Sun', value: 0 },
      ]);
      return;
    }

    const now = new Date();
    let days = 7;
    if (period === '1D') days = 1;
    else if (period === '1W') days = 7;
    else if (period === '1M') days = 30;
    else if (period === '1Y') days = 365;
    else days = Math.max(7, Math.ceil((now.getTime() - new Date(closedPos[closedPos.length - 1].closeTimestamp!).getTime()) / (1000 * 60 * 60 * 24)));

    const data: Array<{day: string; value: number}> = [];
    let cumulativePnL = 0;

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const dayStr = date.toLocaleDateString('en-US', { weekday: 'short' });
      
      // Find all trades closed on this day
      const dayTrades = closedPos.filter((pos: Position) => {
        if (!pos.closeTimestamp) return false;
        const closeDate = new Date(pos.closeTimestamp);
        return closeDate.toDateString() === date.toDateString();
      });
      
      // Sum P&L for this day
      const dayPnL = dayTrades.reduce((sum, pos) => sum + (pos.realizedPnL || 0), 0);
      cumulativePnL += dayPnL;
      
      data.push({
        day: i === 0 ? 'Today' : dayStr,
        value: cumulativePnL
      });
    }

    setChartData(data);
  }, []);

  // Handle WebSocket position updates (P&L only)
  const handlePositionUpdate = useCallback((update: any) => {
    setOpenPositions((prevPositions) => {
      const updated = prevPositions.map((pos) =>
        pos.id === update.id
          ? {
              ...pos,
              unrealizedPnl: update.unrealizedPnl || update.unrealizedPnL,
              unrealizedPnlPercent: update.unrealizedPnlPercent || update.unrealizedPnLPercent,
              unrealizedPnL: update.unrealizedPnL || update.unrealizedPnl,
              unrealizedPnLPercent: update.unrealizedPnLPercent || update.unrealizedPnlPercent,
              currentRatio: update.currentRatio,
              currentLongPrice: update.currentLongPrice,
              currentShortPrice: update.currentShortPrice,
            }
          : pos
      );
      
      // Recalculate current P&L
      const newCurrentPnL = updated.reduce((sum, pos) => {
        return sum + (pos.unrealizedPnL || pos.unrealizedPnl || 0);
      }, 0);
      setCurrentPnL(newCurrentPnL);
      
      return updated;
    });
  }, []);

  // Connect to WebSocket for real-time P&L updates
  usePositionWebSocket(handlePositionUpdate);

  // Handle close position
  const handleClosePosition = async (position: Position) => {
    if (!wallet.publicKey) return;
    
    try {
      setClosingPosition(position.id);
      console.log(`Dashboard: Closing position ${position.id}...`);
      
      const result = await closePairTrade(position.id);
      
      if (result) {
        console.log(`Dashboard: Position closed successfully. PnL: $${result.realizedPnl.toFixed(2)}`);
        
        // Remove from open positions
        setOpenPositions(prev => prev.filter(p => p.id !== position.id));
        
        // Optionally refetch to get updated data
        setTimeout(async () => {
          const allPosRes = await fetch(`/api/positions?wallet=${wallet.publicKey?.toString()}`);
          if (allPosRes.ok) {
            const allPosData = await allPosRes.json();
            const allPositions = allPosData.positions || [];
            const closed = allPositions
              .filter((p: any) => p.status === 'CLOSED' && p.closeTimestamp)
              .sort((a: any, b: any) => 
                new Date(b.closeTimestamp).getTime() - new Date(a.closeTimestamp).getTime()
              );
            setClosedPositions(closed);
          }
        }, 2000);
      }
    } catch (err) {
      console.error('Dashboard: Error closing position:', err);
      alert('Failed to close position. Please try again.');
    } finally {
      setClosingPosition(null);
    }
  };

  // Format wallet address for display
  const formatAddress = (address: string) => {
    if (!address) return '';
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
  };

  const walletAddress = wallet.publicKey?.toString() || '';
  const displayAddress = formatAddress(walletAddress);

  return (
    <div className="min-h-screen bg-[#0a0a0a] p-4 md:p-8 mt-15">
      <div className="max-w-7xl mx-auto">
        
        <div className="flex flex-col md:grid grid-cols-2 w-full max-w-6xl mx-auto gap-0 bg-black p-4 rounded-2xl">
          {/* Left Column - Account & Actions */}
          <div className="col-span-1 flex flex-col gap-4 border-b md:border-b-0 md:border-r border-[#282828] pb-4 pr-0 md:pr-4 md:pb-0">
            {/* Platform Name */}
            <div className="relative overflow-hidden w-full">
              <div className="h-full w-full rounded-[inherit]">
                <div className="w-full flex gap-6 border-b border-[#282828]">
                  <div className="w-full px-4 py-3 border-b-2 border-[#A855F7]">
                    <span className="text-sm font-semibold capitalize text-white">Drift</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Account List */}
            <div className="relative">
              <div className="h-[225px] md:h-[279px] overflow-y-auto rounded-md w-full">
                <div className="flex items-center justify-center pr-3">
                  <div className="flex flex-col gap-2 w-full h-full">
                    <div className="flex items-center justify-between w-full bg-[#1a1a1a] rounded-lg p-3 hover:bg-[#242424] cursor-pointer transition-colors">
                      <div className="flex items-center gap-2">
                        <div className="w-5 h-5 bg-[#A855F7] rounded-full flex items-center justify-center">
                          <span className="text-xs text-white font-bold">🟣</span>
                        </div>
                        <span className="text-sm font-semibold text-white">Account 01</span>
                      </div>
                      <p className="text-sm font-semibold text-white">
                        {accountBalance.toFixed(2)} <span className="text-[#a0a0a0]">USDC</span>
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col md:flex-row gap-3 justify-between w-full h-fit md:h-[42px]">
              <button 
                onClick={() => {
                  setDepositWithdrawTab('deposit');
                  setIsDepositWithdrawOpen(true);
                }}
                className="inline-flex items-center justify-center whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-purple-500 disabled:pointer-events-none disabled:opacity-50 shadow bg-[#A855F7] w-full hover:bg-[#9333EA] text-white text-sm px-6 py-3 h-[42px] font-bold cursor-pointer rounded-lg gap-3"
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M6 2V10M2 6H10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
                <span>Deposit</span>
              </button>
              <button 
                onClick={() => {
                  setDepositWithdrawTab('withdraw');
                  setIsDepositWithdrawOpen(true);
                }}
                className="inline-flex items-center justify-center whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-purple-500 disabled:pointer-events-none disabled:opacity-50 shadow bg-[#2a1a3a] w-full hover:bg-[#3a2450] text-white disabled:bg-[#2a1a3a50] disabled:text-[#A0A0A0] text-sm px-6 py-3 h-[42px] font-bold cursor-pointer rounded-lg gap-3"
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M2 6H10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
                <span>Withdraw</span>
              </button>
            </div>
          </div>

          {/* Right Column - Chart & Stats */}
          <div className="col-span-2 sm:col-span-1 flex flex-col justify-between gap-4 pt-4 pl-0 md:pt-0 md:pl-4">
            <div className="w-full bg-black text-white border-0 p-0 flex flex-col gap-4">
              {/* Chart Controls */}
              <div className="flex gap-4 flex-row justify-between items-start">
                <div className="flex flex-col gap-2">
                  <button
                    onClick={() => setIsFilterOpen(!isFilterOpen)}
                    className="flex items-center justify-between whitespace-nowrap rounded-md border px-3 py-2 shadow-sm bg-[#2a1a3a] h-[33px] hover:bg-[#3a2450] border-transparent font-semibold text-[#A855F7] text-xs w-fit min-w-[100px] !px-2"
                  >
                    <span className="w-full text-center">{selectedFilter}</span>
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 ml-2 text-[#A855F7]">
                      <path d="M15 7.50004C15 7.50004 11.3176 12.5 9.99996 12.5C8.68237 12.5 5 7.5 5 7.5" stroke="#A855F7" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>
                  <p className="text-[10px] text-[#717171]">* Fees not included in PnL calculations</p>
                </div>

                {/* Time Period Selector */}
                <div className="flex justify-end items-center gap-1 bg-[#0a0a0a] p-1 rounded-[8px] h-[33px]">
                  {(['1D', '1W', '1M', '1Y', 'ALL'] as const).map((period) => (
                    <button
                      key={period}
                      onClick={() => setSelectedPeriod(period)}
                      className={`inline-flex items-center justify-center whitespace-nowrap font-medium transition-colors px-2 py-1 text-xs rounded h-[25px] ${
                        selectedPeriod === period
                          ? 'bg-[#2a1a3a] text-[#A855F7] hover:bg-[#3a2450]'
                          : 'text-[#717171] bg-transparent hover:bg-transparent hover:text-white'
                      }`}
                    >
                      {period}
                    </button>
                  ))}
                </div>
              </div>

              {/* Chart */}
              <div className="h-[274px] w-full min-w-0">
                <ResponsiveContainer width="100%" height="100%" minWidth={300}>
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="colorPurple" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#A855F7" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#A855F7" stopOpacity={0.05} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
                    <XAxis 
                      dataKey="day" 
                      stroke="#666666" 
                      strokeWidth={2}
                      tick={{ fill: '#888888', fontSize: 10 }}
                      height={50}
                    />
                    <YAxis 
                      stroke="#666666" 
                      strokeWidth={2}
                      tick={{ fill: '#ffffff', fontSize: 12 }}
                      width={60}
                      tickFormatter={(value) => `$${value.toFixed(value === 0 ? 0 : 2)}`}
                    />
                    <ReferenceLine 
                      y={0} 
                      stroke="#666666" 
                      strokeDasharray="2 2" 
                      strokeOpacity={0.7}
                    />
                    <Area
                      type="monotone"
                      dataKey="value"
                      stroke="#A855F7"
                      strokeWidth={2}
                      fill="url(#colorPurple)"
                      fillOpacity={0.6}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {/* Stats */}
              <div className="flex flex-col  sm:grid grid-cols-3 gap-0 sm:gap-4 text-center bg-[#1a1a1a] p-2 rounded-lg h-[143px] sm:h-[62px]">
                <div className="sm:border-r border-[#282828] border-b sm:border-b-0 pb-4 sm:pb-0 flex items-center justify-between sm:justify-center gap-1 flex-row sm:flex-col">
                  <div className="text-xs text-[#A0A0A0] font-semibold">Profit</div>
                  <div className="text-[#A855F7] text-sm font-bold">${profitSum.toFixed(2)}</div>
                </div>
                <div className="border-b sm:border-b-0 py-4 sm:py-0 sm:border-r border-[#282828] flex items-center justify-between sm:justify-center gap-1 flex-row sm:flex-col">
                  <div className="text-xs text-[#A0A0A0] font-semibold">Loss</div>
                  <div className="text-[#FF7272] text-sm font-bold">-${lossSum.toFixed(2)}</div>
                </div>
                <div className="pt-4 sm:pt-0 flex items-center justify-between sm:justify-center gap-1 flex-row sm:flex-col">
                  <div className="text-xs text-[#A0A0A0] font-semibold">Net Profit/Loss</div>
                  <div className={`text-sm font-bold ${netPnL >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {netPnL >= 0 ? '+' : ''}${netPnL.toFixed(2)}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Additional Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-6 max-w-6xl mx-auto">
          {/* Current PnL Card */}
          <div className="bg-black rounded-xl p-4 border border-[#282828]">
            <h3 className="text-xs text-[#A0A0A0] font-medium mb-2">Current PnL</h3>
            <p className={`text-xl font-bold ${currentPnL >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {currentPnL >= 0 ? '+' : ''}${currentPnL.toFixed(2)}
            </p>
          </div>

          {/* Total Trades Card */}
          <div className="bg-black rounded-xl p-4 border border-[#282828]">
            <h3 className="text-xs text-[#A0A0A0] font-medium mb-2">Total Trades</h3>
            <p className="text-xl font-bold text-white">{totalTrades}</p>
          </div>

          {/* Historical Volume Card */}
          <div className="bg-black rounded-xl p-4 border border-[#282828]">
            <h3 className="text-xs text-[#A0A0A0] font-medium mb-2">Historical Volume</h3>
            <p className="text-xl font-bold text-white">${historicalVolume.toFixed(2)}</p>
          </div>
        </div>

        {/* Positions Section */}
        <div className="bg-black rounded-2xl mt-6 border border-[#282828] overflow-hidden max-w-6xl mx-auto">
          {/* Tabs */}
          <div className="border-b border-[#282828]">
            <div className="flex gap-0">
              <button
                onClick={() => setPositionsTab('open')}
                className={`px-6 py-4 text-sm font-bold transition-colors relative ${
                  positionsTab === 'open'
                    ? 'text-white'
                    : 'text-[#A0A0A0]'
                }`}
              >
                Open Positions
                {positionsTab === 'open' && (
                  <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-[#A855F7]"></div>
                )}
              </button>
              <button
                onClick={() => setPositionsTab('history')}
                className={`px-6 py-4 text-sm font-bold transition-colors relative ${
                  positionsTab === 'history'
                    ? 'text-white'
                    : 'text-[#A0A0A0]'
                }`}
              >
                Trade History
                {positionsTab === 'history' && (
                  <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-[#A855F7]"></div>
                )}
              </button>
            </div>
          </div>

          {/* Tab Content */}
          {positionsTab === 'open' && (
            <PositionsTable
              positions={openPositions.map((pos): PositionData => ({
                ...pos,
                unrealizedPnL: pos.unrealizedPnL || pos.unrealizedPnl || 0,
                unrealizedPnLPercent: pos.unrealizedPnLPercent || pos.unrealizedPnlPercent || 0,
              }))}
              onClose={(positionId) => {
                const position = openPositions.find(p => p.id === positionId);
                if (position) handleClosePosition(position);
              }}
              onCloseAll={async () => {
                for (const position of openPositions) {
                  await handleClosePosition(position);
                }
              }}
              loading={loading}
            />
          )}

          {positionsTab === 'history' && (
            <TradeHistoryTable
              trades={closedPositions.map((pos): ClosedTrade => ({
                id: pos.id,
                longMarketSymbol: pos.longMarketSymbol,
                shortMarketSymbol: pos.shortMarketSymbol,
                closeTimestamp: pos.closeTimestamp ? new Date(pos.closeTimestamp) : new Date(),
                realizedPnL: pos.realizedPnL || 0,
                realizedPnLPercent: pos.realizedPnLPercent || 0,
                capitalUSDC: pos.capitalUSDC,
                leverage: pos.leverage,
                entryLongPrice: pos.entryLongPrice,
                entryShortPrice: pos.entryShortPrice,
                entryRatio: pos.entryRatio,
                closeLongPrice: pos.closeLongPrice || 0,
                closeShortPrice: pos.closeShortPrice || 0,
                closeRatio: pos.closeRatio || 0,
              }))}
              loading={loading}
            />
          )}
        </div>
      </div>

      {/* Deposit/Withdraw Modal */}
      <DepositWithdrawModal
        isOpen={isDepositWithdrawOpen}
        onClose={() => setIsDepositWithdrawOpen(false)}
        defaultTab={depositWithdrawTab}
      />
    </div>
  );
}

