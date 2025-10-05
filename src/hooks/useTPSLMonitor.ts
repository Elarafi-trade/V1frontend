'use client';

import { useEffect, useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';

/**
 * Hook to monitor TP/SL triggers
 * Polls the monitoring API every 30 seconds when user has open positions
 */
export const useTPSLMonitor = () => {
  const wallet = useWallet();
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [lastCheck, setLastCheck] = useState<Date | null>(null);
  const [triggeredCount, setTriggeredCount] = useState(0);

  useEffect(() => {
    if (!wallet.connected) {
      setIsMonitoring(false);
      return;
    }

    setIsMonitoring(true);

    const monitorTPSL = async () => {
      try {
        console.log('🔍 Checking TP/SL triggers...');
        
        const response = await fetch('/api/monitor/tp-sl');
        
        if (!response.ok) {
          console.error('❌ Monitoring API error:', response.status);
          return;
        }

        const data = await response.json();
        
        setLastCheck(new Date());

        if (data.triggered > 0) {
          console.log(`✅ ${data.triggered} position(s) auto-closed!`);
          setTriggeredCount(prev => prev + data.triggered);
          
          // Show notification
          if (typeof window !== 'undefined' && 'Notification' in window) {
            if (Notification.permission === 'granted') {
              new Notification('🎯 Position Auto-Closed!', {
                body: `${data.triggered} position(s) hit TP/SL target and were closed automatically.`,
                icon: '/sol.png',
              });
            }
          }
        } else if (data.monitored > 0) {
          console.log(`✓ Monitored ${data.monitored} position(s) - no triggers`);
        }
      } catch (error) {
        console.error('❌ Error in TP/SL monitoring:', error);
      }
    };

    // Run immediately
    monitorTPSL();

    // Then run every 30 seconds
    const interval = setInterval(monitorTPSL, 30000);

    return () => {
      clearInterval(interval);
      setIsMonitoring(false);
    };
  }, [wallet.connected]);

  return {
    isMonitoring,
    lastCheck,
    triggeredCount,
  };
};

