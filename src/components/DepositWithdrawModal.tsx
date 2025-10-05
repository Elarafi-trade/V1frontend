'use client';

import { useState, useEffect } from 'react';
import { useDepositWithdraw } from '@/hooks/useDepositWithdraw';
import { useDriftAccount } from '@/hooks/useDriftAccount';
import { ArrowDownToLine, ArrowUpFromLine, X } from 'lucide-react';

interface DepositWithdrawModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTab?: 'deposit' | 'withdraw';
}

export default function DepositWithdrawModal({ isOpen, onClose, defaultTab = 'deposit' }: DepositWithdrawModalProps) {
  const [activeTab, setActiveTab] = useState<'deposit' | 'withdraw'>(defaultTab);
  const [amount, setAmount] = useState('');
  const { deposit, withdraw, loading, error } = useDepositWithdraw();
  const { balance, refetch } = useDriftAccount();

  // Fetch balance when modal opens
  useEffect(() => {
    if (isOpen) {
      refetch();
    }
  }, [isOpen, refetch]);

  if (!isOpen) return null;

  const handleDeposit = async () => {
    try {
      const amountNum = parseFloat(amount);
      if (!amountNum || amountNum <= 0) {
        alert('Please enter a valid amount');
        return;
      }

      await deposit(amountNum);
      alert(`✅ Successfully deposited ${amountNum} SOL!\n\nUpdating balance...`);
      setAmount('');
      
      // Wait for Drift to settle the transaction before refreshing
      await new Promise(resolve => setTimeout(resolve, 2000));
      await refetch(); // Refresh modal balance
      
      // Trigger parent component refresh (if callback provided)
      if ((window as any).refreshDashboard) {
        (window as any).refreshDashboard();
      }
    } catch (err: any) {
      alert(`❌ Deposit failed: ${err.message}`);
    }
  };

  const handleWithdraw = async () => {
    try {
      const amountNum = parseFloat(amount);
      if (!amountNum || amountNum <= 0) {
        alert('Please enter a valid amount');
        return;
      }

      await withdraw(amountNum);
      alert(`✅ Successfully withdrew ${amountNum} SOL!\n\nUpdating balance...`);
      setAmount('');
      
      // Wait for Drift to settle the transaction before refreshing
      await new Promise(resolve => setTimeout(resolve, 2000));
      await refetch(); // Refresh modal balance
      
      // Trigger parent component refresh (if callback provided)
      if ((window as any).refreshDashboard) {
        (window as any).refreshDashboard();
      }
    } catch (err: any) {
      alert(`❌ Withdrawal failed: ${err.message}`);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" role="dialog" aria-modal="true">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      
      {/* Modal */}
      <div className="relative w-full max-w-md mx-4 rounded-2xl border border-border/60 bg-background/95 backdrop-blur-xl shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border/40">
          <h2 className="text-xl font-semibold">Manage Collateral</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-background/40 transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border/40">
          <button
            onClick={() => setActiveTab('deposit')}
            className={`flex-1 px-6 py-3 text-sm font-medium transition-colors ${
              activeTab === 'deposit'
                ? 'text-emerald-400 border-b-2 border-emerald-400'
                : 'text-foreground/60 hover:text-foreground'
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <ArrowDownToLine className="w-4 h-4" />
              Deposit
            </div>
          </button>
          <button
            onClick={() => setActiveTab('withdraw')}
            className={`flex-1 px-6 py-3 text-sm font-medium transition-colors ${
              activeTab === 'withdraw'
                ? 'text-purple-400 border-b-2 border-purple-400'
                : 'text-foreground/60 hover:text-foreground'
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <ArrowUpFromLine className="w-4 h-4" />
              Withdraw
            </div>
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Balance Info */}
          {balance && (
            <div className="mb-6 p-4 rounded-lg bg-background/40 border border-border/40">
              <div className="grid grid-cols-2 gap-4 text-sm mb-3">
                <div>
                  <div className="text-foreground/60">Total Collateral</div>
                  <div className="text-lg font-semibold">${balance.totalCollateral.toFixed(2)}</div>
                </div>
                <div>
                  <div className="text-foreground/60">Free Collateral</div>
                  <div className="text-lg font-semibold text-emerald-400">${balance.freeCollateral.toFixed(2)}</div>
                </div>
              </div>
              {balance.usedMargin > 0 && (
                <div className="pt-3 border-t border-border/40 text-xs text-foreground/60">
                  <div className="flex justify-between">
                    <span>Used in positions:</span>
                    <span className="text-orange-400 font-medium">${balance.usedMargin.toFixed(2)}</span>
                  </div>
                </div>
              )}
            </div>
          )}
          
          {/* SOL Collateral Weight Warning */}
          {activeTab === 'deposit' && (
            <div className="mb-4 p-3 rounded-lg bg-yellow-900/20 border border-yellow-500/30">
              <div className="flex gap-2 items-start">
                <div className="text-yellow-400 text-lg">⚠️</div>
                <div className="text-xs text-yellow-200/90">
                  <div className="font-semibold mb-1">SOL Collateral Weight (~29%)</div>
                  <div>Drift Protocol (devnet) values SOL at only ~29% of market price as collateral. This means 1 SOL at $200 = ~$58 usable collateral. Your actual usable collateral will be significantly lower than the SOL market value.</div>
                </div>
              </div>
            </div>
          )}

          {/* Input */}
          <div>
            <label className="block text-sm font-medium text-foreground/70 mb-2">
              Amount (SOL)
            </label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.0"
              step="0.01"
              min="0"
              className="w-full px-4 py-3 rounded-lg bg-background/40 border border-border text-lg font-medium focus:outline-none focus:ring-2 focus:ring-purple-500"
              disabled={loading}
            />
            
            {/* Quick amount buttons */}
            <div className="mt-3 flex gap-2">
              {activeTab === 'deposit' ? (
                <>
                  <button
                    onClick={() => setAmount('0.1')}
                    className="flex-1 px-3 py-2 rounded-lg bg-background/40 border border-border text-xs hover:bg-background/60"
                    disabled={loading}
                  >
                    0.1 SOL
                  </button>
                  <button
                    onClick={() => setAmount('0.5')}
                    className="flex-1 px-3 py-2 rounded-lg bg-background/40 border border-border text-xs hover:bg-background/60"
                    disabled={loading}
                  >
                    0.5 SOL
                  </button>
                  <button
                    onClick={() => setAmount('1')}
                    className="flex-1 px-3 py-2 rounded-lg bg-background/40 border border-border text-xs hover:bg-background/60"
                    disabled={loading}
                  >
                    1 SOL
                  </button>
                </>
              ) : (
                balance && (
                  <>
                    <button
                      onClick={() => {
                        // Estimate available SOL (free collateral / ~$200 per SOL)
                        const approxSOL = balance.freeCollateral / 200;
                        setAmount((approxSOL * 0.25).toFixed(4));
                      }}
                      className="flex-1 px-3 py-2 rounded-lg bg-background/40 border border-border text-xs hover:bg-background/60"
                      disabled={loading}
                    >
                      25%
                    </button>
                    <button
                      onClick={() => {
                        const approxSOL = balance.freeCollateral / 200;
                        setAmount((approxSOL * 0.5).toFixed(4));
                      }}
                      className="flex-1 px-3 py-2 rounded-lg bg-background/40 border border-border text-xs hover:bg-background/60"
                      disabled={loading}
                    >
                      50%
                    </button>
                    <button
                      onClick={() => {
                        const approxSOL = balance.freeCollateral / 200;
                        setAmount((approxSOL * 0.9).toFixed(4)); // 90% to leave small buffer
                      }}
                      className="flex-1 px-3 py-2 rounded-lg bg-background/40 border border-border text-xs hover:bg-background/60"
                      disabled={loading}
                    >
                      Max
                    </button>
                  </>
                )
              )}
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="mt-4 p-3 rounded-lg bg-red-900/20 border border-red-500/30 text-sm text-red-200">
              {error}
            </div>
          )}

          {/* Submit Button */}
          <button
            onClick={activeTab === 'deposit' ? handleDeposit : handleWithdraw}
            disabled={loading || !amount}
            className={`mt-6 w-full px-6 py-3 rounded-lg font-semibold transition-colors ${
              activeTab === 'deposit'
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                : 'bg-purple-600 hover:bg-purple-500 text-white'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {loading
              ? activeTab === 'deposit'
                ? 'Depositing...'
                : 'Withdrawing...'
              : activeTab === 'deposit'
              ? `Deposit ${amount || '0'} SOL`
              : `Withdraw ${amount || '0'} SOL`}
          </button>

          {/* Help Text */}
          <div className="mt-4 text-xs text-foreground/60 text-center">
            {activeTab === 'deposit' ? (
              <p>Deposit SOL to your Drift account to use as collateral for trading.</p>
            ) : (
              <p>Withdraw unused SOL back to your wallet. You can only withdraw free collateral.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

