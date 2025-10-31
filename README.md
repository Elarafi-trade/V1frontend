# <img src="https://github.com/Elarafi-trade/V1/blob/main/public/ElaraFiLogo.png" width="48"> ElaraFi

**AI-Powered Pair Trading Protocol on Solana**
*Built entirely on top of Drift Protocol*

---

## Overview

**ElaraFi** is an **AI-driven market-neutral trading platform** built on **Solana**, enabling users to execute **pair trades (long/short)** in one click.
Powered by the **Drift Protocol**, ElaraFi lets traders open two opposite perpetual positions atomically — e.g. LONG BTC and SHORT ETH — for **hedged, market-neutral exposure**.

The platform combines AI analytics from **Elara Agent** and an automated backend worker for TP/SL monitoring.

Elara Docs :- [Elara Docs](https://app.gitbook.com/o/5F7jcFtQchpN0RTF9rWi/s/uQjzoXRxhP2VGzuWwtOe/~/changes/mILDbGBoCza7pEkJEh7O/~/overview)

Devnet Live :- [ElaraFI](https://www.elarafi.xyz/)

Pitch Deck :- [Pitch Deck](https://drive.google.com/file/d/1DpgVBCkFlP858M_5YT9fVybQ0Iw4ETcq/view?usp=sharing)

---

## Related Repositories

| Component              | Repository                                                                  | Description                              |
| ---------------------- | --------------------------------------------------------------------------- | ---------------------------------------- |
| **Elara Agent**        | [pair-agent](https://github.com/Elarafi-trade/pair-agent)                   | AI Engine for pair analysis and pair trade signals     |
| **Elara ASI UAgent**   | [pair_agentverse](https://github.com/Elarafi-trade/pair_agentverse)         | AI integration via Agentverse + Fetch.AI,For Top Pairs Daily Signals  |
| **Elara Telegram Bot** | [pair-agent-telegram](https://github.com/Elarafi-trade/pair-agent-telegram) | Telegram Interface for AI signals        |

---

## Getting Started

### 1️⃣ Clone & Install

```bash
git clone https://github.com/Elarafi-trade/elara-fi.git
cd elara-fi
npm install
```

### 2️⃣ Run Dev Server

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## ⚙️ Environment Variables

Create a `.env.local` file:

```bash
NEXT_PUBLIC_DRIFT_ENV=devnet
NEXT_PUBLIC_API_URL=http://localhost:3000/api
DATABASE_URL=your_neon_db_url
REDIS_URL=your_redis_instance
```

---

## Features

✅ **AI-Powered Pair Signals** — from Elara Agent 

✅ **One-Click Pair Execution** — built on Drift SDK

✅ **TP/SL Auto-Worker** — automated exit and monitoring

✅ **Real-Time P&L Tracking** — via WebSocket feed

✅ **Non-Custodial Wallets** — Phantom, Backpack supported

✅ **Multi-Market Support** — BTC/ETH, BTC/SOL, SOL/BTC (more coming)

---

## How It Works

1. **ELARA Agent** analyzes market data and emits pair signals.
2. **Users** select a pair and execute long/short trades atomically via Drift.
3. **Worker Service** monitors each position for P&L or liquidation risk.
4. **Trades** can be closed manually or auto-triggered by thresholds.


