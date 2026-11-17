import {WebsiteAdapterSpec} from '../schemas/types';
import {DGBPO_2026_ADAPTER, verifyDgbpo2026Url} from './dgbpo-2026';

export const BUILTIN_ADAPTERS: WebsiteAdapterSpec[] = [DGBPO_2026_ADAPTER];

export function matchUrlToAdapter(
  url: string,
  adapters: WebsiteAdapterSpec[] = BUILTIN_ADAPTERS,
): {adapter: WebsiteAdapterSpec | null; domainMatched: boolean; routeMatched: boolean; reason: string} {
  const dgbpoCheck = verifyDgbpo2026Url(url);
  if (dgbpoCheck.adapterId) {
    const found = adapters.find((a) => a.id === dgbpoCheck.adapterId) || DGBPO_2026_ADAPTER;
    return {
      adapter: found,
      domainMatched: dgbpoCheck.domainMatched,
      routeMatched: dgbpoCheck.routeMatched,
      reason: dgbpoCheck.reason,
    };
  }

  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    const path = parsed.pathname.toLowerCase();
    for (const adapter of adapters) {
      if (adapter.domain.toLowerCase() === host) {
        const routeMatched = adapter.routes.some((r) => path === r.toLowerCase());
        return {
          adapter,
          domainMatched: true,
          routeMatched,
          reason: routeMatched
            ? `Matched registered adapter ${adapter.name}`
            : `Domain matched ${adapter.domain}, but path "${path}" is not an application form route.`,
        };
      }
    }
    return {
      adapter: null,
      domainMatched: false,
      routeMatched: false,
      reason: `Unsupported domain "${host}".`,
    };
  } catch {
    return {
      adapter: null,
      domainMatched: false,
      routeMatched: false,
      reason: 'Invalid URL.',
    };
  }
}

export function mergeRemoteAdapters(
  existing: WebsiteAdapterSpec[],
  remoteUpdates: WebsiteAdapterSpec[],
): WebsiteAdapterSpec[] {
  const map = new Map<string, WebsiteAdapterSpec>();
  for (const item of existing) {
    map.set(item.id, item);
  }
  for (const remote of remoteUpdates) {
    const current = map.get(remote.id);
    if (!current) {
      map.set(remote.id, {...remote, source: 'remote-update', enabled: false}); // Safe default: opt-in
    } else if (remote.version !== current.version) {
      map.set(remote.id, {
        ...remote,
        enabled: current.enabled, // Preserve user's explicit permission choice
        source: 'remote-update',
      });
    }
  }
  return Array.from(map.values());
}
