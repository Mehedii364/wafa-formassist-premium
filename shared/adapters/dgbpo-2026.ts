import {WebsiteAdapterSpec} from '../schemas/types';

export const DGBPO_2026_ADAPTER: WebsiteAdapterSpec = {
  id: 'dgbpo-2026',
  name: 'Bangladesh Post Office (DGBPO 2026)',
  nameBn: 'বাংলাদেশ ডাক বিভাগ (DGBPO 2026)',
  organization: 'Bangladesh Post Office, Department of Posts',
  recruitmentCycle: 'DGBPO 2026',
  initialPost: 'Checker [চেকার]',
  domain: 'dgbpo.teletalk.com.bd',
  routes: ['/dgbpo2026/application.php'],
  version: '1.0.0',
  compatibilityStatus: 'SIMULATED_VERIFIED',
  lastVerifiedDate: '2026-11-17',
  supportedFieldCount: 52,
  enabled: true,
  capabilities: [
    'Domain & route verification (ignores personal query tokens)',
    'Bilingual English & Bengali label scanning',
    '7-layer confidence-scored field mapping',
    'Safe dropdown matching with ambiguity guard',
    'Dynamic Upazila / Same-as-Present MutationObserver support',
    'Post-fill value verification report',
  ],
  knownLimitations: [
    'Verified against deterministic local DGBPO 2026 simulated form fixture; live production DOM at dgbpo.teletalk.com.bd requires inspection during an active recruitment window with a valid session.',
    'Photo upload, signature upload, CAPTCHA / security validation code, and declaration checkbox are intentionally excluded from autofill and must be completed manually.',
    'Dynamic AJAX Upazila dropdowns depend on District change event completion; unresolved options are flagged for manual user selection.',
    'Never auto-submits the application; the applicant must independently review and submit.',
  ],
  source: 'builtin',
};

export interface RouteVerificationResult {
  supported: boolean;
  domainMatched: boolean;
  routeMatched: boolean;
  adapterId: string | null;
  reason: string;
}

/**
 * Verifies a URL strictly by hostname and pathname (never by page title alone,
 * and never logs or persists personal query tokens).
 */
export function verifyDgbpo2026Url(rawUrl: string): RouteVerificationResult {
  try {
    const parsed = new URL(rawUrl);
    const hostname = parsed.hostname.toLowerCase();
    const pathname = parsed.pathname.toLowerCase();

    // Also explicitly recognize local simulated fixture path for deterministic testing
    const isLocalFixture =
      (hostname === 'localhost' || hostname === '127.0.0.1' || parsed.protocol === 'file:') &&
      pathname.endsWith('/fixtures/dgbpo2026-simulated.html');

    if (isLocalFixture) {
      return {
        supported: true,
        domainMatched: true,
        routeMatched: true,
        adapterId: DGBPO_2026_ADAPTER.id,
        reason: 'Matched local deterministic DGBPO 2026 simulated fixture.',
      };
    }

    const domainMatched = hostname === DGBPO_2026_ADAPTER.domain;
    if (!domainMatched) {
      return {
        supported: false,
        domainMatched: false,
        routeMatched: false,
        adapterId: null,
        reason: `Hostname "${hostname}" is not a verified adapter domain.`,
      };
    }

    const routeMatched = DGBPO_2026_ADAPTER.routes.some((r) => pathname === r.toLowerCase());
    if (!routeMatched) {
      return {
        supported: false,
        domainMatched: true,
        routeMatched: false,
        adapterId: DGBPO_2026_ADAPTER.id,
        reason: `Route "${pathname}" does not match supported application routes (${DGBPO_2026_ADAPTER.routes.join(', ')}).`,
      };
    }

    return {
      supported: true,
      domainMatched: true,
      routeMatched: true,
      adapterId: DGBPO_2026_ADAPTER.id,
      reason: 'Verified DGBPO 2026 domain and application form route.',
    };
  } catch {
    return {
      supported: false,
      domainMatched: false,
      routeMatched: false,
      adapterId: null,
      reason: 'Malformed URL.',
    };
  }
}
