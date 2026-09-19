import { useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { useAuth } from '../store/auth';

/**
 * Refresh scans + balance when app regains focus, and poll a few times
 * after returning from a payment browser session.
 */
export function usePaymentRefresh(expectedDelta?: number) {
  const refreshScans = useAuth((s) => s.refreshScans);
  const [polling, setPolling] = useState(false);
  const intervalRef = useRef<any>(null);

  useEffect(() => {
    const handler = (state: AppStateStatus) => {
      if (state === 'active') {
        refreshScans();
        // Poll 5 times over 15 s in case the webhook is slow
        setPolling(true);
        let ticks = 0;
        if (intervalRef.current) clearInterval(intervalRef.current);
        intervalRef.current = setInterval(() => {
          ticks += 1;
          refreshScans();
          if (ticks >= 5) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
            setPolling(false);
          }
        }, 3000);
      }
    };
    const sub = AppState.addEventListener('change', handler);
    return () => {
      sub.remove();
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [refreshScans]);

  return { polling };
}
