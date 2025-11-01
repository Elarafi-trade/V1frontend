"use client"

import type React from "react"
import { useState, useEffect } from "react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import toast, { Toaster } from 'react-hot-toast'

interface ApiTradeData {
  id: number
  timestamp: string
  pair: string
  action: string
  signal: string
  zScore: string
  correlation: string
  spread: string
  spreadMean: string
  spreadStd: string
  beta: string
  reason: string
  longAsset: string
  shortAsset: string
  longPrice: string
  shortPrice: string
  status: string
  closeTimestamp: string | null
  closeReason: string | null
  closePnL: string | null
  upnlPct: string
  volatility: string
  halfLife: string
  sharpe: string
}

interface SignalData {
  id: string
  token1: { symbol: string; icon: string; color: string }
  token2: { symbol: string; icon: string; color: string }
  price: string
  entryPrice: string
  performance: string
  signal?: string
  correlation: string
  cointegration: string
  halfLife: string
  rollingZScore: string
  tradingEngine: string
  timeAgo: string
  spread: string
  volatility: string
  sharpe: string
  beta: string
  reason: string
  status: string
  timestamp: Date
  closeReason: string
}

interface ApiPerformanceMetrics {
  totalTrades: number
  openTrades: number
  closedTrades: number
  winningTrades: number
  losingTrades: number
  winRate: string
  totalReturnPct: string
  totalReturnPctLeveraged: string
  avgTradeDurationHours: string
  profitFactor: string
  estimatedAPY: string
  estimatedAPYLeveraged: string
  lastUpdated: string
}

interface PerformanceMetrics {
  totalTrades: number
  openTrades: number
  closedTrades: number
  winningTrades: number
  losingTrades: number
  winRate: number
  totalReturnWithLeverage: number
  totalReturnWithoutLeverage: number
  apy: number | null
  apyLeveraged: number | null
  avgTradesPerDay: number
  avgReturnsPerDay: number
  profitFactor: number
  avgDuration: number
  startDate: number
  lastUpdated: number
}

// Helper function to get token icon and color
const getTokenStyle = (symbol: string): { icon: string; color: string } => {
  const tokenMap: Record<string, { icon: string; color: string }> = {
    BTC: { icon: "₿", color: "bg-orange-500" },
    ETH: { icon: "Ξ", color: "bg-blue-600" },
    SOL: { icon: "◎", color: "bg-purple-600" },
    ARB: { icon: "🔷", color: "bg-blue-500" },
    JUP: { icon: "🪐", color: "bg-purple-500" },
    ORCA: { icon: "🐋", color: "bg-yellow-600" },
    TIA: { icon: "🌟", color: "bg-purple-600" },
    ICP: { icon: "∞", color: "bg-purple-500" },
    AVAX: { icon: "🔺", color: "bg-red-500" },
  }

  // Extract base symbol (remove -PERP suffix)
  const baseSymbol = symbol.replace("-PERP", "")

  return tokenMap[baseSymbol] || { icon: "🪙", color: "bg-gray-500" }
}

// Helper function to calculate time ago
const getTimeAgo = (timestamp: string): string => {
  const now = new Date()
  const past = new Date(timestamp)
  const diffMs = now.getTime() - past.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 60) return `${diffMins} minutes ago`
  if (diffHours < 24) return `${diffHours} hours ago`
  return `${diffDays} days ago`
}

// Normalize various timestamp formats (including microseconds and missing timezone) into a valid Date
const toValidDate = (value: unknown): Date | null => {
  if (value == null) return null
  if (value instanceof Date) return isNaN(value.getTime()) ? null : value
  if (typeof value === 'number') {
    const d = new Date(value)
    return isNaN(d.getTime()) ? null : d
  }
  if (typeof value === 'string') {
    let s = value.trim()
    // Trim microseconds to milliseconds (max 3 digits after dot)
    s = s.replace(/\.(\d{3})\d+/, '.$1')
    // If ISO without timezone, append 'Z' (assume UTC)
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?$/.test(s)) {
      s += 'Z'
    }
    const d = new Date(s)
    if (!isNaN(d.getTime())) return d
  }
  return null
}

// Types for Top Daily Signals (analyze endpoint)
interface DailySignal {
  cached_at: any
  id: string
  token1: { symbol: string; icon: string; color: string }
  token2: { symbol: string; icon: string; color: string }
  zScore?: string
  correlation?: string
  cointegration?: string
  halfLife?: string
  volatility?: string
  sharpe?: string
  beta?: string
  reason?: string
  signal?: string
  confidence?: string
  riskLevel?: string
  entryRecommendation?: string
  timeAgo?: string
  timestamp?: Date
}

const Agent: React.FC = () => {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<"live" | "history" | "top">("live")
  const [searchQuery, setSearchQuery] = useState("")
  const [signals, setSignals] = useState<SignalData[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [showFilterModal, setShowFilterModal] = useState(false)
  const [showMetricsModal, setShowMetricsModal] = useState(false)
  const [performanceMetrics, setPerformanceMetrics] = useState<PerformanceMetrics | null>(null)

  // Top Daily signals state
  const [dailySignals, setDailySignals] = useState<DailySignal[]>([])
  const [dailyLoading, setDailyLoading] = useState(false)
  const [dailyError, setDailyError] = useState<string | null>(null)
  const [expandedReason, setExpandedReason] = useState<Record<string, boolean>>({})

  // Styling helpers for Top Daily metrics
  const getSignalClass = (s?: string) => {
    if (!s) return 'text-white'
    const v = s.toLowerCase()
    if (["buy", "long", "bullish", "open-long", "go-long"].includes(v)) return 'text-green-400'
    if (["sell", "short", "bearish", "open-short", "go-short"].includes(v)) return 'text-red-400'
    return 'text-white'
  }
  const getRiskClass = (s?: string) => {
    if (!s) return 'text-white'
    const v = s.toLowerCase()
    if (v.includes('low')) return 'text-green-400'
    if (v.includes('high')) return 'text-red-400'
    return 'text-white'
  }
  const getConfidenceClass = (s?: string) => {
    if (s == null) return 'text-white'
    const val = parseFloat(s)
    if (Number.isNaN(val)) return 'text-white'
    const pct = val <= 1 ? val * 100 : val
    if (pct >= 70) return 'text-green-400'
    if (pct < 40) return 'text-red-400'
    return 'text-white'
  }

  // Render a rich signal label with colors:
  // - NEUTRAL -> yellow
  // - "LONG X SHORT Y" -> color LONG (green), SHORT (red), and show tokens
  // - If only LONG or SHORT present, color accordingly
  const renderSignalDisplay = (raw?: string, t1?: { symbol: string }, t2?: { symbol: string }) => {
    if (raw == null) return <span className="text-white">N/A</span>
    const upper = raw.toUpperCase().trim()
    const cleanToken = (tok: string) => tok.replace(/-PERP$/i, '')
    const cleanText = (txt: string) => txt.replace(/-PERP\b/gi, '')
    if (upper.length === 0) return <span className="text-yellow-400">NEUTRAL</span>
    if (upper === 'NEUTRAL') return <span className="text-yellow-400">NEUTRAL</span>

    const longMatch = upper.match(/LONG\s+([A-Z0-9\-]+)/)
    const shortMatch = upper.match(/SHORT\s+([A-Z0-9\-]+)/)

    // If we have explicit LONG and SHORT tokens in the string, honor them
    if (longMatch && shortMatch) {
      const longTok = cleanToken(longMatch[1])
      const shortTok = cleanToken(shortMatch[1])
      return (
        <span>
          <span className="text-green-400">LONG</span>{' '}
          <span className="text-white">{longTok}</span>{' '}
          <span className="text-[#A0A0A0]">/</span>{' '}
          <span className="text-red-400">SHORT</span>{' '}
          <span className="text-white">{shortTok}</span>
        </span>
      )
    }

    // If both words present but tokens not extracted, assume order t1 = LONG, t2 = SHORT
    if (upper.includes('LONG') && upper.includes('SHORT')) {
      return (
        <span>
          <span className="text-green-400">LONG</span>{' '}
          <span className="text-white">{t1?.symbol ? cleanToken(t1.symbol) : 'A'}</span>{' '}
          <span className="text-[#A0A0A0]">/</span>{' '}
          <span className="text-red-400">SHORT</span>{' '}
          <span className="text-white">{t2?.symbol ? cleanToken(t2.symbol) : 'B'}</span>
        </span>
      )
    }

    // Single side hints
    if (upper.includes('LONG')) return <span className="text-green-400">{cleanText(raw)}</span>
    if (upper.includes('SHORT')) return <span className="text-red-400">{cleanText(raw)}</span>

    // Default
    return <span className="text-white">{cleanText(raw)}</span>
  }

  // Supported tokens
  const SUPPORTED_TOKENS = ['BTC', 'SOL', 'ETH']

  // Filter states
  const [updateFilters, setUpdateFilters] = useState({
    allTime: true,
    oneDay: false,
    oneWeek: false,
  })
  const [timeframeFilters, setTimeframeFilters] = useState({
    allTimeframes: true,
    oneHour: false,
    oneDay: false,
  })

  // Fetch data from API
  useEffect(() => {
    const fetchSignals = async () => {
      try {
        setLoading(true)
        setError(null)
        const response = await fetch("https://pair-agent.onrender.com/api/trades")

        if (!response.ok) {
          throw new Error("Failed to fetch signals")
        }

        const data: ApiTradeData[] = await response.json()

        // Transform API data to SignalData format
        const transformedSignals: SignalData[] = data.map((trade) => {
          const [longSymbol, shortSymbol] = trade.pair.split("/")
          // Remove -PERP suffix
          const cleanLongSymbol = longSymbol.replace("-PERP", "")
          const cleanShortSymbol = shortSymbol.replace("-PERP", "")

          const longStyle = getTokenStyle(longSymbol)
          const shortStyle = getTokenStyle(shortSymbol)

          return {
            id: trade.id.toString(),
            token1: { symbol: cleanLongSymbol, ...longStyle },
            token2: { symbol: cleanShortSymbol, ...shortStyle },
            price: `$${parseFloat(trade.longPrice).toFixed(4)}`,
            entryPrice: `$${parseFloat(trade.shortPrice).toFixed(4)}`,
            performance: `${parseFloat(trade.upnlPct).toFixed(4)}%`,
            correlation: trade.correlation,
            cointegration: "Yes", // Default since API doesn't provide this
            halfLife: `${parseFloat(trade.halfLife).toFixed(1)} Days`,
            rollingZScore: trade.zScore,
            tradingEngine: "DRIFT",
            signal: trade.signal || (trade as any).action || 'NEUTRAL',
            timeAgo: getTimeAgo(trade.timestamp),
            spread: trade.spread,
            volatility: trade.volatility,
            sharpe: trade.sharpe,
            beta: trade.beta,
            reason: trade.reason,
            status: trade.status,
            timestamp: new Date(trade.timestamp),
            closeReason: trade.closeReason,
          }
        })

        setSignals(transformedSignals)
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred")
        console.error("Error fetching signals:", err)
      } finally {
        setLoading(false)
      }
    }

    const fetchPerformanceMetrics = async () => {
      try {
        const response = await fetch("https://pair-agent.onrender.com/api/performance")

        console.log("API Response Status:", response.status)

        if (!response.ok) {
          throw new Error("Failed to fetch performance metrics")
        }

        const data: ApiPerformanceMetrics = await response.json()
        console.log("Agent Performance Metrics Raw Data:", data)

        // Check if data is empty object
        if (Object.keys(data).length === 0) {
          console.warn("API returned empty object, using default values")
          // Set default values
          const defaultMetrics: PerformanceMetrics = {
            totalTrades: 0,
            openTrades: 0,
            closedTrades: 0,
            winningTrades: 0,
            losingTrades: 0,
            winRate: 0,
            totalReturnWithLeverage: 0,
            totalReturnWithoutLeverage: 0,
            apy: null,
            apyLeveraged: null,
            avgTradesPerDay: 0,
            avgReturnsPerDay: 0,
            profitFactor: 0,
            avgDuration: 0,
            startDate: Date.now(),
            lastUpdated: Date.now()
          }
          setPerformanceMetrics(defaultMetrics)
        } else {
          // Transform API data to PerformanceMetrics format
          const avgDurationHours = parseFloat(data.avgTradeDurationHours)
          const avgDurationDays = avgDurationHours / 24

          const transformedMetrics: PerformanceMetrics = {
            totalTrades: data.totalTrades,
            openTrades: data.openTrades,
            closedTrades: data.closedTrades,
            winningTrades: data.winningTrades,
            losingTrades: data.losingTrades,
            winRate: parseFloat(data.winRate),
            totalReturnWithLeverage: parseFloat(data.totalReturnPctLeveraged),
            totalReturnWithoutLeverage: parseFloat(data.totalReturnPct),
            apy: parseFloat(data.estimatedAPY),
            apyLeveraged: parseFloat(data.estimatedAPYLeveraged),
            avgTradesPerDay: 0, // Not provided by API
            avgReturnsPerDay: 0, // Not provided by API
            profitFactor: parseFloat(data.profitFactor),
            avgDuration: avgDurationDays,
            startDate: Date.now(), // Not provided by API
            lastUpdated: new Date(data.lastUpdated).getTime()
          }
          setPerformanceMetrics(transformedMetrics)
        }
      } catch (err) {
        console.error("Error fetching performance metrics:", err)
      }
    }

    fetchSignals()
    fetchPerformanceMetrics()
  }, [])

  // Fetch Top Daily signals when switching to the tab the first time
  useEffect(() => {
    const pairs: Array<{ symbolA: string; symbolB: string }> = [
      { symbolA: 'SOL', symbolB: 'BTC' },
      { symbolA: 'BTC', symbolB: 'SOL' },
      { symbolA: 'ETH', symbolB: 'BTC' },
      { symbolA: 'BTC', symbolB: 'ETH' },
      { symbolA: 'SOL', symbolB: 'ETH' },
      { symbolA: 'ETH', symbolB: 'SOL' },
    ]

    const transform = (a: string, b: string, raw: any): DailySignal => {
      const token1 = { symbol: a, ...getTokenStyle(a) }
      const token2 = { symbol: b, ...getTokenStyle(b) }
      // Try to read common metric names with safe fallbacks
      const z = raw?.zScore ?? raw?.zscore ?? raw?.metrics?.zScore ?? raw?.stats?.zScore
      const corr = raw?.correlation ?? raw?.metrics?.correlation ?? raw?.metrics?.corr ?? raw?.stats?.correlation
      const hl = raw?.halfLife ?? raw?.halfLifeDays ?? raw?.metrics?.halfLife
      const integ = raw?.cointegration ?? (raw?.isCointegrated != null ? (raw.isCointegrated ? 'Yes' : 'No') : undefined)
      const vol = raw?.volatility ?? raw?.metrics?.volatility
      const sh = raw?.sharpe ?? raw?.metrics?.sharpe
      const bta = raw?.beta ?? raw?.metrics?.beta
      const rsn = raw?.reason ?? raw?.explanation ?? raw?.analysis?.reasoning
      const analysis = raw?.analysis ?? {}
      const sig = analysis?.signal
      const conf = analysis?.confidence
      const risk = analysis?.risk_level ?? analysis?.riskLevel
      const entryRec = analysis?.entry_recommendation ?? analysis?.entryRecommendation
  const updatedRaw = raw?.cached_at ?? raw?.updatedAt ?? raw?.timestamp ?? Date.now()
  const updatedDate = toValidDate(updatedRaw) ?? new Date()

      return {
        id: `${a}-${b}`,
        token1,
        token2,
        zScore: z != null ? String(z) : undefined,
        correlation: corr != null ? String(corr) : undefined,
        cointegration: integ != null ? String(integ) : undefined,
        halfLife: hl != null ? String(hl) : undefined,
        volatility: vol != null ? String(vol) : undefined,
        sharpe: sh != null ? String(sh) : undefined,
        beta: bta != null ? String(bta) : undefined,
        reason: rsn != null ? String(rsn) : undefined,
        signal: sig != null ? String(sig) : undefined,
        confidence: conf != null ? String(conf) : undefined,
        riskLevel: risk != null ? String(risk) : undefined,
        entryRecommendation: entryRec != null ? String(entryRec) : undefined,
        timestamp: updatedDate,
        timeAgo: getTimeAgo(updatedDate.toISOString()),
        cached_at: updatedRaw,
      }
    }

    const fetchDaily = async () => {
      if (activeTab !== 'top' || dailySignals.length > 0) return
      try {
        setDailyLoading(true)
        setDailyError(null)

        const results = await Promise.allSettled(
          pairs.map(async ({ symbolA, symbolB }) => {
            const res = await fetch('https://pair-agentverse.onrender.com/api/analyze', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ symbolA, symbolB, limit: 200 }),
              cache: 'no-store',
            })
            if (!res.ok) throw new Error(`Analyze failed for ${symbolA}/${symbolB}`)
            const data = await res.json()
            // Some APIs return the summary under a field; try to unwrap common shapes
            const payload = data?.result ?? data?.data ?? data
            return transform(symbolA, symbolB, payload)
          })
        )

        const ok = results
          .filter((r): r is PromiseFulfilledResult<DailySignal> => r.status === 'fulfilled')
          .map((r) => r.value)

        // Sort by absolute zScore desc if present, otherwise leave order
        ok.sort((a, b) => {
          const az = a.zScore != null ? Math.abs(parseFloat(a.zScore)) : -Infinity
          const bz = b.zScore != null ? Math.abs(parseFloat(b.zScore)) : -Infinity
          if (az === bz) return 0
          return bz - az
        })

        setDailySignals(ok)
      } catch (e: any) {
        setDailyError(e?.message || 'Failed to load top daily signals')
      } finally {
        setDailyLoading(false)
      }
    }

    fetchDaily()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab])

  // Filter signals based on active tab, search query, and filters
  const filteredSignals = signals.filter((signal) => {
    // Search filter
    const matchesSearch =
      signal.token1.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
      signal.token2.symbol.toLowerCase().includes(searchQuery.toLowerCase())

    // Tab filter
    const matchesTab =
      activeTab === "live"
        ? signal.status === "open"
        : signal.status !== "open"

    // Update time filter
    let matchesUpdateTime = true
    if (!updateFilters.allTime && signal.timestamp) {
      const now = new Date()
      const signalTime = signal.timestamp
      const diffHours = (now.getTime() - signalTime.getTime()) / (1000 * 60 * 60)

      if (updateFilters.oneDay && diffHours <= 24) {
        matchesUpdateTime = true
      } else if (updateFilters.oneWeek && diffHours <= 168) {
        matchesUpdateTime = true
      } else if (!updateFilters.oneDay && !updateFilters.oneWeek) {
        matchesUpdateTime = false
      }
    }

    // Timeframe filter (based on half-life)
    let matchesTimeframe = true
    if (!timeframeFilters.allTimeframes) {
      const halfLifeDays = parseFloat(signal.halfLife)

      if (timeframeFilters.oneHour && halfLifeDays <= 0.042) { // ~1 hour in days
        matchesTimeframe = true
      } else if (timeframeFilters.oneDay && halfLifeDays <= 1) {
        matchesTimeframe = true
      } else if (!timeframeFilters.oneHour && !timeframeFilters.oneDay) {
        matchesTimeframe = false
      }
    }

    return matchesSearch && matchesTab && matchesUpdateTime && matchesTimeframe
  })

  // Handle opening position - check if pair is supported
  const handleOpenPosition = (signal: SignalData) => {
    const longSymbol = signal.token1.symbol
    const shortSymbol = signal.token2.symbol

    // Check if both tokens are supported
    const isSupported = SUPPORTED_TOKENS.includes(longSymbol) && SUPPORTED_TOKENS.includes(shortSymbol)

    if (isSupported) {
      // Redirect to trade page with the pair
      router.push(`/Trade?pair=${longSymbol}-${shortSymbol}`)
    } else {
      // Show purple-themed toast
      toast.error('Token pair not supported', {
        duration: 3000,
        style: {
          background: '#2a1a3a',
          color: '#fff',
          border: '1px solid #A855F7',
          borderRadius: '0.75rem',
          padding: '12px 16px',
        },
        iconTheme: {
          primary: '#A855F7',
          secondary: '#fff',
        },
      })
    }
  }

  return (
    <div className="w-full min-h-screen">
      {/* Toast Container */}
      <Toaster
        position="bottom-right"
        toastOptions={{
          duration: 3000,
          style: {
            background: '#2a1a3a',
            color: '#fff',
            border: '1px solid #A855F7',
          },
        }}
      />
      {/* Header */}
      <div className="max-w-4xl mx-auto px-4 pt-4 md:pt-8 pb-6 md:pb-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 md:mb-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-black rounded-full flex items-center justify-center shadow-lg shadow-purple-500/30 overflow-hidden">
              <Image src="/AgentLogo.png" alt="Agent Pear" width={48} height={48} className="w-full h-full object-cover" />
            </div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl sm:text-3xl font-bold text-white">Agent Elara</h1>
              <span className="px-2 sm:px-2.5 py-1 bg-purple-600/20 border border-purple-600/40 rounded-md text-purple-400 text-xs font-semibold">
                v1.0
              </span>
            </div>
          </div>
          <button
            onClick={() => setShowMetricsModal(true)}
            className="flex-shrink-0 px-4 py-2 rounded-lg bg-purple-600/10 border border-purple-600/30 text-purple-400 font-semibold text-sm hover:bg-purple-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 20V10M12 20V4M6 20v-6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            See Metrics
          </button>
        </div>

        {/* Tabs and Search */}
        <div className="flex flex-col gap-4 mb-6">
          {/* Tabs */}
          <div className="flex items-center gap-4 sm:gap-6">
            <button
              onClick={() => setActiveTab("live")}
              className={`relative pb-3 font-semibold transition-colors text-sm sm:text-base cursor-pointer ${activeTab === "live" ? "text-white" : "text-gray-500 hover:text-gray-300"
                }`}
            >
              <span className="hidden sm:inline">Live Signals</span>
              <span className="sm:hidden">Live</span>{" "}
              <span
                className={`ml-1 sm:ml-2 ${activeTab === "live" ? "text-purple-400" : "text-gray-600"}`}
              >
                {signals.filter(s => s.status === "open").length}
              </span>
              {activeTab === "live" && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-purple-400 to-purple-600" />
              )}
            </button>
            <button
              onClick={() => setActiveTab("history")}
              className={`relative pb-3 font-semibold transition-colors text-sm sm:text-base cursor-pointer ${activeTab === "history" ? "text-white" : "text-gray-500 hover:text-gray-300"
                }`}
            >
              <span className="hidden sm:inline">Signal History</span>
              <span className="sm:hidden">History</span>
              {activeTab === "history" && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-purple-400 to-purple-600" />
              )}
            </button>
            <button
              onClick={() => setActiveTab("top")}
              className={`relative pb-3 font-semibold transition-colors text-sm sm:text-base cursor-pointer ${activeTab === "top" ? "text-white" : "text-gray-500 hover:text-gray-300"
                }`}
            >
              <span className="hidden sm:inline">Top Tokens Daily Signals</span>
              <span className="sm:hidden">Top</span>
              {activeTab === "top" && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-purple-400 to-purple-600" />
              )}
            </button>
          </div>

          {/* Filters and Search */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
            <button
              onClick={() => setShowFilterModal(true)}
              className="flex-shrink-0 px-4 py-2 rounded-lg bg-purple-600/10 border border-purple-600/30 text-purple-400 font-semibold text-sm hover:bg-purple-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Filters
            </button>
            <div className="relative flex-1 sm:flex-initial">
              <input
                type="text"
                placeholder="Search Pairs"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full sm:w-64 px-4 py-2 pl-10 rounded-lg bg-gray-900/50 border border-gray-700 text-white placeholder-gray-500 focus:outline-none focus:border-purple-600/50 transition-all text-sm"
              />
              <svg
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="11" cy="11" r="8" strokeLinecap="round" strokeLinejoin="round" />
                <path d="m21 21-4.35-4.35" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Signals List */}
      <div className="max-w-4xl mx-auto px-4 pb-16">
        {/* Error State */}
        {error && (
          <div className="text-center py-16">
            <div className="text-red-500 text-lg mb-2">Error loading signals</div>
            <div className="text-gray-600 text-sm">{error}</div>
          </div>
        )}

        {/* Loading Skeleton */}
        {loading && !error && (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="w-full bg-black/40 backdrop-blur-sm rounded-xl flex flex-col p-6 gap-3 border border-gray-800/50 animate-pulse"
              >
                {/* Header Skeleton */}
                <div className="flex flex-row justify-between items-center w-full">
                  {/* Token badges skeleton */}
                  <div className="flex flex-row items-center max-w-[180px]">
                    <div className="flex flex-row items-center gap-3 justify-center px-4 py-2 bg-green-500/20 rounded-l-lg h-10 w-20">
                      <div className="w-4 h-4 bg-gray-700 rounded-full" />
                      <div className="h-3 w-8 bg-gray-700 rounded" />
                    </div>
                    <div className="flex flex-row items-center gap-3 justify-center px-4 py-2 bg-red-500/20 rounded-r-lg h-10 w-20">
                      <div className="w-4 h-4 bg-gray-700 rounded-full" />
                      <div className="h-3 w-8 bg-gray-700 rounded" />
                    </div>
                  </div>

                  {/* Time skeleton */}
                  <div className="h-3 w-20 bg-gray-700 rounded" />
                </div>

                {/* Metrics Container Skeleton */}
                <div className="w-full flex flex-col p-2 bg-[#0F110F] rounded-lg gap-2">
                  {[1, 2, 3, 4, 5, 6, 7, 8].map((j) => (
                    <div key={j} className="w-full flex flex-row justify-between">
                      <div className="h-3 w-24 bg-gray-700 rounded" />
                      <div className="h-3 w-16 bg-gray-700 rounded" />
                    </div>
                  ))}
                </div>

                {/* Action Button Skeleton */}
                <div className="w-full h-9 bg-gray-700 rounded-lg" />
              </div>
            ))}
          </div>
        )}

        {/* Signals List: Live / History */}
        {!loading && !error && activeTab !== 'top' && (
          <div className="space-y-3">
            {filteredSignals.map((signal) => (
              <div
                key={signal.id}
                className="group w-full bg-black/40 backdrop-blur-sm cursor-pointer rounded-xl flex flex-col p-6 gap-3 border border-gray-800/50 hover:border-purple-600/30 transition-all"
              >
                {/* Header */}
                <div className="flex flex-col gap-3">
                  <div className="flex flex-row justify-between items-center w-full">
                    {/* Token badges */}
                    <div className="flex flex-row items-center flex-shrink-0">
                      <div className="flex flex-row items-center gap-2 sm:gap-3 justify-center px-2 sm:px-4 py-2 bg-green-500/20 rounded-l-lg">
                        <div
                          className={`w-3 h-3 sm:w-4 sm:h-4 ${signal.token1.color} rounded-full flex items-center justify-center text-white font-bold text-[8px] sm:text-[10px]`}
                        >
                          {signal.token1.icon}
                        </div>
                        <p className="text-xs font-bold text-white">{signal.token1.symbol}</p>
                      </div>
                      <div className="flex flex-row items-center gap-2 sm:gap-3 justify-center px-2 sm:px-4 py-2 bg-red-500/20 rounded-r-lg">
                        <div
                          className={`w-3 h-3 sm:w-4 sm:h-4 ${signal.token2.color} rounded-full flex items-center justify-center text-white font-bold text-[8px] sm:text-[10px]`}
                        >
                          {signal.token2.icon}
                        </div>
                        <p className="text-xs font-bold text-white">{signal.token2.symbol}</p>
                      </div>
                    </div>

                    {/* Time */}
                    <span className="text-xs font-bold text-white text-right ml-2">{signal.timeAgo}</span>
                  </div>
                </div>

                {/* Metrics Container */}
                <div className="w-full flex flex-col p-2 bg-black/50 rounded-lg gap-2 border border-gray-700/30">
                  <div className="w-full flex flex-row justify-between">
                    <span className="text-xs font-medium text-[#A0A0A0]">Signal:</span>
                    <span className="text-xs font-bold">{renderSignalDisplay(signal.signal, signal.token1, signal.token2)}</span>
                  </div>
                  <div className="w-full flex flex-row justify-between">
                    <span className="text-xs font-medium text-[#A0A0A0]">Price:</span>
                    <span className="text-xs font-bold text-white">{signal.price}</span>
                  </div>
                  <div className="w-full flex flex-row justify-between">
                    <span className="text-xs font-medium text-[#A0A0A0]">Entry Price:</span>
                    <span className="text-xs font-bold text-white">{signal.entryPrice}</span>
                  </div>
                  <div className="w-full flex flex-row justify-between">
                    <span className="text-xs font-medium text-[#A0A0A0]">Performance:</span>
                    <span className={`text-xs font-bold ${parseFloat(signal.performance) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {signal.performance}
                    </span>
                  </div>
                  <div className="w-full flex flex-row justify-between">
                    <span className="text-xs font-medium text-[#A0A0A0]">Correlation:</span>
                    <span className="text-xs font-bold text-white">{signal.correlation}</span>
                  </div>
                  <div className="w-full flex flex-row justify-between">
                    <span className="text-xs font-medium text-[#A0A0A0]">Z-Score:</span>
                    <span className="text-xs font-bold text-white">{signal.rollingZScore}</span>
                  </div>
                  <div className="w-full flex flex-row justify-between">
                    <span className="text-xs font-medium text-[#A0A0A0]">Half-Life:</span>
                    <span className="text-xs font-bold text-white">{signal.halfLife}</span>
                  </div>
                  <div className="w-full flex flex-row justify-between">
                    <span className="text-xs font-medium text-[#A0A0A0]">Co-integration:</span>
                    <span className="text-xs font-bold text-white">{signal.cointegration}</span>
                  </div>
                  <div className="w-full flex flex-row justify-between">
                    <span className="text-xs font-medium text-[#A0A0A0]">Trading Engine:</span>
                    <span className="text-xs font-bold text-purple-400">{signal.tradingEngine}</span>
                  </div>
                  <div>
                    <span className="text-xs font-medium text-[#A0A0A0]">Open Reason:</span>
                    <div className="mt-1 p-2 bg-gray-800/30 rounded-lg">{signal.reason}</div>
                  </div>
                </div>

                {/* Action Button */}
                <button
                  onClick={() => handleOpenPosition(signal)}
                  className="w-full py-2.5 rounded-lg bg-gradient-to-r from-purple-500 to-purple-600 text-white font-bold text-xs hover:from-purple-600 hover:to-purple-700 transition-all shadow-lg hover:shadow-purple-500/50 cursor-pointer"
                >
                  Open Position
                </button>
              </div>
            ))}

            {/* Empty State */}
            {filteredSignals.length === 0 && (
              <div className="text-center py-16">
                <div className="text-gray-500 text-lg mb-2">No signals found</div>
                <div className="text-gray-600 text-sm">Try adjusting your search or filters</div>
              </div>
            )}
          </div>
        )}

        {/* Top Daily Signals */}
        {activeTab === 'top' && (
          <div className="space-y-3">
            {/* Error State */}
            {dailyError && (
              <div className="text-center py-16">
                <div className="text-red-500 text-lg mb-2">Error loading daily signals</div>
                <div className="text-gray-600 text-sm">{dailyError}</div>
              </div>
            )}

            {/* Loading Skeleton */}
            {dailyLoading && !dailyError && (
              <div className="space-y-3">
                {[1,2,3].map((i) => (
                  <div key={i} className="w-full bg-black/40 backdrop-blur-sm rounded-xl flex flex-col p-6 gap-3 border border-gray-800/50 animate-pulse">
                    <div className="flex flex-row justify-between items-center w-full">
                      <div className="flex flex-row items-center max-w-[180px]">
                        <div className="flex flex-row items-center gap-3 justify-center px-4 py-2 bg-green-500/20 rounded-l-lg h-10 w-20">
                          <div className="w-4 h-4 bg-gray-700 rounded-full" />
                          <div className="h-3 w-8 bg-gray-700 rounded" />
                        </div>
                        <div className="flex flex-row items-center gap-3 justify-center px-4 py-2 bg-red-500/20 rounded-r-lg h-10 w-20">
                          <div className="w-4 h-4 bg-gray-700 rounded-full" />
                          <div className="h-3 w-8 bg-gray-700 rounded" />
                        </div>
                      </div>
                      <div className="h-3 w-20 bg-gray-700 rounded" />
                    </div>
                    <div className="w-full flex flex-col p-2 bg-[#0F110F] rounded-lg gap-2">
                      {[1,2,3,4,5,6,7,8].map((j) => (
                        <div key={j} className="w-full flex flex-row justify-between">
                          <div className="h-3 w-24 bg-gray-700 rounded" />
                          <div className="h-3 w-16 bg-gray-700 rounded" />
                        </div>
                      ))}
                    </div>
                    <div className="w-full h-9 bg-gray-700 rounded-lg" />
                  </div>
                ))}
              </div>
            )}

            {!dailyLoading && !dailyError && dailySignals.map((signal) => (
              <div
                key={signal.id}
                className="group w-full bg-black/40 backdrop-blur-sm cursor-pointer rounded-xl flex flex-col p-6 gap-3 border border-gray-800/50 hover:border-purple-600/30 transition-all"
              >
                {/* Header */}
                <div className="flex flex-col gap-3">
                  <div className="flex flex-row justify-between items-center w-full">
                    <div className="flex flex-row items-center flex-shrink-0">
                      <div className="flex flex-row items-center gap-2 sm:gap-3 justify-center px-2 sm:px-4 py-2 bg-green-500/20 rounded-l-lg">
                        <div className={`w-3 h-3 sm:w-4 sm:h-4 ${signal.token1.color} rounded-full flex items-center justify-center text-white font-bold text-[8px] sm:text-[10px]`}>
                          {signal.token1.icon}
                        </div>
                        <p className="text-xs font-bold text-white">{signal.token1.symbol}</p>
                      </div>
                      <div className="flex flex-row items-center gap-2 sm:gap-3 justify-center px-2 sm:px-4 py-2 bg-red-500/20 rounded-r-lg">
                        <div className={`w-3 h-3 sm:w-4 sm:h-4 ${signal.token2.color} rounded-full flex items-center justify-center text-white font-bold text-[8px] sm:text-[10px]`}>
                          {signal.token2.icon}
                        </div>
                        <p className="text-xs font-bold text-white">{signal.token2.symbol}</p>
                      </div>
                    </div>
                    <span className="text-xs font-bold text-white text-right ml-2">
                      {(() => {
                        const d = toValidDate(signal.cached_at) || (signal.timestamp instanceof Date ? signal.timestamp : null)
                        return d ? getTimeAgo(d.toISOString()) : (signal.timeAgo || '')
                      })()}
                    </span>
                  </div>
                </div>

                {/* Metrics */}
                <div className="w-full flex flex-col p-2 bg-black/50 rounded-lg gap-2 border border-gray-700/30">
                  <div className="w-full flex flex-row justify-between">
                    <span className="text-xs font-medium text-[#A0A0A0]">Signal:</span>
                    <span className="text-xs font-bold">{renderSignalDisplay(signal.signal, signal.token1, signal.token2)}</span>
                  </div>
                  <div>
                    <div className="w-full flex flex-row justify-between">
                      <span className="text-xs font-medium text-[#A0A0A0]">AI Reasoning model:</span>
                      <span className="text-xs font-bold text-white">Qwen3 Max</span>
                    </div>
                  </div>

                  <div className="w-full flex flex-row justify-between">
                    <span className="text-xs font-medium text-[#A0A0A0]">Confidence:</span>
                    <span className={`text-xs font-bold ${getConfidenceClass(signal.confidence)}`}>
                      {signal.confidence != null ? (() => {
                        const v = parseFloat(signal.confidence)
                        if (isNaN(v)) return signal.confidence
                        const pct = v <= 1 ? v * 100 : v
                        return `${pct.toFixed(0)}%`
                      })() : 'N/A'}
                    </span>
                  </div>
                  <div className="w-full flex flex-row justify-between">
                    <span className="text-xs font-medium text-[#A0A0A0]">Risk:</span>
                    <span className={`text-xs font-bold ${getRiskClass(signal.riskLevel)}`}>{signal.riskLevel ?? 'N/A'}</span>
                  </div>
                  <div className="w-full flex flex-row justify-between">
                    <span className="text-xs font-medium text-[#A0A0A0]">Z-Score:</span>
                    <span className="text-xs font-bold text-white">{signal.zScore ?? 'N/A'}</span>
                  </div>
                  <div className="w-full flex flex-row justify-between">
                    <span className="text-xs font-medium text-[#A0A0A0]">Correlation:</span>
                    <span className="text-xs font-bold text-white">{signal.correlation ?? 'N/A'}</span>
                  </div>
                  {/* <div className="w-full flex flex-row justify-between">
                    <span className="text-xs font-medium text-[#A0A0A0]">Half-Life:</span>
                    <span className="text-xs font-bold text-white">{signal.halfLife ?? 'N/A'}</span>
                  </div> */}
                  {/* <div className="w-full flex flex-row justify-between">
                    <span className="text-xs font-medium text-[#A0A0A0]">Co-integration:</span>
                    <span className="text-xs font-bold text-white">{signal.cointegration ?? 'Unknown'}</span>
                  </div> */}
                  {/* <div className="w-full flex flex-row justify-between">
                    <span className="text-xs font-medium text-[#A0A0A0]">Volatility:</span>
                    <span className="text-xs font-bold text-white">{signal.volatility ?? 'N/A'}</span>
                  </div> */}
                  {/* <div className="w-full flex flex-row justify-between">
                    <span className="text-xs font-medium text-[#A0A0A0]">Sharpe:</span>
                    <span className="text-xs font-bold text-white">{signal.sharpe ?? 'N/A'}</span>
                  </div> */}
                  <div className="w-full flex flex-row justify-between">
                    <span className="text-xs font-medium text-[#A0A0A0]">Beta:</span>
                    <span className="text-xs font-bold text-white">{signal.beta ?? 'N/A'}</span>
                  </div>
                  {signal.entryRecommendation && (
                    <div>
                      <span className="text-xs font-medium text-[#A0A0A0]">Entry Recommendation:</span>
                      <div className="mt-1 p-2 bg-gray-800/30 rounded-lg">{signal.entryRecommendation}</div>
                    </div>
                  )}
                  {signal.reason && (
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-[#A0A0A0]">Reason:</span>
                        <button
                          onClick={() => setExpandedReason((prev) => ({ ...prev, [signal.id]: !prev[signal.id] }))}
                          className="text-[10px] sm:text-xs text-purple-400 hover:text-purple-300 font-semibold cursor-pointer"
                        >
                          {expandedReason[signal.id] ? 'Show less' : 'Show more'}
                        </button>
                      </div>
                      <div className="mt-1 p-2 bg-gray-800/30 rounded-lg text-xs text-white whitespace-pre-wrap">
                        {expandedReason[signal.id]
                          ? signal.reason
                          : (signal.reason.length > 180 ? `${signal.reason.slice(0, 180)}…` : signal.reason)}
                      </div>
                    </div>
                  )}
                </div>

                <button
                  onClick={() => handleOpenPosition({
                    id: signal.id,
                    token1: signal.token1,
                    token2: signal.token2,
                    price: '-',
                    entryPrice: '-',
                    performance: '0%',
                    correlation: signal.correlation || '-',
                    cointegration: signal.cointegration || '-',
                    halfLife: signal.halfLife || '-',
                    rollingZScore: signal.zScore || '-',
                    tradingEngine: 'AGENTVERSE',
                    timeAgo: signal.timeAgo || '-',
                    spread: '-',
                    volatility: signal.volatility || '-',
                    sharpe: signal.sharpe || '-',
                    beta: signal.beta || '-',
                    reason: signal.reason || '-',
                    status: 'open',
                    timestamp: signal.timestamp || new Date(),
                    closeReason: '',
                  } as unknown as SignalData)}
                  className="w-full py-2.5 rounded-lg bg-gradient-to-r from-purple-500 to-purple-600 text-white font-bold text-xs hover:from-purple-600 hover:to-purple-700 transition-all shadow-lg hover:shadow-purple-500/50 cursor-pointer"
                >
                  Open Position
                </button>
              </div>
            ))}

            {!dailyLoading && !dailyError && dailySignals.length === 0 && (
              <div className="text-center py-16">
                <div className="text-gray-500 text-lg mb-2">No daily signals found</div>
                <div className="text-gray-600 text-sm">Try again later</div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Filter Modal */}
      {showFilterModal && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/50 z-40"
            onClick={() => setShowFilterModal(false)}
          />

          {/* Modal */}
          <div className="fixed left-1/2 top-1/2 z-50 max-w-lg -translate-x-1/2 -translate-y-1/2 border shadow-lg duration-200 rounded-lg sm:rounded-xl dark:border-neutral-800 dark:bg-neutral-950 w-[90%] max-w-[480px] p-4 sm:p-6 bg-[#0F110F] border-[#212621] overflow-hidden flex flex-col gap-0 max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-[#212621] pb-4">
              <div className="flex flex-row gap-2 items-center">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-purple-400">
                  <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <h1 className="text-white font-semibold text-xl">Filters</h1>
              </div>
              <button
                onClick={() => setShowFilterModal(false)}
                className="inline-flex items-center justify-center whitespace-nowrap text-sm font-medium transition-colors bg-white/10 rounded w-7 h-7 text-white hover:text-white hover:bg-white/20 p-1"
              >
                <svg stroke="currentColor" fill="currentColor" strokeWidth="0" viewBox="0 0 24 24" className="h-5 w-5" height="1em" width="1em" xmlns="http://www.w3.org/2000/svg">
                  <path d="M11.9997 10.5865L16.9495 5.63672L18.3637 7.05093L13.4139 12.0007L18.3637 16.9504L16.9495 18.3646L11.9997 13.4149L7.04996 18.3646L5.63574 16.9504L10.5855 12.0007L5.63574 7.05093L7.04996 5.63672L11.9997 10.5865Z"></path>
                </svg>
              </button>
            </div>

            {/* Body */}
            <div className="flex flex-col gap-4 mt-4">
              {/* Updates Section */}
              <div className="bg-[#121512] rounded-lg p-2">
                <p className="w-full text-gray-400 text-xs font-semibold pb-2 border-b border-[#222822]">Updates</p>
                <div className="flex gap-2 p-2">
                  <div className="flex items-center space-x-2 flex-1 p-2">
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={updateFilters.allTime}
                      onClick={() => setUpdateFilters({ ...updateFilters, allTime: !updateFilters.allTime })}
                      className={`h-4 w-4 shrink-0 rounded-sm border shadow ${updateFilters.allTime ? 'bg-purple-500 border-purple-500' : 'bg-[#202919] border-purple-500'
                        }`}
                    >
                      {updateFilters.allTime && (
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 text-black">
                          <path d="M20 6 9 17l-5-5"></path>
                        </svg>
                      )}
                    </button>
                    <label className="text-xs text-gray-400 cursor-pointer font-medium text-white">All Time</label>
                  </div>
                  <div className="flex items-center space-x-2 flex-1 p-2">
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={updateFilters.oneDay}
                      onClick={() => setUpdateFilters({ ...updateFilters, oneDay: !updateFilters.oneDay })}
                      className={`h-4 w-4 shrink-0 rounded-sm border shadow ${updateFilters.oneDay ? 'bg-purple-500 border-purple-500' : 'bg-[#202919] border-purple-500'
                        }`}
                    >
                      {updateFilters.oneDay && (
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 text-black">
                          <path d="M20 6 9 17l-5-5"></path>
                        </svg>
                      )}
                    </button>
                    <label className="text-xs text-gray-400 cursor-pointer font-medium">1d</label>
                  </div>
                  <div className="flex items-center space-x-2 flex-1 p-2">
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={updateFilters.oneWeek}
                      onClick={() => setUpdateFilters({ ...updateFilters, oneWeek: !updateFilters.oneWeek })}
                      className={`h-4 w-4 shrink-0 rounded-sm border shadow ${updateFilters.oneWeek ? 'bg-purple-500 border-purple-500' : 'bg-[#202919] border-purple-500'
                        }`}
                    >
                      {updateFilters.oneWeek && (
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 text-black">
                          <path d="M20 6 9 17l-5-5"></path>
                        </svg>
                      )}
                    </button>
                    <label className="text-xs text-gray-400 cursor-pointer font-medium">1w</label>
                  </div>
                </div>
              </div>

              {/* Timeframe Section */}
              <div className="bg-[#121512] rounded-lg p-2">
                <p className="w-full text-gray-400 text-xs font-semibold pb-2 border-b border-[#222822]">Timeframe</p>
                <div className="flex gap-2 p-2">
                  <div className="flex items-center space-x-2 flex-1 p-2">
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={timeframeFilters.allTimeframes}
                      onClick={() => setTimeframeFilters({ ...timeframeFilters, allTimeframes: !timeframeFilters.allTimeframes })}
                      className={`h-4 w-4 shrink-0 rounded-sm border shadow ${timeframeFilters.allTimeframes ? 'bg-purple-500 border-purple-500' : 'bg-[#202919] border-purple-500'
                        }`}
                    >
                      {timeframeFilters.allTimeframes && (
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 text-black">
                          <path d="M20 6 9 17l-5-5"></path>
                        </svg>
                      )}
                    </button>
                    <label className="text-xs text-gray-400 cursor-pointer font-medium text-white">All Timeframes</label>
                  </div>
                  <div className="flex items-center space-x-2 flex-1 p-2">
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={timeframeFilters.oneHour}
                      onClick={() => setTimeframeFilters({ ...timeframeFilters, oneHour: !timeframeFilters.oneHour })}
                      className={`h-4 w-4 shrink-0 rounded-sm border shadow ${timeframeFilters.oneHour ? 'bg-purple-500 border-purple-500' : 'bg-[#202919] border-purple-500'
                        }`}
                    >
                      {timeframeFilters.oneHour && (
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 text-black">
                          <path d="M20 6 9 17l-5-5"></path>
                        </svg>
                      )}
                    </button>
                    <label className="text-xs text-gray-400 cursor-pointer font-medium">1h</label>
                  </div>
                  <div className="flex items-center space-x-2 flex-1 p-2">
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={timeframeFilters.oneDay}
                      onClick={() => setTimeframeFilters({ ...timeframeFilters, oneDay: !timeframeFilters.oneDay })}
                      className={`h-4 w-4 shrink-0 rounded-sm border shadow ${timeframeFilters.oneDay ? 'bg-purple-500 border-purple-500' : 'bg-[#202919] border-purple-500'
                        }`}
                    >
                      {timeframeFilters.oneDay && (
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 text-black">
                          <path d="M20 6 9 17l-5-5"></path>
                        </svg>
                      )}
                    </button>
                    <label className="text-xs text-gray-400 cursor-pointer font-medium">1d</label>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex flex-col sm:flex-row justify-end w-full gap-2 mt-4">
              <button
                onClick={() => {
                  setUpdateFilters({ allTime: true, oneDay: false, oneWeek: false })
                  setTimeframeFilters({ allTimeframes: true, oneHour: false, oneDay: false })
                }}
                className="px-4 h-[42px] bg-[#202919] text-purple-400 font-semibold text-sm rounded-lg py-3 flex gap-3 items-center justify-center hover:bg-[#2a2f2a] cursor-pointer"
              >
                <svg stroke="currentColor" fill="currentColor" strokeWidth="0" viewBox="0 0 512 512" className="h-4 w-4" height="1em" width="1em" xmlns="http://www.w3.org/2000/svg">
                  <path d="M256 388c-72.597 0-132-59.405-132-132 0-72.601 59.403-132 132-132 72.601 0 132 59.399 132 132 0 72.595-59.399 132-132 132zm0-217.992c-47.349 0-85.993 38.643-85.993 85.992 0 47.348 38.645 85.992 85.993 85.992s85.993-38.645 85.993-85.992c0-47.349-38.645-85.992-85.993-85.992zm113.097-2.656c5.838-5.838 5.838-15.34 0-21.177l-45.251-45.255c-5.838-5.838-15.34-5.838-21.177 0l-22.626 22.627c-5.838 5.838-5.838 15.34 0 21.177l45.255 45.251c5.838 5.838 15.339 5.838 21.177 0l22.622-22.623zM256 0C114.846 0 0 114.846 0 256s114.846 256 256 256 256-114.846 256-256S397.154 0 256 0zm0 472c-119.103 0-216-96.897-216-216S136.897 40 256 40s216 96.897 216 216-96.897 216-216 216z"></path>
                </svg>
                <p>Reset</p>
              </button>
              <button
                onClick={() => setShowFilterModal(false)}
                className="px-4 h-[42px] bg-purple-500 text-white font-semibold text-sm rounded-lg py-3 hover:bg-purple-600 flex-1 sm:flex-[2] cursor-pointer"
              >
                <p>Apply</p>
              </button>
            </div>
          </div>
        </>
      )}

      {/* Metrics Modal */}
      {showMetricsModal && performanceMetrics && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/50 z-40"
            onClick={() => setShowMetricsModal(false)}
          />

          {/* Modal */}
          <div className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 w-[90%] max-w-[400px] h-fit rounded-2xl bg-[#0F110F] p-4 sm:p-6 max-h-[90vh] overflow-y-auto">
            {/* Close Button */}
            <button
              onClick={() => setShowMetricsModal(false)}
              className="absolute top-4 right-4 inline-flex items-center justify-center whitespace-nowrap text-sm font-medium transition-colors bg-white/10 rounded w-7 h-7 text-white hover:text-white hover:bg-white/20 p-1 z-10"
            >
              <svg stroke="currentColor" fill="currentColor" strokeWidth="0" viewBox="0 0 24 24" className="h-5 w-5" height="1em" width="1em" xmlns="http://www.w3.org/2000/svg">
                <path d="M11.9997 10.5865L16.9495 5.63672L18.3637 7.05093L13.4139 12.0007L18.3637 16.9504L16.9495 18.3646L11.9997 13.4149L7.04996 18.3646L5.63574 16.9504L10.5855 12.0007L5.63574 7.05093L7.04996 5.63672L11.9997 10.5865Z"></path>
              </svg>
            </button>

            {/* Agent Pear Avatar */}
            <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full overflow-hidden bg-black">
              <Image src="/AgentLogo.png" alt="Agent Pear" width={64} height={64} className="w-full h-full object-cover" />
            </div>

            {/* Header */}
            <div className="flex flex-col mt-3 sm:mt-4">
              <h1 className="text-xl sm:text-2xl font-semibold text-white">Trade Signal Metrics</h1>
              <p className="text-xs sm:text-sm font-medium text-[#A0A0A0]">Performance Metrics for all trade signals shared</p>
            </div>

            {/* Metrics */}
            <div className="flex flex-col p-3 sm:p-4 mt-3 bg-[#151815] rounded-lg gap-2">
              <div className="flex items-center justify-between">
                <span className="text-[#A0A0A0] text-[10px] sm:text-xs">Total trades</span>
                <span className="text-white text-[10px] sm:text-xs font-semibold">{performanceMetrics.totalTrades}</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-[#A0A0A0] text-[10px] sm:text-xs">Open trades</span>
                <span className="text-white text-[10px] sm:text-xs font-semibold">{performanceMetrics.openTrades}</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-[#A0A0A0] text-[10px] sm:text-xs">Closed trades</span>
                <span className="text-white text-[10px] sm:text-xs font-semibold">{performanceMetrics.closedTrades}</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-[#A0A0A0] text-[10px] sm:text-xs">Winning trades</span>
                <span className="text-green-400 text-[10px] sm:text-xs font-semibold">{performanceMetrics.winningTrades}</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-[#A0A0A0] text-[10px] sm:text-xs">Losing trades</span>
                <span className="text-red-400 text-[10px] sm:text-xs font-semibold">{performanceMetrics.losingTrades}</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-[#A0A0A0] text-[10px] sm:text-xs">Win rate</span>
                <span className="text-white text-[10px] sm:text-xs font-semibold">
                  {performanceMetrics.winRate != null ? `${Number(performanceMetrics.winRate).toFixed(2)}%` : 'N/A'}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-[#A0A0A0] text-[10px] sm:text-xs">Total Return (no leverage)</span>
                <span className={`text-[10px] sm:text-xs font-semibold ${performanceMetrics.totalReturnWithoutLeverage >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {performanceMetrics.totalReturnWithoutLeverage != null ? `${Number(performanceMetrics.totalReturnWithoutLeverage).toFixed(4)}%` : 'N/A'}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-[#A0A0A0] text-[10px] sm:text-xs">Total Return (2x leverage)</span>
                <span className={`text-[10px] sm:text-xs font-semibold ${performanceMetrics.totalReturnWithLeverage >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {performanceMetrics.totalReturnWithLeverage != null ? `${Number(performanceMetrics.totalReturnWithLeverage).toFixed(4)}%` : 'N/A'}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-[#A0A0A0] text-[10px] sm:text-xs">Profit Factor</span>
                <span className="text-white text-[10px] sm:text-xs font-semibold">
                  {performanceMetrics.profitFactor != null ? Number(performanceMetrics.profitFactor).toFixed(2) : 'N/A'}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-[#A0A0A0] text-[10px] sm:text-xs">Average Duration</span>
                <span className="text-white text-[10px] sm:text-xs font-semibold">
                  {performanceMetrics.avgDuration != null
                    ? (performanceMetrics.avgDuration >= 1
                      ? `${performanceMetrics.avgDuration.toFixed(2)}d`
                      : `${(performanceMetrics.avgDuration * 24).toFixed(2)}h`)
                    : 'N/A'
                  }
                </span>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export default Agent

