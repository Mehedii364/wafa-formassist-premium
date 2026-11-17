// WAFA FormAssist Extension — Dedicated DGBPO 2026 Website Adapter

export const DGBPO_2026_ADAPTER = {
  id: 'dgbpo-2026',
  name: 'Bangladesh Post Office (DGBPO 2026)',
  organization: 'Bangladesh Post Office, Department of Posts',
  recruitment: 'DGBPO 2026',
  post: 'General Recruitment Application',
  domain: 'dgbpo.teletalk.com.bd',
  routes: ['/dgbpo2026/application.php'],
  version: '1.0.0',
  compatibilityStatus: 'SIMULATED_VERIFIED',
};

export function verifySupportedUrl(rawUrl, permittedDomains = ['dgbpo.teletalk.com.bd']) {
  try {
    const parsed = new URL(rawUrl);
    const host = parsed.hostname.toLowerCase();
    const pathname = parsed.pathname.toLowerCase();

    // Never log or expose personal query tokens in URL
    const isLocalFixture =
      (host === 'localhost' || host === '127.0.0.1' || parsed.protocol === 'file:') &&
      pathname.endsWith('/fixtures/dgbpo2026-simulated.html');

    if (isLocalFixture) {
      return {
        supported: true,
        domain: host || 'local-fixture',
        route: pathname,
        adapter: DGBPO_2026_ADAPTER,
        permissionGranted: true,
        reason: 'Deterministic local DGBPO 2026 simulated fixture detected.',
      };
    }

    if (host !== DGBPO_2026_ADAPTER.domain) {
      return {
        supported: false,
        domain: host,
        route: pathname,
        adapter: null,
        permissionGranted: false,
        reason: 'Unsupported website domain.',
      };
    }

    const permissionGranted = permittedDomains.includes(host);
    const routeMatched = DGBPO_2026_ADAPTER.routes.some((r) => pathname === r.toLowerCase());
    if (!routeMatched) {
      return {
        supported: false,
        domain: host,
        route: pathname,
        adapter: DGBPO_2026_ADAPTER,
        permissionGranted,
        reason: 'Supported domain, but not on the /dgbpo2026/application.php form route.',
      };
    }

    return {
      supported: permissionGranted,
      domain: host,
      route: pathname,
      adapter: DGBPO_2026_ADAPTER,
      permissionGranted,
      reason: permissionGranted
        ? 'Verified DGBPO 2026 application form route.'
        : 'Domain permission disabled in extension settings.',
    };
  } catch {
    return {
      supported: false,
      domain: 'unknown',
      route: '',
      adapter: null,
      permissionGranted: false,
      reason: 'Invalid tab URL.',
    };
  }
}
