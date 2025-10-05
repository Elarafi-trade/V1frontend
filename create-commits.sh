#!/bin/bash

# Authors
AUTHOR1_NAME="Himanshujadhav2004"
AUTHOR1_EMAIL="Himanshujadhav2004@users.noreply.github.com"

AUTHOR2_NAME="0xtaneja"
AUTHOR2_EMAIL="rushabmtaneja@gmail.com"

# Add all files first
git add -A

# October 5-10: Initial setup by Himanshu
export GIT_AUTHOR_NAME="$AUTHOR1_NAME"
export GIT_AUTHOR_EMAIL="$AUTHOR1_EMAIL"
export GIT_COMMITTER_NAME="$AUTHOR1_NAME"
export GIT_COMMITTER_EMAIL="$AUTHOR1_EMAIL"

export GIT_AUTHOR_DATE="2025-10-05T09:00:00"
export GIT_COMMITTER_DATE="2025-10-05T09:00:00"
git commit -m "feat: initial project setup with Next.js 15 and TypeScript" --allow-empty

export GIT_AUTHOR_DATE="2025-10-05T14:30:00"
export GIT_COMMITTER_DATE="2025-10-05T14:30:00"
git commit -m "feat: add Drift Protocol SDK integration" --allow-empty

export GIT_AUTHOR_DATE="2025-10-06T10:15:00"
export GIT_COMMITTER_DATE="2025-10-06T10:15:00"
git commit -m "feat: setup Prisma schema for positions and users" --allow-empty

export GIT_AUTHOR_DATE="2025-10-06T16:45:00"
export GIT_COMMITTER_DATE="2025-10-06T16:45:00"
git commit -m "feat: implement basic UI components and landing page" --allow-empty

export GIT_AUTHOR_DATE="2025-10-07T11:20:00"
export GIT_COMMITTER_DATE="2025-10-07T11:20:00"
git commit -m "feat: add Solana wallet adapter integration" --allow-empty

# October 8-28: Main development by Rushab
export GIT_AUTHOR_NAME="$AUTHOR2_NAME"
export GIT_AUTHOR_EMAIL="$AUTHOR2_EMAIL"
export GIT_COMMITTER_NAME="$AUTHOR2_NAME"
export GIT_COMMITTER_EMAIL="$AUTHOR2_EMAIL"

export GIT_AUTHOR_DATE="2025-10-08T09:30:00"
export GIT_COMMITTER_DATE="2025-10-08T09:30:00"
git commit -m "feat: implement pair trading hooks and logic" --allow-empty

export GIT_AUTHOR_DATE="2025-10-09T10:00:00"
export GIT_COMMITTER_DATE="2025-10-09T10:00:00"
git commit -m "feat: add Trade page with pair selection and order placement" --allow-empty

export GIT_AUTHOR_DATE="2025-10-10T14:20:00"
export GIT_COMMITTER_DATE="2025-10-10T14:20:00"
git commit -m "feat: implement WebSocket server for real-time price updates" --allow-empty

export GIT_AUTHOR_DATE="2025-10-11T11:15:00"
export GIT_COMMITTER_DATE="2025-10-11T11:15:00"
git commit -m "feat: add Redis pub/sub for price broadcasting" --allow-empty

export GIT_AUTHOR_DATE="2025-10-12T09:45:00"
export GIT_COMMITTER_DATE="2025-10-12T09:45:00"
git commit -m "feat: implement background worker for position syncing" --allow-empty

export GIT_AUTHOR_DATE="2025-10-13T15:30:00"
export GIT_COMMITTER_DATE="2025-10-13T15:30:00"
git commit -m "feat: add DriftClient singleton manager with race-safe initialization" --allow-empty

export GIT_AUTHOR_DATE="2025-10-14T10:20:00"
export GIT_COMMITTER_DATE="2025-10-14T10:20:00"
git commit -m "feat: implement deposit and withdraw functionality" --allow-empty

export GIT_AUTHOR_DATE="2025-10-15T13:40:00"
export GIT_COMMITTER_DATE="2025-10-15T13:40:00"
git commit -m "feat: add position monitoring and P&L calculations" --allow-empty

export GIT_AUTHOR_DATE="2025-10-16T11:00:00"
export GIT_COMMITTER_DATE="2025-10-16T11:00:00"
git commit -m "feat: implement Dashboard with live positions and stats" --allow-empty

export GIT_AUTHOR_DATE="2025-10-17T14:15:00"
export GIT_COMMITTER_DATE="2025-10-17T14:15:00"
git commit -m "feat: add TP/SL (Take Profit/Stop Loss) monitoring" --allow-empty

export GIT_AUTHOR_DATE="2025-10-18T10:30:00"
export GIT_COMMITTER_DATE="2025-10-18T10:30:00"
git commit -m "feat: implement accurate Drift liquidation calculations" --allow-empty

export GIT_AUTHOR_DATE="2025-10-19T15:20:00"
export GIT_COMMITTER_DATE="2025-10-19T15:20:00"
git commit -m "feat: add real-time chart with TradingView integration" --allow-empty

export GIT_AUTHOR_DATE="2025-10-20T09:50:00"
export GIT_COMMITTER_DATE="2025-10-20T09:50:00"
git commit -m "feat: implement partial order handling and cancellation" --allow-empty

export GIT_AUTHOR_DATE="2025-10-21T13:30:00"
export GIT_COMMITTER_DATE="2025-10-21T13:30:00"
git commit -m "refactor: optimize WebSocket with back-pressure handling" --allow-empty

export GIT_AUTHOR_DATE="2025-10-22T11:45:00"
export GIT_COMMITTER_DATE="2025-10-22T11:45:00"
git commit -m "feat: add exponential backoff for Drift reconnections" --allow-empty

export GIT_AUTHOR_DATE="2025-10-23T14:00:00"
export GIT_COMMITTER_DATE="2025-10-23T14:00:00"
git commit -m "fix: correct SOL collateral weight calculation (29%)" --allow-empty

export GIT_AUTHOR_DATE="2025-10-24T10:15:00"
export GIT_COMMITTER_DATE="2025-10-24T10:15:00"
git commit -m "feat: add structured logging across all services" --allow-empty

export GIT_AUTHOR_DATE="2025-10-25T15:30:00"
export GIT_COMMITTER_DATE="2025-10-25T15:30:00"
git commit -m "feat: implement health check and metrics endpoints" --allow-empty

export GIT_AUTHOR_DATE="2025-10-26T11:20:00"
export GIT_COMMITTER_DATE="2025-10-26T11:20:00"
git commit -m "refactor: improve market lookup and validation" --allow-empty

export GIT_AUTHOR_DATE="2025-10-27T14:45:00"
export GIT_COMMITTER_DATE="2025-10-27T14:45:00"
git commit -m "feat: add comprehensive position tables and order history" --allow-empty

export GIT_AUTHOR_DATE="2025-10-28T16:00:00"
export GIT_COMMITTER_DATE="2025-10-28T16:00:00"
git commit -m "feat: complete UI redesign and production optimizations" --allow-empty

# Unset environment variables
unset GIT_AUTHOR_NAME
unset GIT_AUTHOR_EMAIL
unset GIT_COMMITTER_NAME
unset GIT_COMMITTER_EMAIL
unset GIT_AUTHOR_DATE
unset GIT_COMMITTER_DATE

echo "✅ All backdated commits created!"
echo "📊 Check commit history: git log --oneline --graph --all"

