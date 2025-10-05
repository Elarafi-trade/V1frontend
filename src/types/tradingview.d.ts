// TypeScript declarations for TradingView widget
declare global {
  interface Window {
    TradingView: {
      widget: new (config: object) => unknown
    }
  }
}

export {}