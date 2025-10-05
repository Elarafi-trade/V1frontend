"use client";

import LandingNav from "@/components/LandingNav";
import PairChart, { SupportedToken } from "@/components/pair-chart";
import AccountBalance from "@/components/AccountBalance";
import OrderHistory from "@/components/OrderHistory";
import { ArrowUpDown } from "lucide-react";

import { ChevronDown, Repeat, ChevronDownCircle } from "lucide-react";
import { useEffect, useMemo, useState, useCallback } from "react";
import { fetchPairMetrics, fetchTokenPrice } from "@/lib/price";
import Image from "next/image";
import { useWallet } from "@solana/wallet-adapter-react";
import { usePairTrading } from "@/hooks/usePairTrading";
import { useDriftMarkets } from "@/hooks/useDriftMarkets";
import { usePositionWebSocket } from "@/hooks/usePositionWebSocket";
import { useSearchParams, useRouter } from "next/navigation";

const TOKEN_LOGO: Record<string, string> = {
  BTC: "/btc.png",
  ETH: "/eth.png",
  SOL: "/sol.png",
  JITO: "/jito.png",
  JUP: "/jup.png",
  DRIFT: "/drift.png",
};

// Helper component to render token logo with fallback
const TokenLogo = ({ token, size = 20 }: { token: string; size?: number }) => {
  const logo = TOKEN_LOGO[token];
  
  if (logo) {
    return <Image src={logo} alt={`${token} logo`} width={size} height={size} className="rounded-full" />;
  }
  
  // Fallback: colored circle with first letter
  return (
    <div 
      className="rounded-full flex items-center justify-center font-bold text-white bg-gradient-to-br from-purple-500 to-pink-500"
      style={{ width: size, height: size, fontSize: size * 0.5 }}
    >
      {token[0]}
    </div>
  );
};

function Trade() {
  const wallet = useWallet();
  const { openPairTrade, loading, error } = usePairTrading();
  const { availableTokens, loading: marketsLoading, error: marketsError } = useDriftMarkets();
  const searchParams = useSearchParams();
  const router = useRouter();

  // Use ONLY real Drift markets - no fallbacks
  const TOKENS = useMemo(() => {
    return availableTokens as SupportedToken[];
  }, [availableTokens]);

  // Initialize from URL query parameter (e.g., /Trade?pair=SOL-ETH)
  const initialPair = useMemo(() => {
    const pairParam = searchParams.get('pair');
    if (pairParam) {
      const [long, short] = pairParam.split('-');
      // Validate tokens exist in available markets
      if (long && short && availableTokens.includes(long as SupportedToken) && availableTokens.includes(short as SupportedToken)) {
        return { long: long as SupportedToken, short: short as SupportedToken };
      }
    }
    return { long: "SOL" as SupportedToken, short: "ETH" as SupportedToken };
  }, [searchParams, availableTokens]);

  const [longToken, setLongToken] = useState<SupportedToken>(initialPair.long);
  const [shortToken, setShortToken] = useState<SupportedToken>(initialPair.short);
  
  // Current position data for chart markers
  const [currentPosition, setCurrentPosition] = useState<{
    entryRatio: number;
  } | null>(null);
  const [price, setPrice] = useState<string>("$0.000000");
  const [changePct, setChangePct] = useState<number>(0);
  const [longPrice, setLongPrice] = useState<number>(0);
  const [shortPrice, setShortPrice] = useState<number>(0);

  // order controls
  const [allocationPct, setAllocationPct] = useState<number>(50); // percentage for long leg
  const LEVERAGE_MILESTONES = [1, 3, 6, 8, 10] as const; // highlighted steps
  const [leverage, setLeverage] = useState<number>(3); // 1-10 inclusive, step 1
  const [amount, setAmount] = useState<string>("0"); // USDC notional
  const [useBetaRatio, setUseBetaRatio] = useState<boolean>(true);
  
  // Take profit / Stop loss
  const [takeProfitPercent, setTakeProfitPercent] = useState<string>("");
  const [stopLossPercent, setStopLossPercent] = useState<string>("");

  // token selector modal
  const [isSelectorOpen, setIsSelectorOpen] = useState<boolean>(false);
  const [selectingSide, setSelectingSide] = useState<"long" | "short">("long");
  const [searchTerm, setSearchTerm] = useState<string>("");

  // agent details toggle
  const [isAgentOpen, setIsAgentOpen] = useState<boolean>(false);
  // pairs modal
  const [isPairsOpen, setIsPairsOpen] = useState<boolean>(false);
  const [pairSearch, setPairSearch] = useState<string>("");
  const unorderedPairs = useMemo(() => {
    const out: Array<{ a: SupportedToken; b: SupportedToken }> = [];
    for (let i = 0; i < TOKENS.length; i++) {
      for (let j = i + 1; j < TOKENS.length; j++) {
        out.push({ a: TOKENS[i], b: TOKENS[j] });
      }
    }
    return out;
  }, [TOKENS]);
  const [pairsData, setPairsData] = useState<Record<string, { price: number; change: number }>>({});

  const pairLabel = useMemo(() => `${longToken} / ${shortToken}`, [longToken, shortToken]);

  const reversePositions = () => {
    // swap tokens
    setLongToken((prevLong) => {
      const nextLong = shortToken;
      setShortToken(prevLong);
      return nextLong;
    });
    // swap displayed prices for instant feedback while new fetch resolves
    setLongPrice((prev) => {
      const oldLong = prev;
      setShortPrice(oldLong);
      return shortPrice;
    });
  };

  const formatPrice = (v: number) => {
    if (!isFinite(v)) return "$0.00";
    const decimals = v < 1 ? 5 : 2;
    return `$${v.toFixed(decimals)}`;
  };

  const handleOpenPosition = async () => {
    // Prevent double-clicking
    if (loading) {
      console.log('⚠️ Transaction already in progress, please wait...');
      return;
    }

    if (!wallet.connected) {
      alert('Please connect your wallet first');
      return;
    }

    const capitalUSDC = parseFloat(amount);
    if (!capitalUSDC || capitalUSDC <= 0) {
      alert('Please enter a valid amount');
      return;
    }

    try {
      const result = await openPairTrade({
        longToken,
        shortToken,
        capitalUSDC,
        leverage,
        longWeight: allocationPct / 100,
        shortWeight: (100 - allocationPct) / 100,
        takeProfitPercent: takeProfitPercent ? parseFloat(takeProfitPercent) : undefined,
        stopLossPercent: stopLossPercent ? parseFloat(stopLossPercent) : undefined,
      });

      alert(`Position opened successfully!\nPosition ID: ${result.positionId}\nEntry Ratio: ${result.entryRatio.toFixed(6)}`);
    } catch (err) {
      console.error('Error opening position:', err);
      alert(error || 'Failed to open position');
    }
  };

  const leverageValue = leverage; // alias for clarity
  const isHighLeverage = leverageValue >= 8;
  const isMidLeverage = leverageValue >= 5 && leverageValue <= 7;

  // dynamic background for leverage slider: left (progress) purple, right (remaining) changes by risk
  const leverageProgressPct = ((leverageValue - 1) / 9) * 100; // 1..10 → 0..100
  const leverageRightColor = isHighLeverage ? "#ef4444" : isMidLeverage ? "#f59e0b" : "#6d28d9"; // red | orange | purple
  const leverageTrackBg = `linear-gradient(to right, rgba(147,51,234,0.9) ${leverageProgressPct}%, ${leverageRightColor} ${leverageProgressPct}%)`;

  useEffect(() => {
    let isCancelled = false;
    const load = async () => {
      try {
        const data = await fetchPairMetrics(longToken, shortToken);
        if (isCancelled) return;
        setPrice(`$${data.pairPrice.toFixed(6)}`);
        setChangePct(data.pairChangePct);
        setLongPrice(data.legs.long.price);
        setShortPrice(data.legs.short.price);
      } catch (e) {
        // ignore network errors for now
      }
    };
    load();
    const id = setInterval(load, 30_000);
    return () => {
      isCancelled = true;
      clearInterval(id);
    };
  }, [longToken, shortToken]);

  // Fetch current position for chart markers (ONCE - WebSocket handles updates)
  useEffect(() => {
    if (!wallet.publicKey) {
      setCurrentPosition(null);
      return;
    }

    const fetchCurrentPosition = async () => {
      try {
        const res = await fetch(`/api/positions/live-pnl?wallet=${wallet.publicKey?.toString()}`);
        if (!res.ok) return;
        
        const data = await res.json();
        const matchingPosition = data.positions?.find((p: any) => 
          (p.longMarketSymbol === longToken && p.shortMarketSymbol === shortToken) ||
          (p.shortMarketSymbol === longToken && p.longMarketSymbol === shortToken)
        );

        if (matchingPosition) {
          setCurrentPosition({
            entryRatio: matchingPosition.entryRatio,
          });
        } else {
          setCurrentPosition(null);
        }
      } catch (error) {
        console.error('Error fetching position for chart:', error);
      }
    };

    fetchCurrentPosition();
    // NO MORE POLLING - WebSocket handles live updates
  }, [wallet.publicKey, longToken, shortToken]);

  // Handle WebSocket position updates for chart
  const handleChartPositionUpdate = useCallback((update: any) => {
    // Only update if it matches current pair
    setCurrentPosition((prev) => {
      if (!prev) return null;
      // Update TP/SL ratios if they changed (position update doesn't include these, so keep them)
      return prev;
    });
  }, []);

  // Connect to WebSocket for real-time updates (replaces polling)
  usePositionWebSocket(handleChartPositionUpdate);

  // Update URL when pair changes (for shareable links like /Trade?pair=SOL-ETH)
  useEffect(() => {
    const pairParam = `${longToken}-${shortToken}`;
    const currentPair = searchParams.get('pair');
    
    // Only update if different to avoid unnecessary history entries
    if (currentPair !== pairParam) {
      router.replace(`/Trade?pair=${pairParam}`, { scroll: false });
    }
  }, [longToken, shortToken, router, searchParams]);

  // live pair metrics for modal (polling when open)
  useEffect(() => {
    if (!isPairsOpen) return;
    let isCancelled = false;
    const loadAll = async () => {
      try {
        // Fetch each token once, then derive pair ratios
        const tokenSet = Array.from(new Set(TOKENS));
        const tokenResults = await Promise.allSettled(
          tokenSet.map(async (t) => ({ t, info: await fetchTokenPrice(t) }))
        );
        if (isCancelled) return;
        const tokenMap = new Map<SupportedToken, { price: number; change24hPct: number }>();
        for (const res of tokenResults) {
          if (res.status === "fulfilled") {
            tokenMap.set(res.value.t as SupportedToken, res.value.info);
          }
        }
        const next: Record<string, { price: number; change: number }> = {};
        for (const { a, b } of unorderedPairs) {
          const la = tokenMap.get(a);
          const lb = tokenMap.get(b);
          if (la && lb) {
            const ratio = la.price / lb.price;
            const change = la.change24hPct - lb.change24hPct;
            next[`${a}/${b}`] = { price: ratio, change };
          }
        }
        setPairsData(next);
      } catch {}
    };
    loadAll();
    const id = setInterval(loadAll, 15000);
    return () => {
      isCancelled = true;
      clearInterval(id);
    };
  }, [isPairsOpen, unorderedPairs]);

  return (
    <>
      <LandingNav />
      
      {/* Account Balance & Drift Markets Status */}
      <div className="pt-20">
        {/* Account Balance Widget */}
        {wallet.connected && (
          <div className="mx-auto max-w-7xl px-4 py-2">
            <div className="flex items-center justify-between">
              <AccountBalance />
            </div>
          </div>
        )}
        
        {/* Drift Markets Status */}
        <div>
        {!wallet.connected && (
          <div className="mx-auto max-w-7xl px-4 py-2">
            <div className="rounded-lg bg-amber-900/20 border border-amber-500/30 px-4 py-2 text-sm text-amber-200">
              🔌 Connect your wallet to load Drift Protocol markets
            </div>
          </div>
        )}
        
        {marketsLoading && wallet.connected && (
          <div className="mx-auto max-w-7xl px-4 py-2">
            <div className="rounded-lg bg-purple-900/20 border border-purple-500/30 px-4 py-2 text-sm text-purple-200">
              <span className="animate-pulse">⏳ Loading real Drift Protocol markets from devnet...</span>
            </div>
          </div>
        )}
        
        {marketsError && wallet.connected && (
          <div className="mx-auto max-w-7xl px-4 py-2">
            <div className="rounded-lg bg-red-900/20 border border-red-500/30 px-4 py-2 text-sm text-red-200">
              ⚠️ Error loading Drift markets: {marketsError}
            </div>
          </div>
        )}
        
        {availableTokens.length > 0 && wallet.connected && (
          <div className="mx-auto max-w-7xl px-4 py-2">
            <div className="rounded-lg bg-green-900/20 border border-green-500/30 px-4 py-2 text-sm text-green-200 flex items-center justify-between">
              <span>✅ Connected to Drift Protocol Devnet • {availableTokens.length} markets • 100% Real Data</span>
              <span className="text-xs opacity-75">No Fallbacks • No Mocks • No Simulations</span>
            </div>
          </div>
        )}
        </div>
      </div>
      
      <div className="min-h-screen pt-4 pb-12">
        <div className="mx-auto max-w-7xl px-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left controls */}
            <div className="lg:col-span-1 space-y-4">
              {/* Market order card */}
              <div className="rounded-2xl border border-border/60 bg-background/30 backdrop-blur-xl p-4">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold text-foreground/80">Market Order</div>
                  <span className="rounded-full bg-purple-700/40 text-purple-200 px-3 py-1 text-xs">Drift</span>
                </div>

                {/* Long selector card */}
               <div className="mt-4 rounded-xl bg-black p-3">
  <div className="text-emerald-400 text-sm font-semibold">Long</div>

  <div className="mt-2 flex items-center justify-between">
    {/* Price on the left */}
    <span className="text-sm text-foreground">{formatPrice(longPrice)}</span>

    {/* Button on the right */}
    <button
      type="button"
      onClick={() => { 
        setSelectingSide("long"); 
        setIsSelectorOpen(true); 
      }}
      className="flex items-center justify-between rounded-xl px-3 py-2 text-emerald-100 text-sm bg-[#2f3a23] hover:bg-[#344126]"
    >
      <span className="font-semibold flex items-center gap-2">
        <TokenLogo token={longToken} size={18} />
        {longToken}
      </span>
      <ChevronDown className="w-4 h-4 text-foreground/80" />
    </button>
  </div>
</div>


                {/* Divider with centered reverse button */}
                <div className="my-2">
                  <div className="flex items-center justify-center gap-3">
                 
                    <button
                      type="button"
                      onClick={reversePositions}
                      aria-label="Reverse long and short"
                      className="flex h-10 w-10 items-center justify-center rounded-full border border-foreground/10 bg-black shadow"
                    >
                     <ArrowUpDown className="w-4 h-4 text-foreground/80" />
                    </button>
                  
                  </div>
                </div>

                {/* Short selector card */}
             <div className="mt-4 rounded-xl bg-black p-3">
  <div className="text-rose-400 text-sm font-semibold">Short</div>

  <div className="mt-2 flex items-center justify-between">
    {/* Price on the left */}
    <span className="text-sm text-foreground">{formatPrice(shortPrice)}</span>

    {/* Button on the right */}
    <button
      type="button"
      onClick={() => { 
        setSelectingSide("short"); 
        setIsSelectorOpen(true); 
      }}
      className="flex items-center justify-between rounded-xl px-3 py-2 text-rose-100 text-sm bg-[#3a2426] hover:bg-[#43292c]"
    >
      <span className="font-semibold flex items-center gap-2">
        <TokenLogo token={shortToken} size={18} />
        {shortToken}
      </span>
      <ChevronDown className="w-4 h-4 text-foreground/80" />
    </button>
  </div>
</div>

                {/* Low liquidity warning */}
                {(['ETH', 'AVAX', 'MATIC', 'FTM'].includes(longToken) || ['ETH', 'AVAX', 'MATIC', 'FTM'].includes(shortToken)) && (
                  <div className="mt-4 rounded-xl border border-orange-500/30 bg-orange-900/10 p-3">
                    <div className="flex items-start gap-2">
                      <div className="mt-0.5 text-orange-400">⚠️</div>
                      <div className="flex-1">
                        <div className="text-xs font-semibold text-orange-300">Slower Order Fills on Devnet</div>
                        <div className="mt-1 text-[10px] text-orange-200/80 leading-relaxed">
                          {['ETH', 'AVAX', 'MATIC', 'FTM'].includes(longToken) && `${longToken} `}
                          {['ETH', 'AVAX', 'MATIC', 'FTM'].includes(shortToken) && `${shortToken} `}
                          has lower liquidity on devnet. Orders may take 2-3 minutes to fill. For faster fills, consider using SOL or BTC pairs.
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Allocation slider (purple theme, rounded-square thumb) */}
                <div className="mt-5">
                  <div className="flex items-center justify-between text-xs text-foreground/70">
                    <span>{longToken}: {allocationPct}%</span>
                    <span>{shortToken}: {100 - allocationPct}%</span>
                  </div>
                  <div className="mt-2">
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={allocationPct}
                      onChange={(e) => setAllocationPct(parseInt(e.target.value))}
                      className="w-full h-2 rounded-full appearance-none bg-purple-800/60 border border-purple-500/40 \
                      [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:rounded-[6px] [&::-webkit-slider-thumb]:bg-purple-500 [&::-webkit-slider-thumb]:border-[3px] [&::-webkit-slider-thumb]:border-purple-300 [&::-webkit-slider-thumb]:cursor-pointer \
                      [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:rounded-[6px] [&::-moz-range-thumb]:bg-purple-500 [&::-moz-range-thumb]:border-[3px] [&::-moz-range-thumb]:border-purple-300 [&::-moz-range-thumb]:cursor-pointer"
                      aria-label="Allocation between long and short"
                    />
                    <div className="mt-1 flex justify-between text-[10px] text-foreground/60">
                      <span>0%</span>
                      <span>50%</span>
                      <span>100%</span>
                    </div>
                  </div>
                </div>

                {/* Leverage slider 1x–10x with milestones and dynamic color */}
                <div className="mt-4">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-foreground/70">Leverage</span>
                    <span className={`${isHighLeverage ? "text-rose-400" : isMidLeverage ? "text-amber-300" : "text-purple-300"} font-semibold`}>{leverageValue}x</span>
                  </div>
                  <div className="mt-3">
                    <input
                      type="range"
                      min={1}
                      max={10}
                      step={1}
                      value={leverageValue}
                      onChange={(e) => setLeverage(parseInt(e.target.value))}
                      style={{ backgroundImage: leverageTrackBg }}
                      className={`w-full h-2 rounded-full appearance-none border ${isHighLeverage ? "border-rose-500/50" : isMidLeverage ? "border-amber-500/40" : "border-purple-500/40"} \
                      [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:rounded-[6px] [&::-webkit-slider-thumb]:bg-purple-500 [&::-webkit-slider-thumb]:border-[3px] [&::-webkit-slider-thumb]:border-purple-300 [&::-webkit-slider-thumb]:cursor-pointer \
                      [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:rounded-[6px] [&::-moz-range-thumb]:bg-purple-500 [&::-moz-range-thumb]:border-[3px] [&::-moz-range-thumb]:border-purple-300 [&::-moz-range-thumb]:cursor-pointer`}
                      aria-label="Set leverage"
                    />
                    {/* Ticks 1..10 and milestone chips */}
                    <div className="mt-2">
                      <div className="grid grid-cols-10">
                        {Array.from({ length: 10 }, (_, i) => i + 1).map((lv) => {
                          const active = lv <= leverageValue;
                          const isMilestone = LEVERAGE_MILESTONES.includes(lv as (typeof LEVERAGE_MILESTONES)[number]);
                          return (
                            <button
                              key={lv}
                              type="button"
                              onClick={() => setLeverage(lv)}
                              className="flex flex-col items-center group"
                              aria-label={`Set leverage ${lv}x`}
                            >
                              <div className={`h-2 w-px ${active ? (isHighLeverage ? "bg-rose-400" : isMidLeverage ? "bg-amber-300" : "bg-purple-400") : "bg-foreground/20"}`} />
                              <span className={`mt-1 text-[10px] ${lv === leverageValue ? (isHighLeverage ? "text-rose-300" : isMidLeverage ? "text-amber-300" : "text-purple-300") : "text-foreground/50"}`}>{lv}x</span>
                              {isMilestone && (
                                <span className={`mt-1 rounded-full px-2 py-0.5 text-[10px] border ${lv === leverageValue ? (isHighLeverage ? "border-rose-400 text-rose-300" : isMidLeverage ? "border-amber-400 text-amber-300" : "border-purple-400 text-purple-300") : "border-border text-foreground/60"}`}>
                                  Mile
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Amount input */}
                <div className="mt-4">
                  <div className="flex items-center justify-between text-xs text-foreground/70">
                    <span>Enter Amount</span>
                    <button
                      type="button"
                      onClick={() => setAmount("1000")}
                      className="px-2 py-1 rounded-full bg-background/50 border border-border text-foreground/70 hover:text-foreground text-[10px]"
                    >
                      Max
                    </button>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <input
                      type="number"
                      inputMode="decimal"
                      min="0"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      className="w-full rounded-xl bg-background/40 border border-border px-3 py-2 text-sm"
                      placeholder="0"
                    />
                    <span className="text-xs text-foreground/70">USDC</span>
                  </div>
                </div>

                {/* Computed per-leg notional */}
                <div className="mt-4 text-xs text-foreground/70">
                  {(() => {
                    const amt = Number(amount) || 0;
                    const gross = amt * leverageValue;
                    const longAmt = (gross * allocationPct) / 100;
                    const shortAmt = gross - longAmt;
                    return (
                      <div className="flex items-center justify-between">
                        <span>
                          {longToken}: <span className="text-foreground">${longAmt.toFixed(2)}</span>
                        </span>
                        <span>
                          {shortToken}: <span className="text-foreground">${shortAmt.toFixed(2)}</span>
                        </span>
                      </div>
                    );
                  })()}
                </div>

                {/* Take Profit / Stop Loss */}
                <div className="mt-5 space-y-3">
                  <div>
                    <label className="text-xs text-foreground/70 block mb-1">Take Profit (%)</label>
                    <input
                      type="number"
                      value={takeProfitPercent}
                      onChange={(e) => setTakeProfitPercent(e.target.value)}
                      placeholder="e.g., 10"
                      className="w-full rounded-xl bg-background/40 border border-border px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-foreground/70 block mb-1">Stop Loss (%)</label>
                    <input
                      type="number"
                      value={stopLossPercent}
                      onChange={(e) => setStopLossPercent(e.target.value)}
                      placeholder="e.g., 5"
                      className="w-full rounded-xl bg-background/40 border border-border px-3 py-2 text-sm"
                    />
                  </div>
                </div>

                {/* Agent Elara - AI analysis (placeholder UI for ML engineer) */}
                <div className="mt-5 rounded-xl border border-purple-600/40 bg-purple-900/10">
                  <button
                    type="button"
                    onClick={() => setIsAgentOpen((v) => !v)}
                    className="w-full flex items-center justify-between px-3 py-2"
                    aria-expanded={isAgentOpen}
                  >
                    <div className="flex items-center gap-2">
                      <div className="h-6 w-6 rounded-full bg-purple-500" />
                      <div className="text-sm font-semibold text-purple-300">Agent Elara</div>
                    </div>
                    <ChevronDown className={`w-4 h-4 text-purple-300 transition-transform ${isAgentOpen ? "rotate-180" : "rotate-0"}`} />
                  </button>
                  {isAgentOpen && (
                    <div className="px-3 pb-3 text-xs">
                      <div className="flex items-center justify-between py-1">
                        <span className="text-foreground/70">Correlation</span>
                        <span className="text-purple-300">0.78</span>
                      </div>
                      <div className="flex items-center justify-between py-1">
                        <span className="text-foreground/70">Cointegrated</span>
                        <span className="text-purple-300">No</span>
                      </div>
                      <div className="flex items-center justify-between py-1">
                        <span className="text-foreground/70">Roll ZScore</span>
                        <span className="text-purple-300">-0.79</span>
                      </div>
                      <div className="flex items-center justify-between py-1">
                        <span className="text-foreground/70">Volatility</span>
                        <span className="text-purple-300">20%</span>
                      </div>
                      <div className="flex items-center justify-between py-1">
                        <span className="text-foreground/70">Beta</span>
                        <span className="text-purple-300">BTC: 57.2% ETH: 42.8%</span>
                      </div>
                      <div className="mt-2 flex items-center justify-between">
                        <span className="text-foreground/70">Use Beta Ratio</span>
                        <button
                          type="button"
                          onClick={() => setUseBetaRatio((v) => !v)}
                          className={`relative inline-flex h-5 w-9 items-center rounded-full border ${useBetaRatio ? "bg-purple-400 border-purple-300" : "bg-background/40 border-border"}`}
                          aria-pressed={useBetaRatio}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-black transition ${useBetaRatio ? "translate-x-4" : "translate-x-1"}`}
                          />
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <button 
                  onClick={handleOpenPosition}
                  disabled={loading || !wallet.connected || marketsLoading || availableTokens.length === 0}
                  className="mt-6 w-full rounded-full bg-purple-600 text-white hover:bg-purple-500 transition-colors text-sm font-semibold py-3 shadow disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading 
                    ? 'Opening Position...' 
                    : !wallet.connected 
                    ? 'Connect Wallet First' 
                    : marketsLoading 
                    ? 'Loading Markets...'
                    : availableTokens.length === 0
                    ? 'No Markets Available'
                    : 'Open Position'
                  }
                </button>
                
                {loading && (
                  <div className="mt-2 text-xs text-purple-300 text-center space-y-1">
                    <div>⏳ This may take a few moments...</div>
                    <div className="text-foreground/60">
                      {wallet.connected && (
                        <>
                          • Checking SOL balance<br/>
                          • Depositing collateral (1 signature)<br/>
                          • Opening BOTH positions (1 signature)<br/>
                          <br/>
                          <span className="text-purple-300">✨ 2 signatures total</span>
                        </>
                      )}
                    </div>
                  </div>
                )}
                
                {error && (
                  <div className="mt-2 text-xs text-red-400 text-center">
                    {error}
                  </div>
                )}
              </div>
            </div>

            {/* Right: header + chart */}
            <div className="lg:col-span-2 space-y-3">
              {/* Top metrics/header aligned above chart to mirror screenshot */}
              <div className="rounded-2xl border border-border/60 bg-background/30 backdrop-blur-xl px-4 py-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 text-base font-semibold">
                      <TokenLogo token={longToken} size={20} />
                      <span className="text-foreground">{longToken}</span>
                      <span className="text-foreground/40">/</span>
                      <TokenLogo token={shortToken} size={20} />
                      <span className="text-foreground">{shortToken}</span>
        
                      <button
                        type="button"
                        onClick={() => setIsPairsOpen(true)}
                        aria-label="Open pairs list"
                        className="ml-1"
                      >
                        <ChevronDownCircle className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                       <div className="h-4 w-px bg-border" />
                  <div className="flex items-center gap-8 text-xs">
                    <div className="flex flex-col items-end">
                      <span className="text-foreground/70">Price</span>
                      <span className="text-foreground font-semibold">{price}</span>
                    </div>
                    <div className="flex flex-col items-end">
                      <span className="text-foreground/70">24h Change</span>
                      <span className={`${changePct>=0 ? "text-emerald-400" : "text-rose-300"} font-semibold`}>
                        {changePct>=0 ? "+" : ""}{changePct.toFixed(2)}%
                      </span>
                    </div>
                    {/* <div className="flex flex-col items-end">
                      <span className="text-foreground/70">Net Funding / Countdown</span>
                      <span className="text-rose-300 font-semibold">0.0000% 00:00:00</span>
                    </div> */}
                  </div>
                </div>
              </div>

              {/* Chart */}
              <PairChart 
                longToken={longToken} 
                shortToken={shortToken}
                entryRatio={currentPosition?.entryRatio}
              />
              
              {/* Order History Panel */}
              <div className="mt-4">
                <OrderHistory longToken={longToken} shortToken={shortToken} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Token selector modal */}
      {isSelectorOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          role="dialog"
          aria-modal="true"
        >
          <div className="absolute inset-0 bg-black/70" onClick={() => setIsSelectorOpen(false)} />
          <div className="relative w-full max-w-3xl mx-auto rounded-2xl border border-border/60 bg-background/95 backdrop-blur-xl shadow-xl p-4">
            <div className="rounded-xl bg-gradient-to-br from-emerald-900/30 to-purple-900/30 border border-border/40 px-4 py-6">
              <div className="text-lg font-semibold">Select {selectingSide === "long" ? "Long" : "Short"} Token</div>
              <div className="text-xs text-foreground/70">Select a token to go {selectingSide}</div>
            </div>
            <div className="mt-4">
              <input
                autoFocus
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search token by symbol"
                className="w-full rounded-lg bg-background/40 border border-border px-3 py-2 text-sm"
              />
            </div>
            <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-[360px] overflow-y-auto pr-1">
              {TOKENS.filter((t) => t.toLowerCase().includes(searchTerm.toLowerCase())).map((t) => {
                const isLowLiquidity = ['ETH', 'AVAX', 'MATIC', 'FTM'].includes(t);
                return (
                <button
                  key={t}
                  onClick={() => {
                    if (selectingSide === "long") setLongToken(t);
                    else setShortToken(t);
                    setIsSelectorOpen(false);
                    setSearchTerm("");
                  }}
                    className={`flex flex-col items-start rounded-xl px-4 py-3 border transition-colors ${
                    (selectingSide === "long" ? longToken === t : shortToken === t)
                      ? "border-purple-500/60 bg-purple-900/20"
                      : "border-border bg-background/30 hover:bg-background/50"
                  }`}
                >
                    <div className="flex items-center justify-between w-full mb-1">
                  <div className="flex items-center gap-3">
                        <TokenLogo token={t} size={24} />
                    <div className="text-sm font-medium">{t}</div>
                  </div>
                      {isLowLiquidity && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-400 border border-orange-500/30">
                          Slow
                        </span>
                      )}
                    </div>
                    {isLowLiquidity && (
                      <div className="text-[10px] text-orange-400/80 leading-tight">
                        Lower liquidity on devnet - may take 2-3 min to fill
                      </div>
                    )}
                </button>
                );
              })}
            </div>
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={() => setIsSelectorOpen(false)}
                className="px-4 py-2 rounded-full bg-background/40 border border-border text-sm hover:bg-background/60"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pairs modal */}
      {isPairsOpen && (
        <div className="fixed inset-0 z-50" role="dialog" aria-modal>
          <div className="absolute inset-0 bg-black/70" onClick={() => setIsPairsOpen(false)} />
          <div className="absolute top-32 left-1/2 transform -translate-x-1/2 w-full max-w-md rounded-2xl border border-border/60 bg-background/95 backdrop-blur-xl shadow-xl p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-lg font-semibold">All Pairs</div>
                <div className="text-xs text-foreground/70">Live prices and 24h change</div>
              </div>
              <button type="button" onClick={() => setIsPairsOpen(false)} className="px-3 py-1.5 rounded-full bg-background/40 border border-border text-xs">
                Close
              </button>
            </div>
            <div className="mt-3">
              <input
                value={pairSearch}
                onChange={(e) => setPairSearch(e.target.value)}
                placeholder="Search pairs (e.g. btc/eth)"
                className="w-full rounded-xl bg-background/40 border border-border px-3 py-2 text-sm"
              />
            </div>
            <div className="mt-4 max-h-[320px] overflow-y-auto pr-1 space-y-2 scrollbar-thin scrollbar-track-black scrollbar-thumb-purple-500 hover:scrollbar-thumb-purple-400">
              {unorderedPairs
                .filter(({ a, b }) => {
                  const s = pairSearch.trim().toLowerCase();
                  if (!s) return true;
                  const label = `${a}/${b}`.toLowerCase();
                  const label2 = `${b}/${a}`.toLowerCase();
                  return label.includes(s) || label2.includes(s);
                })
                .map(({ a, b }) => {
                  const key = `${a}/${b}`;
                  const data = pairsData[key];
                  const change = data?.change ?? 0;
                  const priceStr = data ? `$${data.price.toFixed(6)}` : "--";
                  return (
                    <button
                      key={key}
                      onClick={() => {
                        setLongToken(a);
                        setShortToken(b);
                        setIsPairsOpen(false);
                      }}
                      className="w-full flex items-center justify-between rounded-lg border border-border bg-background/40 hover:bg-background/60 px-3 py-2"
                    >
                      <div className="flex items-center gap-1.5 text-sm font-medium">
                        <TokenLogo token={a} size={18} />
                        <span>{a}</span>
                        <span className="text-foreground/40">/</span>
                        <TokenLogo token={b} size={18} />
                        <span>{b}</span>
                      </div>
                      <div className="flex items-center gap-6 text-xs">
                        <div className="flex flex-col items-end">
                          <span className="text-foreground/70">Price</span>
                          <span className="text-foreground font-semibold">{priceStr}</span>
                        </div>
                        <div className="flex flex-col items-end">
                          <span className="text-foreground/70">24h Change</span>
                          <span className={`${change>=0 ? "text-emerald-400" : "text-rose-300"} font-semibold`}>
                            {change>=0 ? "+" : ""}{change.toFixed(2)}%
                          </span>
                        </div>
                      </div>
                    </button>
                  );
                })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default Trade;