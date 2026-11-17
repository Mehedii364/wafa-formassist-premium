import {useCallback, useEffect, useState} from 'react';

export type ConnectionQuality = 'good' | 'slow' | 'none';

export interface ConnectivityProbeState {
  browserOnline: boolean;
  apiReachable: boolean;
  latencyMs: number | null;
  quality: ConnectionQuality;
  lastCheckedAt: string | null;
}

/**
 * Treats navigator.onLine strictly as a hint and verifies real API reachability via /api/v1/health.
 */
export function useConnectivity(enabled: boolean) {
  const [state, setState] = useState<ConnectivityProbeState>({
    browserOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
    apiReachable: false,
    latencyMs: null,
    quality: typeof navigator !== 'undefined' && navigator.onLine ? 'good' : 'none',
    lastCheckedAt: null,
  });

  const probe = useCallback(async (): Promise<boolean> => {
    const browserOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
    if (!browserOnline) {
      setState({
        browserOnline: false,
        apiReachable: false,
        latencyMs: null,
        quality: 'none',
        lastCheckedAt: new Date().toISOString(),
      });
      return false;
    }

    const start = performance.now();
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 4500);
    try {
      const res = await fetch('/api/v1/health', {
        method: 'GET',
        cache: 'no-store',
        signal: controller.signal,
      });
      window.clearTimeout(timer);
      const latencyMs = Math.round(performance.now() - start);
      const ok = res.ok;
      setState({
        browserOnline: true,
        apiReachable: ok,
        latencyMs,
        quality: !ok ? 'none' : latencyMs > 800 ? 'slow' : 'good',
        lastCheckedAt: new Date().toISOString(),
      });
      return ok;
    } catch {
      window.clearTimeout(timer);
      setState({
        browserOnline: true,
        apiReachable: false,
        latencyMs: null,
        quality: 'none',
        lastCheckedAt: new Date().toISOString(),
      });
      return false;
    }
  }, []);

  useEffect(() => {
    probe();
    const onOnline = () => void probe();
    const onOffline = () => {
      setState((prev) => ({
        ...prev,
        browserOnline: false,
        apiReachable: false,
        latencyMs: null,
        quality: 'none',
        lastCheckedAt: new Date().toISOString(),
      }));
    };
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);

    const interval = window.setInterval(() => {
      if (enabled || (typeof navigator !== 'undefined' && navigator.onLine)) {
        void probe();
      }
    }, 30_000);

    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      window.clearInterval(interval);
    };
  }, [enabled, probe]);

  return {connectivity: state, checkConnectivity: probe};
}
