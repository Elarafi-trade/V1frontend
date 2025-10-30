"use client"

import type React from "react"
import { useState, useEffect } from "react"

import Hyperspeed from "@/components/Hyperspeed"
import Image from "next/image"
import ElectricBorder from "@/components/ElectricBorder"
import TiltedCard from "@/components/TiltedCard"
// import ProfileCard from '@/components/ProfileCard';
import LogoLoop from "@/components/LogoLoop"

const Home: React.FC = () => {
  // Dynamic metrics state
  const [latency, setLatency] = useState(0.7)
  const [slippage, setSlippage] = useState(0.009)

  // Update metrics frequently
  useEffect(() => {
    const interval = setInterval(() => {
      setLatency(Number((0.5 + Math.random() * 0.5).toFixed(1)))
      setSlippage(Number((0.005 + Math.random() * 0.01).toFixed(4)))
    }, 1500) // Update every 1.5 seconds

    return () => clearInterval(interval)
  }, [])
  // Mock cryptocurrency pair data
  const cryptoPairsRow1 = [
    { pair: "BTC-SOL", price: "$707.13", change: "+405.78%", isPositive: true },
    { pair: "ETH-SOL", price: "$184.15", change: "+210.36%", isPositive: true },
    { pair: "DRIFT-SOL", price: "$88.05", change: "+690.68%", isPositive: true },
    { pair: "JITO-SOL", price: "$58.62", change: "+350.38%", isPositive: true },
    { pair: "JUP-SOL", price: "$129.77", change: "+412.46%", isPositive: true },
    { pair: "SOL-USDC", price: "$250.66", change: "+251.70%", isPositive: true },
  ]

  const cryptoPairsRow2 = [
    { pair: "BTC-ETH", price: "$103.75", change: "+195.23%", isPositive: true },
    { pair: "SOL-BTC", price: "$0.0024", change: "-15.42%", isPositive: false },
    { pair: "DRIFT-ETH", price: "$45.82", change: "+520.15%", isPositive: true },
    { pair: "JITO-BTC", price: "$0.0012", change: "+280.90%", isPositive: true },
    { pair: "JUP-ETH", price: "$67.33", change: "+175.68%", isPositive: true },
    { pair: "SOL-ETH", price: "$0.065", change: "+95.34%", isPositive: true },
  ]

  const cryptoPairsRow3 = [
    { pair: "BTC-USDC", price: "$107,828", change: "+145.67%", isPositive: true },
    { pair: "ETH-USDC", price: "$3,853", change: "+88.92%", isPositive: true },
    { pair: "DRIFT-USDC", price: "$1.85", change: "+620.45%", isPositive: true },
    { pair: "JITO-USDC", price: "$3.24", change: "+445.78%", isPositive: true },
    { pair: "JUP-USDC", price: "$1.12", change: "+290.33%", isPositive: true },
    { pair: "SOL-USDC", price: "$165.23", change: "+185.50%", isPositive: true },
  ]

  // Convert crypto pairs to LogoLoop format
  const createPairNodes = (pairs: typeof cryptoPairsRow1) => {
    return pairs.map((pairData) => ({
      node: (
        <div className="flex items-center justify-between gap-8 px-6 py-3 bg-black/40 backdrop-blur-sm rounded-xl border border-gray-800/50 min-w-[280px]">
          <span className="text-gray-400 font-semibold text-sm">{pairData.pair}</span>
          <span className={`font-semibold text-sm ${pairData.isPositive ? "text-green-400" : "text-red-400"}`}>
            {pairData.change}
          </span>
        </div>
      ),
    }))
  }
  return (
    <div className="w-full">
      {/* Hero Section with Hyperspeed Background */}
      <div className="relative w-full h-[calc(100vh-40px)] overflow-hidden">
        {/* Hyperspeed background - full screen */}
        <div className="absolute inset-0 w-full h-full">
          <Hyperspeed
            effectOptions={{
              onSpeedUp: () => {},
              onSlowDown: () => {},
              distortion: "turbulentDistortion",
              length: 400,
              roadWidth: 10,
              islandWidth: 2,
              lanesPerRoad: 4,
              fov: 90,
              fovSpeedUp: 150,
              speedUp: 2,
              carLightsFade: 0.4,
              totalSideLightSticks: 20,
              lightPairsPerRoadWay: 40,
              shoulderLinesWidthPercentage: 0.05,
              brokenLinesWidthPercentage: 0.1,
              brokenLinesLengthPercentage: 0.5,
              lightStickWidth: [0.12, 0.5],
              lightStickHeight: [1.3, 1.7],
              movingAwaySpeed: [60, 80],
              movingCloserSpeed: [-120, -160],
              carLightsLength: [400 * 0.03, 400 * 0.2],
              carLightsRadius: [0.05, 0.14],
              carWidthPercentage: [0.3, 0.5],
              carShiftX: [-0.8, 0.8],
              carFloorSeparation: [0, 5],
              colors: {
                roadColor: 0x080808,
                islandColor: 0x0a0a0a,
                background: 0x000000,
                shoulderLines: 0xffffff,
                brokenLines: 0xffffff,
                leftCars: [0xd856bf, 0x6750a2, 0xc247ac],
                rightCars: [0x03b3c3, 0x0e5ea5, 0x324555],
                sticks: 0x03b3c3,
              },
            }}
          />
        </div>

        {/* Hero Content Overlay */}
        <div className="relative z-10 flex flex-col items-center justify-center h-full px-4">
          <div className="max-w-4xl mx-auto text-center space-y-6">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-purple-600/40 bg-purple-600/10 backdrop-blur-sm mb-2">
              <span className="text-purple-300 text-xs font-medium tracking-wide">WE&apos;RE IN BETA</span>
            </div>

            {/* Main Heading */}
            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold leading-tight tracking-tight">
              <span className="text-purple-600">ElaraFi</span> <span className="text-white">Home of Pair Trading</span>
            </h1>

            {/* Subheading */}
            <p className="text-base md:text-lg text-gray-400 max-w-2xl mx-auto font-normal leading-relaxed">
              Experience pairs trading like never before. Powered by advanced AI agents and real-time market analytics.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-6">
              <a
                href="/Trade"
                className="px-6 py-3 rounded-full bg-purple-600 text-white font-semibold text-sm hover:bg-purple-500 transition-all shadow-lg hover:shadow-purple-500/50 cursor-pointer"
              >
                Start Trading
              </a>
              <button className="px-6 py-3 rounded-full border border-purple-600/40 bg-purple-600/5 backdrop-blur-sm text-white font-semibold text-sm hover:bg-purple-600/10 hover:border-purple-600/60 transition-all shadow-lg hover:shadow-purple-500/50 cursor-pointer">
                Learn More
              </button>
            </div>
          </div>
        </div>

        {/* Cards Section - Positioned at bottom of hero */}
      </div>

      {/* Content Below Hyperspeed - Add your additional content here */}
      <div className="w-full py-8 sm:py-12 md:py-16 px-4">
        <div className="max-w-7xl mx-auto">
          {/* You can add more cards or content sections here */}
          {/* Example placeholder section */}
          <div className="bottom-8 left-0 right-0 px-4 md:px-8 ">
            <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Left Card - Pair Trading Explanation */}
              <div className="backdrop-blur-md p-4 sm:p-6 space-y-4">
                <h2 className="text-3xl sm:text-4xl font-bold text-white">Pair Trading</h2>

                <p className="text-white text-sm sm:text-base leading-relaxed">
                  <span className="font-semibold">Pair trading is</span> a strategy where you simultaneously go long on
                  one asset and short on another, aiming to profit from their relative performance rather than overall
                  market direction.
                </p>

                <p className="text-gray-400 text-xs sm:text-sm leading-relaxed">
                  For instance, if you believe BTC will outperform ETH, you can long BTC and short ETH, potentially
                  profiting from the difference in their movements.
                </p>
              </div>

              {/* <ElectricBorder
   color="#A855F7"
   speed={1}
   chaos={0.5}
   thickness={2}
   style={{ borderRadius: 16 }}
 > */}
              <div className="rounded-2xl p-4 sm:p-6 space-y-4">
                {/* Long Position */}
                <div className="bg-black/50 rounded-xl p-3 sm:p-4 border border-gray-700">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="text-green-400 font-semibold text-xs sm:text-sm mb-1">Long</p>
                      <p className="text-white font-medium text-sm sm:text-base">BTC Price: $107,828.00</p>
                    </div>
                    <div className="bg-green-600/20 p-2 sm:p-3 rounded-lg border border-green-600/30">
                      <div className="flex items-center gap-1 sm:gap-2">
                        <Image src="/btc.png" alt="BTC" width={24} height={24} className="rounded-full w-5 h-5 sm:w-6 sm:h-6" />
                        <span className="text-white font-semibold text-sm sm:text-base">BTC</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Swap Icon */}
                <div className="flex justify-center -my-2">
                  <div className="bg-gray-800 p-2 rounded-full border border-gray-700">
                    <svg className="w-3 h-3 sm:w-4 sm:h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"
                      />
                    </svg>
                  </div>
                </div>

                {/* Short Position */}
                <div className="bg-black/50 rounded-xl p-3 sm:p-4 border border-gray-700">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="text-red-400 font-semibold text-xs sm:text-sm mb-1">Short</p>
                      <p className="text-white font-medium text-sm sm:text-base">ETH Price: $3,853.29</p>
                    </div>
                    <div className="bg-red-600/20 p-2 sm:p-3 rounded-lg border border-red-600/30">
                      <div className="flex items-center gap-1 sm:gap-2">
                        <Image src="/eth.png" alt="ETH" width={24} height={24} className="rounded-full w-5 h-5 sm:w-6 sm:h-6" />
                        <span className="text-white font-semibold text-sm sm:text-base">ETH</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Open Position Button */}
                <a href="/Trade" className="w-full py-2.5 sm:py-3 rounded-xl bg-purple-600 text-white cursor-pointer font-bold text-sm sm:text-base hover:bg-purple-500 transition-all shadow-lg hover:shadow-purple-500/50 flex items-center justify-center">
                  Open Position
                </a>
              </div>

              {/* </ElectricBorder> */}
              {/* Right Card - Trading Interface */}
            </div>
          </div>

          <div style={{ height: "80px", position: "relative", overflow: "hidden" }} className="mb-1 mt-10">
            <LogoLoop
              logos={createPairNodes(cryptoPairsRow1)}
              speed={120}
              direction="left"
              logoHeight={60}
              gap={24}
              pauseOnHover
              scaleOnHover={false}
              fadeOut
              fadeOutColor="no"
              ariaLabel="Cryptocurrency trading pairs row 1"
            />
          </div>

          {/* Second Loop - Right Direction */}
          <div style={{ height: "80px", position: "relative", overflow: "hidden" }} className="mb-1">
            <LogoLoop
              logos={createPairNodes(cryptoPairsRow2)}
              speed={100}
              direction="right"
              logoHeight={60}
              gap={24}
              pauseOnHover
              scaleOnHover={false}
              fadeOut
              fadeOutColor="no"
              ariaLabel="Cryptocurrency trading pairs row 2"
            />
          </div>

          {/* Third Loop - Left Direction */}
          <div style={{ height: "80px", position: "relative", overflow: "hidden" }}>
            <LogoLoop
              logos={createPairNodes(cryptoPairsRow3)}
              speed={140}
              direction="left"
              logoHeight={60}
              gap={24}
              pauseOnHover
              scaleOnHover={false}
              fadeOut
              fadeOutColor="no"
              ariaLabel="Cryptocurrency trading pairs row 3"
            />
          </div>
          <div className="mt-24 sm:mt-32 md:mt-32 px-4">
            <h2 className="text-3xl sm:text-4xl md:text-4xl font-bold text-white text-center mb-8 sm:mb-12">
              Trading <span className="text-purple-400">Engines</span> & Integrations
            </h2>
   <div className="max-w-6xl mx-auto">
              <div
                className="relative bg-black rounded-3xl p-4 sm:p-6 md:p-8 overflow-hidden border border-purple-800/50 min-h-[400px] sm:min-h-[350px] md:h-[450px]"
              >
                {/* Background Grid Lines */}
                <svg className="absolute inset-0 w-full h-full opacity-20" style={{ zIndex: 0 }}>
                  <defs>
                    <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                      <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#6b21a8" strokeWidth="0.5" />
                    </pattern>
                  </defs>
                  <rect width="100%" height="100%" fill="url(#grid)" />
                </svg>


                {/* Content */}
                <div className="relative z-10 h-full">
                  {/* Top Metrics */}
                  <div className="absolute top-4 sm:top-6 md:top-8 left-4 sm:left-6 md:left-8 flex items-start gap-4 sm:gap-8 md:gap-16">
                    {/* Latency */}
                    <div className="flex flex-col">
                      <div className="flex items-center gap-1 sm:gap-2 mb-1 sm:mb-2">
                        <span className="text-sm sm:text-lg">⚡</span>
                        <span className="text-gray-400 text-[10px] sm:text-xs font-medium">Latency</span>
                      </div>
                      <div className="text-xl sm:text-2xl md:text-3xl font-bold text-white mb-1 leading-tight">
                        {latency} <span className="text-sm sm:text-lg md:text-xl text-gray-500">MS</span>
                      </div>
                      <div className="text-[10px] sm:text-xs text-gray-600">Transaction Speed</div>
                    </div>

                    {/* Slippage */}
                    <div className="flex flex-col mt-2">
                      <div className="flex items-center gap-1 sm:gap-2 mb-1 sm:mb-2">
                        <svg width="14" height="14" viewBox="0 0 24 24" className="text-purple-400 sm:w-[18px] sm:h-[18px]">
                          <circle cx="8" cy="8" r="3" fill="currentColor" />
                          <circle cx="16" cy="8" r="3" fill="currentColor" />
                          <circle cx="12" cy="16" r="3" fill="currentColor" />
                        </svg>
                        <span className="text-gray-400 text-[10px] sm:text-xs font-medium">Slippage</span>
                      </div>
                      <div className="text-xl sm:text-2xl md:text-3xl font-bold text-white mb-1 leading-tight">
                        {slippage} <span className="text-sm sm:text-lg md:text-xl text-gray-500">%</span>
                      </div>
                      <div className="text-[10px] sm:text-xs text-gray-600">Order Precision</div>
                    </div>
                  </div>

                  {/* Center Logo Circle */}
                  <div className="absolute left-4 sm:left-6 md:left-30 top-54 -translate-y-1/2 hidden sm:block">
                    <div className="w-20 h-20 sm:w-24 sm:h-24 md:w-20 md:h-20 rounded-full border-2 border-purple-500/40 flex items-center justify-center bg-black/50">
                      <Image src="/drift.png" alt="Drift" width={20} height={20} className="rounded-lg w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14" />
                    </div>
                  </div>

                  {/* Bottom Branding */}
                  
                  <div className="absolute  bottom-4 sm:bottom-6 md:bottom-8 left-0 sm:left-6 md:left-0">
                    <div className="flex items-center gap-2 sm:gap-3 mb-1 sm:mb-2">
                      <Image src="/drift.png" alt="Drift" width={28} height={28} className="rounded-lg w-6 h-6 sm:w-7 sm:h-7" />
                      <h2 className="text-xl sm:text-2xl md:text-3xl font-normal text-white">
                        Drift
                      </h2>
                    </div>
                    <p className="text-gray-400 text-xs sm:text-sm max-w-[200px] sm:max-w-none">Deep liquidity with low latency and minimal slippage</p>
                  </div>

                  {/* Right Side - Bar Chart */}
                  <div className="absolute right-4 sm:right-6 md:right-8 bottom-8 sm:bottom-10 md:bottom-12 hidden md:block">
                    <div className="flex items-end gap-1 sm:gap-2 h-48 sm:h-56 md:h-64">
                      {[30, 35, 32, 38, 42, 40, 45, 48, 43, 50, 55, 60, 58, 65, 70].map((height, index) => (
                        <div
                          key={index}
                          className="relative w-4 sm:w-5 md:w-7 rounded-t-sm"
                          style={{
                            height: `${height}%`,
                            background: `linear-gradient(to top, rgba(168, 85, 247, 0.3), rgba(168, 85, 247, 0.8))`,
                            boxShadow: "0 0 20px rgba(168, 85, 247, 0.3)",
                          }}
                        >
                          <div
                            className="absolute inset-0 rounded-t-sm"
                            style={{
                              background: "linear-gradient(to top, rgba(168, 85, 247, 0.1), rgba(168, 85, 247, 0.5))",
                            }}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
     
          </div>

          {/* Drift Section */}
          {/* Agent Pear Section */}
          <div className="mt-24 sm:mt-32 md:mt-32 px-4">
            <div className="max-w-6xl mx-auto">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-16 items-start">
                {/* Left Side - Agent Pear Info */}
                <div className="space-y-4 sm:space-y-6 pt-4">
                  <div className="flex items-center gap-2 sm:gap-3">
                    <div className="w-12 h-12 sm:w-14 sm:h-14 bg-black rounded-full flex items-center justify-center shadow-lg shadow-purple-500/30 overflow-hidden">
                      <Image src="/AgentLogo.png" alt="Agent Elara" width={56} height={56} className="w-full h-full object-cover" />
                    </div>
                    <h2 className="text-3xl sm:text-4xl md:text-4xl font-bold text-white">
                      Agent Elara
                    </h2>
                    <span className="px-2 sm:px-2.5 py-0.5 bg-purple-500/20 border border-purple-500/40 rounded-full text-purple-400 text-[10px] font-semibold">
                      AI
                    </span>
                  </div>

                  <p className="text-gray-400 text-xs sm:text-sm leading-relaxed">
                    AI-Powered trading signal bot, watching over market conditions 24/7 and suggests high-probability entries based on mean reversion and correlation breakdowns between pairs.
                  </p>

                  <button className="px-5 sm:px-6 py-2 sm:py-2.5 rounded-lg bg-gradient-to-r from-purple-500 to-purple-600 text-white font-bold text-xs sm:text-sm hover:from-purple-600 hover:to-purple-700 transition-all shadow-lg shadow-purple-500/30 hover:shadow-purple-500/50 w-fit">
                    Get Signals
                  </button>

                  {/* Stats */}
                  <div className="grid grid-cols-3 gap-4 sm:gap-8 pt-4">
                    <div>
                      <div className="text-2xl sm:text-3xl font-bold text-white mb-0.5">68.96%</div>
                      <div className="text-[10px] sm:text-xs text-gray-500">Win Rate</div>
                    </div>
                    <div>
                      <div className="text-2xl sm:text-3xl font-bold text-white mb-0.5">1,635</div>
                      <div className="text-[10px] sm:text-xs text-gray-500">Total Wins</div>
                    </div>
                    <div>
                      <div className="text-2xl sm:text-3xl font-bold text-white mb-0.5">2,371</div>
                      <div className="text-[10px] sm:text-xs text-gray-500">Total Trades</div>
                    </div>
                  </div>
                </div>

                {/* Right Side - Trading Alert Cards in Stacked Layout - Hidden on Mobile */}
                <div className="relative w-full h-[450px] hidden lg:flex items-start justify-center pt-4">
                  {/* Card 1 - BTC/FLUX (Back) */}
                  <div 
                    className="absolute h-[420px] bottom-0 bg-gradient-to-br from-gray-900/90 to-black/90 backdrop-blur-md border border-purple-600/30 rounded-2xl p-4 shadow-xl shadow-purple-900/20 w-[320px] transition-all duration-300 hover:-translate-y-4 cursor-pointer"
                    style={{ 
                      transform: 'translateX(-100px) scale(0.95)',
                      zIndex: 1
                    }}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-gray-400 text-xs">Pair Trade Alert</span>
                      <span className="text-gray-500 text-[10px]">6Hours ago</span>
                    </div>

                    {/* Pair Header */}
                    <div className="grid grid-cols-2 gap-2 mb-3">
                      <div className="bg-gradient-to-br from-green-900/40 to-green-800/20 border border-green-600/30 rounded-lg p-2 flex items-center gap-2">
                        <div className="w-5 h-5 bg-orange-500 rounded-full flex items-center justify-center text-white font-bold text-[10px]">
                          ₿
                        </div>
                        <span className="text-white font-semibold text-xs">BTC</span>
                      </div>
                      <div className="bg-gradient-to-br from-red-900/40 to-red-800/20 border border-red-600/30 rounded-lg p-2 flex items-center gap-2">
                        <div className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold text-[10px]">
                          Ⓕ
                        </div>
                        <span className="text-white font-semibold text-xs">FLUX</span>
                      </div>
                    </div>

                    {/* Price */}
                    <div className="text-lg font-bold text-white mb-2">$314,261</div>

                    {/* Mini Chart Placeholder */}
                    <div className="h-10 mb-3 flex items-end gap-0.5">
                      {[30, 35, 32, 38, 42, 40, 45, 48, 43, 50, 55, 60, 58, 65, 70, 68, 72, 75, 70, 78, 82, 85, 80, 88, 92].map((height, i) => (
                        <div
                          key={i}
                          className="flex-1 bg-gradient-to-t from-lime-600 to-lime-400 rounded-t-sm"
                          style={{ height: `${height}%` }}
                        />
                      ))}
                    </div>

                    {/* Details Grid */}
                    <div className="space-y-1.5 mb-2 mt-2">
                      <div>
                        <div className="text-gray-400 text-[9px] mb-0.5 font-medium">Trading Style:</div>
                        <div className="text-gray-300 text-[10px] leading-tight">
                          Emphasizes risk-adjusted returns, ideal for averse and institutional traders seeking stable performance.
                        </div>
                      </div>
                      <div>
                        <div className="text-gray-400 text-[9px] mb-0.5 font-medium">Remarks:</div>
                        <div className="text-gray-300 text-[10px] leading-tight">
                          Statistical arbitrage analysis suggests longing BTC and shorting FLUX with a 2.4 Sharpe ratio for mean reversion potential.
                        </div>
                      </div>
                    </div>

                    {/* Metrics */}
                    <div className="grid grid-cols-3 gap-2 mb-2 text-xs">
                      <div>
                        <div className="text-gray-500 text-[9px] font-medium">Correlation:</div>
                        <div className="text-white font-semibold text-[10px]">Cointegrated</div>
                      </div>
                      <div>
                        <div className="text-gray-500 text-[9px] font-medium">Z-Score:</div>
                        <div className="text-white font-semibold text-[10px]">-</div>
                      </div>
                      <div>
                        <div className="text-gray-500 text-[9px] font-medium">Trading Engine:</div>
                        <div className="text-white font-semibold text-[10px]">-</div>
                      </div>
                    </div>

                    <a href="/Trade" className="w-full py-2 mt-10 rounded-lg bg-gradient-to-r from-purple-500 to-purple-600 text-white font-bold text-xs hover:from-purple-600 hover:to-purple-700 transition-all flex items-center justify-center">
                      Open Position
                    </a>
                  </div>

                  {/* Card 2 - LDO/SIREN (Middle) */}
                  <div 
                    className="absolute bottom-0 h-[323px] bg-gradient-to-br from-gray-900/95 to-black/95 backdrop-blur-md border border-purple-600/40 rounded-2xl p-4 shadow-2xl shadow-purple-900/30 w-[320px] transition-all duration-300 hover:-translate-y-4 cursor-pointer"
                    style={{ 
                      transform: 'translateX(0px) scale(0.98)',
                      zIndex: 2
                    }}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-gray-400 text-xs">Pair Trade Alert</span>
                      <span className="text-gray-500 text-[10px]">2 Hours ago</span>
                    </div>

                    {/* Pair Header */}
                    <div className="grid grid-cols-2 gap-2 mb-3">
                      <div className="bg-gradient-to-br from-green-900/40 to-green-800/20 border border-green-600/30 rounded-lg p-2 flex items-center gap-2">
                        <div className="w-5 h-5 bg-purple-500 rounded-full flex items-center justify-center text-white font-bold text-[10px]">
                          Ⓛ
                        </div>
                        <span className="text-white font-semibold text-xs">LDO</span>
                      </div>
                      <div className="bg-gradient-to-br from-red-900/40 to-red-800/20 border border-red-600/30 rounded-lg p-2 flex items-center gap-2">
                        <div className="w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-white font-bold text-[10px]">
                          Ⓢ
                        </div>
                        <span className="text-white font-semibold text-xs">SIREN</span>
                      </div>
                    </div>

                    {/* Details */}
                    <div className="space-y-1.5 mb-2">
                      <div>
                        <div className="text-gray-400 text-[9px] mb-0.5 font-medium">Trading Style:</div>
                        <div className="text-gray-300 text-[10px] leading-tight">
                          Combines direct z-score outlier detection with a rolling, smoothed measure. Ideal for active quant traders and swing traders seeking dynamic reversion cues.
                        </div>
                      </div>
                      <div>
                        <div className="text-gray-400 text-[9px] mb-0.5 font-medium">Remarks:</div>
                        <div className="text-gray-300 text-[10px] leading-tight">
                          The statistical arbitrage analysis supports longing SIREN/USDT, supported by a positive z-score of 1.77 indicating mean reversion potential and a stable funding rate (0.01%) with moderate correlation.
                        </div>
                      </div>
                    </div>

                    {/* Metrics */}
                    <div className="grid grid-cols-3 gap-2 mb-2 text-xs">
                      <div>
                        <div className="text-gray-500 text-[9px] font-medium">Correlation:</div>
                        <div className="text-white font-semibold text-[10px]">Cointegrated</div>
                      </div>
                      <div>
                        <div className="text-gray-500 text-[9px] font-medium">Z-Score:</div>
                        <div className="text-white font-semibold text-[10px]">1.77</div>
                      </div>
                      <div>
                        <div className="text-gray-500 text-[9px] font-medium">Trading Engine:</div>
                        <div className="text-white font-semibold text-[10px]">-</div>
                      </div>
                    </div>

                    <a href="/Trade" className="w-full py-2 rounded-lg bg-gradient-to-r from-purple-500 to-purple-600 text-white font-bold text-xs hover:from-purple-600 hover:to-purple-700 transition-all flex items-center justify-center">
                      Open Position
                    </a>
                  </div>

                  {/* Card 3 - USUAL/MOODENG (Front) */}
                  <div 
                    className="absolute bottom-0 bg-gradient-to-br from-gray-900 to-black backdrop-blur-md border-2 border-purple-600/50 rounded-2xl p-4 shadow-2xl shadow-purple-900/40 w-[320px] transition-all duration-300 hover:-translate-y-4 cursor-pointer"
                    style={{ 
                      transform: 'translateX(100px) scale(1.0)',
                      zIndex: 3
                    }}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-gray-400 text-xs">Pair Trade Alert</span>
                      <span className="text-gray-500 text-[10px]">2 Hours ago</span>
                    </div>

                    {/* Pair Header */}
                    <div className="grid grid-cols-2 gap-2 mb-3">
                      <div className="bg-gradient-to-br from-green-900/40 to-green-800/20 border border-green-600/30 rounded-lg p-2 flex items-center gap-2">
                        <div className="w-5 h-5 bg-cyan-500 rounded-full flex items-center justify-center text-white font-bold text-[10px]">
                          Ⓤ
                        </div>
                        <span className="text-white font-semibold text-xs">USUAL</span>
                      </div>
                      <div className="bg-gradient-to-br from-red-900/40 to-red-800/20 border border-red-600/30 rounded-lg p-2 flex items-center gap-2">
                        <div className="w-5 h-5 bg-pink-500 rounded-full flex items-center justify-center text-white font-bold text-[10px]">
                          Ⓜ
                        </div>
                        <span className="text-white font-semibold text-xs">MOODENG</span>
                      </div>
                    </div>

                    {/* Metrics */}
                    <div className="grid grid-cols-3 gap-2 mb-2">
                      <div>
                        <div className="text-gray-500 text-[9px] mb-0.5 font-medium">Correlation:</div>
                        <div className="text-white font-semibold text-[10px]">Cointegrated</div>
                      </div>
                      <div>
                        <div className="text-gray-500 text-[9px] mb-0.5 font-medium">Z-Score:</div>
                        <div className="text-white font-semibold text-base">0.45</div>
                      </div>
                      <div>
                        <div className="text-gray-500 text-[9px] mb-0.5 font-medium">Trading Engine:</div>
                        <div className="text-cyan-400 font-semibold text-[10px]">Drift</div>
                      </div>
                    </div>

                    {/* Additional Metrics */}
                    <div className="grid grid-cols-2 gap-2 mb-2">
                      <div>
                        <div className="text-gray-500 text-[9px] font-medium">Cointegrated:</div>
                        <div className="text-white text-[10px]">False</div>
                      </div>
                      <div>
                        <div className="text-gray-500 text-[9px] font-medium">Z-Score:</div>
                        <div className="text-white text-[10px]">0.2</div>
                      </div>
                    </div>

                    <a href="/Trade" className="w-full py-2 rounded-lg bg-gradient-to-r from-purple-500 to-purple-600 text-white font-bold text-xs hover:from-purple-600 hover:to-purple-700 transition-all flex items-center justify-center">
                      Open Position
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Features Section */}
          <div className="mt-24 sm:mt-32 md:mt-32 px-4">
            <div className="max-w-6xl mx-auto">
              {/* Section Header */}
              <div className="text-center mb-10 sm:mb-12 md:mb-16">
                <h2 className="text-3xl sm:text-4xl md:text-4xl font-bold text-white mb-3 sm:mb-4 px-4">
                  Trade Profitable in any Market Condition
                </h2>
                <p className="text-gray-400 text-sm sm:text-base px-4">
                  Power your trading strategy with Pear Protocol&apos;s advanced pair trading platform.
                </p>
              </div>

              {/* Features Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* Feature 1: TP / SL */}
                <div className="bg-black/40 backdrop-blur-sm border border-gray-800/50 rounded-xl p-6 hover:border-purple-600/30 transition-all">
                  <div className="flex items-start gap-3 mb-3">
                    <div className="text-purple-500 text-xl">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M9 11l3 3L22 4" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                    <h3 className="text-white font-bold text-base">TP / SL</h3>
                  </div>
                  <p className="text-gray-400 text-sm leading-relaxed">
                    Set take-profit and stop-loss levels, giving you control over risk and reward.
                  </p>
                </div>

                {/* Feature 2: 1 Click Open / Close */}
                <div className="bg-black/40 backdrop-blur-sm border border-gray-800/50 rounded-xl p-6 hover:border-purple-600/30 transition-all">
                  <div className="flex items-start gap-3 mb-3">
                    <div className="text-purple-500 text-xl">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M12 8v8m-4-4h8" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                    <h3 className="text-white font-bold text-base">1 Click Open / Close</h3>
                  </div>
                  <p className="text-gray-400 text-sm leading-relaxed">
                    Instantly open or close pair trades with a single tap—perfect for fast-moving markets.
                  </p>
                </div>

                {/* Feature 3: Seamless Charting */}
                <div className="bg-black/40 backdrop-blur-sm border border-gray-800/50 rounded-xl p-6 hover:border-purple-600/30 transition-all">
                  <div className="flex items-start gap-3 mb-3">
                    <div className="text-purple-500 text-xl">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M3 3v18h18" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M18 17l-5-5-4 4-6-6" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                    <h3 className="text-white font-bold text-base">Seamless Charting</h3>
                  </div>
                  <p className="text-gray-400 text-sm leading-relaxed">
                    Built-in charts for pair trades let you visualize market movements and act quickly.
                  </p>
                </div>

                {/* Feature 4: Robust Security */}
                <div className="bg-black/40 backdrop-blur-sm border border-gray-800/50 rounded-xl p-6 hover:border-purple-600/30 transition-all">
                  <div className="flex items-start gap-3 mb-3">
                    <div className="text-purple-500 text-xl">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                    <h3 className="text-white font-bold text-base">Robust Security</h3>
                  </div>
                  <p className="text-gray-400 text-sm leading-relaxed">
                    Trade with confidence on an audited platform designed to protect your assets.
                  </p>
                </div>

                {/* Feature 5: Advanced Data and Analytics */}
                <div className="bg-black/40 backdrop-blur-sm border border-gray-800/50 rounded-xl p-6 hover:border-purple-600/30 transition-all">
                  <div className="flex items-start gap-3 mb-3">
                    <div className="text-purple-500 text-xl">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M18 20V10M12 20V4M6 20v-6" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                    <h3 className="text-white font-bold text-base">Advanced Data and Analytics</h3>
                  </div>
                  <p className="text-gray-400 text-sm leading-relaxed">
                    Get real-time metrics, pair spreads, and historical data to fine-tune your trading logic.
                  </p>
                </div>

                {/* Feature 6: Active Trading Community */}
                <div className="bg-black/40 backdrop-blur-sm border border-gray-800/50 rounded-xl p-6 hover:border-purple-600/30 transition-all">
                  <div className="flex items-start gap-3 mb-3">
                    <div className="text-purple-500 text-xl">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" strokeLinecap="round" strokeLinejoin="round"/>
                        <circle cx="9" cy="7" r="4" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                    <h3 className="text-white font-bold text-base">Active Trading Community</h3>
                  </div>
                  <p className="text-gray-400 text-sm leading-relaxed">
                    Join a growing network of active traders sharing insights, strategies, and alpha.
                  </p>
                </div>

                {/* Feature 7: TWAP Entries */}
                <div className="bg-black/40 backdrop-blur-sm border border-gray-800/50 rounded-xl p-6 hover:border-purple-600/30 transition-all">
                  <div className="flex items-start gap-3 mb-3">
                    <div className="text-purple-500 text-xl">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10" strokeLinecap="round" strokeLinejoin="round"/>
                        <polyline points="12 6 12 12 16 14" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                    <h3 className="text-white font-bold text-base">TWAP Entries</h3>
                  </div>
                  <p className="text-gray-400 text-sm leading-relaxed">
                    Execute trades gradually with time-weighted average pricing to reduce slippage on large orders.
                  </p>
                </div>

                {/* Feature 8: Professional Weighting Options */}
                <div className="bg-black/40 backdrop-blur-sm border border-gray-800/50 rounded-xl p-6 hover:border-purple-600/30 transition-all">
                  <div className="flex items-start gap-3 mb-3">
                    <div className="text-purple-500 text-xl">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" strokeLinecap="round" strokeLinejoin="round"/>
                        <polyline points="3.27 6.96 12 12.01 20.73 6.96" strokeLinecap="round" strokeLinejoin="round"/>
                        <line x1="12" y1="22.08" x2="12" y2="12" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                    <h3 className="text-white font-bold text-base">Professional Weighting Options</h3>
                  </div>
                  <p className="text-gray-400 text-sm leading-relaxed">
                    Adjust exposure between multiple long and multiple short assets with precision—no more 50/50 limits.
                  </p>
                </div>

                {/* Feature 9: Leverage and Flexibility */}
                <div className="bg-black/40 backdrop-blur-sm border border-gray-800/50 rounded-xl p-6 hover:border-purple-600/30 transition-all">
                  <div className="flex items-start gap-3 mb-3">
                    <div className="text-purple-500 text-xl">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                    <h3 className="text-white font-bold text-base">Leverage and Flexibility</h3>
                  </div>
                  <p className="text-gray-400 text-sm leading-relaxed">
                    Trade over 3 tokens with flexible leverage options—tailor your strategy to any market condition.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-24 sm:mt-32 md:mt-32 px-4">
            <h2 className="text-3xl sm:text-4xl md:text-4xl font-bold text-white text-center mb-8 sm:mb-10 md:mb-12">
              Meet the <span className="text-purple-400">Team</span>
            </h2>

            <div className="max-w-6xl mx-auto grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-8 sm:gap-10 md:gap-12 justify-center items-center">
              {/* Himanshu */}
              <div className="flex justify-center">
                <TiltedCard
                  imageSrc="/Himanshu.png"
                  altText="Himanshu"
                  captionText="Himanshu"
                  containerHeight="300px"
                  containerWidth="300px"
                  imageHeight="300px"
                  imageWidth="300px"
                  rotateAmplitude={12}
                  scaleOnHover={1.2}
                  showMobileWarning={false}
                  showTooltip={false}
                  displayOverlayContent={true}
                  overlayContent={
                    <div className="absolute top-4 left-1/2 -translate-x-1/2">
                      <div className="bg-gray-800/90 backdrop-blur-sm px-6 py-3 rounded-full">
                        <p className="text-purple-400 font-bold text-lg whitespace-nowrap">Himanshu</p>
                      </div>
                    </div>
                  }
                />
              </div>

              {/* Rushab */}
              <div className="flex justify-center">
                <TiltedCard
                  imageSrc="/Rushab.png"
                  altText="Rushab"
                  captionText="Rushab"
                  containerHeight="300px"
                  containerWidth="300px"
                  imageHeight="300px"
                  imageWidth="300px"
                  rotateAmplitude={12}
                  scaleOnHover={1.2}
                  showMobileWarning={false}
                  showTooltip={false}
                  displayOverlayContent={true}
                  overlayContent={
                    <div className="absolute top-4 left-1/2 -translate-x-1/2">
                      <div className="bg-gray-800/90 backdrop-blur-sm px-6 py-3 rounded-full">
                        <p className="text-purple-400 font-bold text-lg whitespace-nowrap">Rushab</p>
                      </div>
                    </div>
                  }
                />
              </div>

              {/* Nabil */}
              <div className="flex justify-center">
                <TiltedCard
                  imageSrc="/nabil.png"
                  altText="Nabil"
                  captionText="Nabil"
                  containerHeight="300px"
                  containerWidth="300px"
                  imageHeight="300px"
                  imageWidth="300px"
                  rotateAmplitude={12}
                  scaleOnHover={1.2}
                  showMobileWarning={false}
                  showTooltip={false}
                  displayOverlayContent={true}
                  overlayContent={
                    <div className="absolute top-4 left-1/2 -translate-x-1/2">
                      <div className="bg-gray-800/90 backdrop-blur-sm px-6 py-3 rounded-full">
                        <p className="text-purple-400 font-bold text-lg whitespace-nowrap">Nabil</p>
                      </div>
                    </div>
                  }
                />
              </div>
            </div>
          </div>

          {/* Footer Section */}
          <footer className="mt-24 sm:mt-32 md:mt-48 border-t border-gray-800">
            <div className="max-w-7xl mx-auto px-4 py-8 sm:py-12 md:py-16">
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-6 sm:gap-8 md:gap-12 mb-8 sm:mb-10 md:mb-12">
                {/* Logo and Tagline */}
                <div className="col-span-2 sm:col-span-3 lg:col-span-1 mb-4 lg:mb-0">
                  <div className="flex items-center gap-2 mb-2 sm:mb-3">
                    <div className="text-green-500 text-xl sm:text-2xl">
         
        </div>
                    <span className="text-purple-500 text-xl sm:text-2xl font-bold">ElaraFi</span>
                  </div>
                  <p className="text-gray-400 text-xs sm:text-sm">The Home of Pair Trading.</p>
                </div>

                {/* Column 1 - Legal */}
                <div>
                  <ul className="space-y-2 sm:space-y-3">
                    <li>
                      <a href="#" className="text-gray-400 hover:text-white transition-colors text-xs sm:text-sm">
                        Terms Of Use
                      </a>
                    </li>
                    <li>
                      <a href="#" className="text-gray-400 hover:text-white transition-colors text-xs sm:text-sm">
                        Privacy Policy
                      </a>
                    </li>
                    <li>
                      <a href="#" className="text-gray-400 hover:text-white transition-colors text-xs sm:text-sm">
                        Disclaimer
                      </a>
                    </li>
                  </ul>
                </div>

                {/* Column 2 - Resources */}
                <div>
                  <ul className="space-y-2 sm:space-y-3">
                    <li>
                      <a href="#" className="text-gray-400 hover:text-white transition-colors text-xs sm:text-sm">
                        Docs
                      </a>
                    </li>
                    
                    <li>
                      <a href="#" className="text-gray-400 hover:text-white transition-colors text-xs sm:text-sm">
                        Stats
                      </a>
                    </li>

                    <li>
                      <a href="#" className="text-gray-400 hover:text-white transition-colors text-xs sm:text-sm">
                        Blog
                      </a>
                    </li>
                  </ul>
                </div>

                {/* Column 3 - Learn */}
                <div>
                  <ul className="space-y-2 sm:space-y-3">
                    <li>
                      <a href="#" className="text-gray-400 hover:text-white transition-colors text-xs sm:text-sm">
                        Education
                      </a>
                    </li>
                    <li>
                      <a href="#" className="text-gray-400 hover:text-white transition-colors text-xs sm:text-sm">
                        Agent Elara
                      </a>
                    </li>
                    <li>
                      <a href="#" className="text-gray-400 hover:text-white transition-colors text-xs sm:text-sm">
                        FAQ
                      </a>
                    </li>
                  
                  </ul>
                </div>

                {/* Column 4 - Community */}
                <div>
                  <ul className="space-y-2 sm:space-y-3">
                    <li>
                      <a href="#" className="text-gray-400 hover:text-white transition-colors text-xs sm:text-sm">
                        Twitter (x)
                      </a>
                    </li>
                    <li>
                      <a href="#" className="text-gray-400 hover:text-white transition-colors text-xs sm:text-sm">
                        Discord
                      </a>
                    </li>
                    <li>
                      <a href="#" className="text-gray-400 hover:text-white transition-colors text-xs sm:text-sm">
                        Snapshot
                      </a>
                    </li>
                   
                  </ul>
                </div>
              </div>

              {/* Bottom Bar */}
              <div className="pt-6 sm:pt-8 border-t border-gray-800 flex flex-col md:flex-row justify-between items-center gap-3 sm:gap-4">
                {/* System Status */}
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                  <span className="text-gray-400 text-xs sm:text-sm">All systems operational</span>
                </div>

                {/* Copyright */}
                <div className="text-gray-400 text-xs sm:text-sm text-center">
                  © 2025 Pear Protocol. All rights reserved.
                </div>
              </div>
            </div>
          </footer>
         
        </div>
      </div>
    </div>
  )
}

export default Home
