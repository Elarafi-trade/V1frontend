export type SupportedToken = "SOL" | "BTC" | "ETH" | "JITO" | "JUP" | "DRIFT";

type PriceInfo = {
  price: number; // in USDT/USD
  change24hPct: number; // percentage, e.g., 1.23 means +1.23%
};

// Routing per token to exchange + symbol
const BINANCE_SYMBOL: Partial<Record<SupportedToken, string>> = {
  BTC: "BTCUSDT",
  ETH: "ETHUSDT",
  SOL: "SOLUSDT",
};

const MEXC_SYMBOL: Partial<Record<SupportedToken, string>> = {
  JITO: "JITOUSDT",
  JUP: "JUPUSDT",
  DRIFT: "DRIFTUSDT",
};

async function fetchBinance(symbol: string): Promise<PriceInfo> {
  const [priceRes, changeRes] = await Promise.all([
    fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${symbol}`),
    fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${symbol}`),
  ]);
  const priceJson = await priceRes.json();
  const changeJson = await changeRes.json();
  return {
    price: parseFloat(priceJson.price),
    change24hPct: parseFloat(changeJson.priceChangePercent),
  };
}

async function fetchMexc(symbol: string): Promise<PriceInfo> {
  const [priceRes, changeRes] = await Promise.all([
    fetch(`https://api.mexc.com/api/v3/ticker/price?symbol=${symbol}`),
    fetch(`https://api.mexc.com/api/v3/ticker/24hr?symbol=${symbol}`),
  ]);
  const priceJson = await priceRes.json();
  const changeJson = await changeRes.json();
  return {
    price: parseFloat(priceJson.price),
    change24hPct: parseFloat(changeJson.priceChangePercent),
  };
}

export async function fetchTokenPrice(token: SupportedToken): Promise<PriceInfo> {
  if (BINANCE_SYMBOL[token]) {
    return fetchBinance(BINANCE_SYMBOL[token]!);
  }
  if (MEXC_SYMBOL[token]) {
    return fetchMexc(MEXC_SYMBOL[token]!);
  }
  throw new Error(`No price source configured for token ${token}`);
}

export async function fetchPairMetrics(longToken: SupportedToken, shortToken: SupportedToken) {
  const [longInfo, shortInfo] = await Promise.all([
    fetchTokenPrice(longToken),
    fetchTokenPrice(shortToken),
  ]);
  const ratio = longInfo.price / shortInfo.price;
  // Approximate pair 24h change as differential of percentage changes
  const changePct = longInfo.change24hPct - shortInfo.change24hPct;
  return {
    pairPrice: ratio,
    pairChangePct: changePct,
    legs: { long: longInfo, short: shortInfo },
  };
}


