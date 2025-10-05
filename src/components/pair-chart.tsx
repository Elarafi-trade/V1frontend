"use client";

import { useEffect, useMemo, useRef, useState } from "react";

export type SupportedToken = "SOL" | "BTC" | "ETH" | "JITO" | "JUP" | "DRIFT";

type PairChartProps = {
  longToken: SupportedToken;
  shortToken: SupportedToken;
  entryRatio?: number;
};

const TOKEN_TO_TV_SYMBOL: Record<SupportedToken, string> = {
  BTC: "COINBASE:BTCUSD",
  ETH: "COINBASE:ETHUSD",
  SOL: "COINBASE:SOLUSD",
  JITO: "MEXC:JITOUSDT",
  JUP: "MEXC:JUPUSDT",
  DRIFT: "MEXC:DRIFTUSDT",
};

export default function PairChart({ 
  longToken, 
  shortToken,
  entryRatio,
}: PairChartProps) {
  const [isScriptLoaded, setIsScriptLoaded] = useState(false);
  const [currentRatio, setCurrentRatio] = useState<number | null>(null);

  const chartContainerRef = useRef<HTMLDivElement>(null);
  const widgetRef = useRef<any>(null);

  const expressionSymbol = useMemo(() => {
    const longSym = TOKEN_TO_TV_SYMBOL[longToken];
    const shortSym = TOKEN_TO_TV_SYMBOL[shortToken];
    return `${longSym}/${shortSym}`;
  }, [longToken, shortToken]);

  useEffect(() => {
    if (window.TradingView) {
      setIsScriptLoaded(true);
      return;
    }
    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/tv.js";
    script.async = true;
    script.onload = () => setIsScriptLoaded(true);
    document.head.appendChild(script);
    return () => {
      if (script.parentNode) script.parentNode.removeChild(script);
    };
  }, []);

  useEffect(() => {
    if (!isScriptLoaded || !chartContainerRef.current) return;
    if (widgetRef.current) {
      widgetRef.current.remove();
    }
    chartContainerRef.current.innerHTML = "";
    widgetRef.current = new window.TradingView.widget({
      autosize: true,
      symbol: expressionSymbol,
      container_id: chartContainerRef.current.id,
      interval: "60",
      timezone: "Etc/UTC",
      theme: "dark",
      style: "1",
      locale: "en",
      toolbar_bg: "#0a0515",
      enable_publishing: false,
      hide_top_toolbar: false,
      hide_legend: false,
      hide_side_toolbar: false,
      save_image: false,
      backgroundColor: "#0a0515",
      studies_overrides: {},
      disabled_features: ["use_localstorage_for_settings", "header_widget"],
      enabled_features: ["study_templates"],
      loading_screen: { backgroundColor: "#0a0515", foregroundColor: "#0a0515" },
      overrides: {
        "paneProperties.background": "#0a0515",
        "paneProperties.backgroundType": "solid",
        "paneProperties.vertGridProperties.color": "#1a1a1a",
        "paneProperties.horzGridProperties.color": "#1a1a1a",
        "symbolWatermarkProperties.transparency": 90,
        "scalesProperties.textColor": "#AAA",
        "mainSeriesProperties.candleStyle.upColor": "#26a69a",
        "mainSeriesProperties.candleStyle.downColor": "#ef5350",
      },
    });

    // Note: We use custom overlay markers instead of TradingView's API
    // since createShape() is only available in paid TradingView plans

    return () => {
      if (widgetRef.current) {
        widgetRef.current.remove();
        widgetRef.current = null;
      }
    };
  }, [isScriptLoaded, expressionSymbol]);

  return (
    <div className="relative">
      {/* Custom Position Marker Overlay */}
      {entryRatio && (
        <div className="absolute top-20 right-8 z-20 flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-500/20 border border-emerald-500/40 backdrop-blur-sm">
          <div className="relative flex items-center justify-center">
            {/* Pulsing effect */}
            <div className="absolute w-8 h-8 bg-emerald-500/30 rounded-full animate-ping" />
            {/* Main circle */}
            <div className="relative w-8 h-8 bg-emerald-500 rounded-full flex items-center justify-center shadow-lg shadow-emerald-500/50">
              <span className="text-white font-bold text-sm">L</span>
            </div>
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-semibold text-emerald-400">Position Open</span>
            <span className="text-[10px] text-foreground/60">Entry: {entryRatio.toFixed(6)}</span>
          </div>
        </div>
      )}

      {/* Chart Container */}
      <div className="h-[560px] rounded-xl border border-border/60 bg-[#0a0515] overflow-hidden">
        <div ref={chartContainerRef} id="pair-tradingview-chart" className="w-full h-full" />
      </div>

      {/* Chart Description */}
      <div className="mt-2 px-4 py-2 rounded-lg bg-background/20 backdrop-blur-sm border border-border/30">
        <div className="flex items-center justify-between">
          <div className="text-xs text-foreground/60">
            Ratio Chart: <span className="text-foreground/80 font-medium">{longToken}/{shortToken}</span>
          </div>
          {currentRatio && (
            <div className="text-xs text-foreground/80">
              Current: <span className="font-mono font-semibold">{currentRatio.toFixed(6)}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


