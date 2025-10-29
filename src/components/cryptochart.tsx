"use client";

import { Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";

// Popular cryptocurrency symbols for easy access
const POPULAR_CRYPTOS = [
  { symbol: "BTCUSD", name: "Bitcoin" },
  { symbol: "ETHUSD", name: "Ethereum" },
  { symbol: "BNBUSD", name: "BNB" },
  { symbol: "SOLUSD", name: "Solana" },
  { symbol: "ADAUSD", name: "Cardano" },
  { symbol: "XRPUSD", name: "XRP" },
  { symbol: "DOTUSD", name: "Polkadot" },
  { symbol: "AVAXUSD", name: "Avalanche" },
];

export default function CryptoChart() {
  // State management
  const [currentSymbol, setCurrentSymbol] = useState("BTCUSD");
  
  const [searchTerm, setSearchTerm] = useState("");
  const [isScriptLoaded, setIsScriptLoaded] = useState(false);

  // Refs for DOM elements
  const chartContainerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const widgetRef = useRef<any>(null);

  // Load TradingView script only once
  useEffect(() => {
    // Only run on client-side
    if (typeof window === 'undefined') return;
    
    // Check if script is already loaded
    if (window.TradingView) {
      setIsScriptLoaded(true);
      return;
    }

    // Create and load the TradingView script
    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/tv.js";
    script.async = true;
    script.onload = () => {
      setIsScriptLoaded(true);
    };
    document.head.appendChild(script);

    // Cleanup function
    return () => {
      // Only remove if we added it
      if (script.parentNode) {
        script.parentNode.removeChild(script);
      }
    };
  }, []);

  // Initialize or update the TradingView widget
  useEffect(() => {
    // Only run on client-side
    if (typeof window === 'undefined') return;
    if (!isScriptLoaded || !chartContainerRef.current) return;

    // Clear previous widget if it exists
    if (widgetRef.current) {
      widgetRef.current.remove();
    }
    // Clear the container
    chartContainerRef.current.innerHTML = "";

    // Create new widget
    widgetRef.current = new window.TradingView.widget({
      autosize: true,
      symbol: currentSymbol,
      container_id: chartContainerRef.current.id,
      interval: "1D",
      timezone: "Etc/UTC",
      theme: "light",
      style: "1",
      locale: "en",
      toolbar_bg: "#f1f3f6",
      enable_publishing: false,
      hide_top_toolbar: false,
      hide_legend: false,
      save_image: false,
    });

    // Cleanup function
    return () => {
      if (widgetRef.current) {
        widgetRef.current.remove();
        widgetRef.current = null;
      }
    };
  }, [isScriptLoaded, currentSymbol]);

  // Handle custom search
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchTerm.trim()) {
      // Ensure the symbol ends with USD for crypto pairs
      const symbol = searchTerm.toUpperCase().endsWith("USD")
        ? searchTerm.toUpperCase()
        : searchTerm.toUpperCase() + "USD";
      handleSymbolChange(symbol);
    }
  };

  // Handle symbol change
  const handleSymbolChange = (symbol: string) => {
    setCurrentSymbol(symbol.toUpperCase());
    setSearchTerm("");
  };

  

  return (
    <div className={`bg-white rounded-lg shadow-lg relative`}>
      {/* Header with controls */}
      <div className="bg-gray-100 p-4 border-b">
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          {/* Current symbol display */}
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-gray-800">
              {currentSymbol}
            </h2>
            <span className="text-sm text-gray-500">
              {POPULAR_CRYPTOS.find((crypto) => crypto.symbol === currentSymbol)
                ?.name || "Cryptocurrency"}
            </span>
          </div>

          {/* Controls */}
          <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
            {/* Search form */}
            <form
              onSubmit={handleSearchSubmit}
              className="flex items-center gap-2"
            >
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Enter crypto symbol"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm w-full sm:w-48"
                />
              </div>
              <button
                type="submit"
                className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors text-sm whitespace-nowrap"
              >
                Search
              </button>
            </form>

            {/* Fullscreen handled by TradingView toolbar */}
          </div>
        </div>

        {/* Popular crypto buttons */}
        <div className="flex flex-wrap gap-2 mt-4">
          {POPULAR_CRYPTOS.map((crypto) => (
            <button
              key={crypto.symbol}
              onClick={() => handleSymbolChange(crypto.symbol)}
              className={`px-3 py-1 rounded-full text-sm transition-colors ${
                currentSymbol === crypto.symbol
                  ? "bg-blue-500 text-white"
                  : "bg-gray-200 text-gray-700 hover:bg-gray-300"
              }`}
            >
              {crypto.name}
            </button>
          ))}
        </div>
      </div>

      {/* Chart container */}
      <div className={`bg-white h-[500px]`}>
        <div
          ref={chartContainerRef}
          id="tradingview-chart"
          className="w-full h-full"
        />
      </div>
    </div>
  );
}