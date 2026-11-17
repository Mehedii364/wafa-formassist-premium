import test from 'node:test';
import assert from 'node:assert/strict';
import {
  __resetExtensionMemoryForTests,
  checkAndEnforceAutoLock,
  configureExtensionStorageAdapters,
  getVaultLockStatus,
  loadDecryptedVaultSnapshot,
  lockExtensionVault,
  saveEncryptedVaultSnapshot,
  saveExtensionSettings,
  setupOrChangeVaultPassphrase,
  unlockExtensionVault,
} from '../../extension/shared/storage.js';
import {
  __resetRouterRateLimitsForTests,
  routeMessage,
} from '../../extension/background/message-router.js';

function createMemoryAdapters() {
  const vaultMap = new Map<string, unknown>();
  const sessions: unknown[] = [];
  const settingsMap = new Map<string, unknown>();
  return {
    vaultMap,
    sessions,
    settingsMap,
    vaultStore: {
      get: (k: string) => vaultMap.get(k) ?? null,
      put: (rec: {key: string}) => {
        vaultMap.set(rec.key, structuredClone(rec));
      },
      delete: (k: string) => {
        vaultMap.delete(k);
      },
      clear: () => {
        vaultMap.clear();
        sessions.length = 0;
      },
      appendSession: (s: unknown) => {
        sessions.unshift(structuredClone(s));
      },
      listSessions: () => structuredClone(sessions),
    },
    settingsStore: {
      get: (k: string) => settingsMap.get(k),
      set: (k: string, v: unknown) => {
        settingsMap.set(k, structuredClone(v));
      },
      delete: (k: string) => {
        settingsMap.delete(k);
      },
    },
  };
}

test('extension storage persists ONLY AES-GCM ciphertext, purges legacy plaintext keys, and enforces lock/auto-lock', async () => {
  const mem = createMemoryAdapters();
  configureExtensionStorageAdapters(mem);
  __resetExtensionMemoryForTests();

  try {
    // Seed a legacy plaintext record to verify automatic purging
    mem.vaultMap.set('snapshot', {
      key: 'snapshot',
      value: {profiles: [{personalInformation: {nationalId: 'LEGACY-PLAINTEXT-NID'}}]},
    });

    const sampleSnapshot = {
      profiles: [
        {
          id: 'p-ext-1',
          profileName: 'Extension Profile',
          personalInformation: {
            applicantName: 'Tariqul Hasan',
            nationalId: '19991234567890123',
            mobileNumber: '01711223344',
            email: 'tariqul@example.com',
          },
        },
      ],
      addresses: [],
      educations: [],
      employments: [],
      sessions: [],
    };

    const setup = await setupOrChangeVaultPassphrase('ExtVaultPass#2026', sampleSnapshot);
    assert.equal(setup.initialized, true);
    assert.equal(setup.unlocked, true);
    assert.equal(setup.profileCount, 1);

    // Legacy plaintext key MUST be purged
    assert.equal(mem.vaultMap.has('snapshot'), false, 'Legacy plaintext snapshot key must be deleted');

    // Inspect EVERY persisted record in IndexedDB adapter — ZERO plaintext PII allowed
    const serializedAll = JSON.stringify(Array.from(mem.vaultMap.entries()));
    assert.equal(serializedAll.includes('Tariqul Hasan'), false);
    assert.equal(serializedAll.includes('19991234567890123'), false);
    assert.equal(serializedAll.includes('01711223344'), false);
    assert.equal(serializedAll.includes('tariqul@example.com'), false);
    assert.equal(serializedAll.includes('LEGACY-PLAINTEXT-NID'), false);

    // Lock vault -> reads & writes must refuse with VAULT_LOCKED
    lockExtensionVault();
    await assert.rejects(() => loadDecryptedVaultSnapshot(), /VAULT_LOCKED/);
    await assert.rejects(() => saveEncryptedVaultSnapshot(sampleSnapshot), /VAULT_LOCKED/);

    // Wrong passphrase rejected
    await assert.rejects(() => unlockExtensionVault('WrongExtPass#2026'), /DECRYPTION_FAILED/);

    // Correct passphrase decrypts cleanly
    const unlocked = await unlockExtensionVault('ExtVaultPass#2026');
    assert.equal(unlocked.profiles.length, 1);
    assert.equal(unlocked.profiles[0].personalInformation.nationalId, '19991234567890123');

    // Auto-lock enforcement after inactivity timeout
    await saveExtensionSettings({autoLockMinutes: 5});
    const futureMs = Date.now() + 6 * 60 * 1000;
    const autoCheck = await checkAndEnforceAutoLock(futureMs);
    assert.equal(autoCheck.locked, true);
    assert.equal(autoCheck.autoLocked, true);
    const status = await getVaultLockStatus();
    assert.equal(status.unlocked, false);

    // Settings sanitization rejects unsafe values
    await assert.rejects(() => saveExtensionSettings({autoLockMinutes: 9999}), /INVALID_AUTOLOCK_MINUTES/);
    await assert.rejects(() => saveExtensionSettings({dashboardUrl: 'javascript:alert(1)'}), /INVALID_DASHBOARD_URL/);
  } finally {
    __resetExtensionMemoryForTests();
    configureExtensionStorageAdapters(null);
  }
});

test('extension message router enforces fail-closed sender origin, payload schema, tab verification, and unlock throttle', async () => {
  const mem = createMemoryAdapters();
  configureExtensionStorageAdapters(mem);
  __resetExtensionMemoryForTests();
  __resetRouterRateLimitsForTests();

  const RUNTIME_ID = 'wafatestextensionid123456';
  const popupSender = {
    id: RUNTIME_ID,
    url: `chrome-extension://${RUNTIME_ID}/popup/popup.html`,
  };
  let activeTab = {id: 42, url: 'https://dgbpo.teletalk.com.bd/dgbpo2026/application.php'};
  const sentMessages: unknown[] = [];

  const mockChrome = {
    runtime: {id: RUNTIME_ID},
    tabs: {
      query: async () => [activeTab],
      sendMessage: async (_tabId: number, msg: unknown) => {
        sentMessages.push(msg);
        if ((msg as {type: string}).type === 'WAFA_CONTENT_SCAN_FORM') {
          return {fields: [{elementKey: 'wafa-field-1', name: 'applicant_name'}], protectedSkippedCount: 3};
        }
        return {filledCount: 1, skippedCount: 0, failedCount: 0};
      },
    },
  };

  try {
    // 1. Fail-closed sender verification
    const missingId = await routeMessage({type: 'WAFA_GET_STATE'}, {url: popupSender.url}, mockChrome);
    assert.equal(missingId.ok, false);
    assert.equal(missingId.error, 'UNAUTHORIZED_SENDER');

    const wrongId = await routeMessage(
      {type: 'WAFA_GET_STATE'},
      {id: 'evil-ext-id', url: 'chrome-extension://evil-ext-id/popup.html'},
      mockChrome,
    );
    assert.equal(wrongId.ok, false);
    assert.equal(wrongId.error, 'UNAUTHORIZED_SENDER');

    // Content script sender (has sender.tab) must NEVER access privileged vault/autofill actions
    const fromContentScript = await routeMessage(
      {type: 'WAFA_GET_STATE'},
      {id: RUNTIME_ID, tab: {id: 42}, url: 'https://dgbpo.teletalk.com.bd/dgbpo2026/application.php'},
      mockChrome,
    );
    assert.equal(fromContentScript.ok, false);
    assert.equal(fromContentScript.error, 'CONTENT_SCRIPT_NOT_PERMITTED');

    const badOrigin = await routeMessage(
      {type: 'WAFA_GET_STATE'},
      {id: RUNTIME_ID, url: 'https://evil.example.com/'},
      mockChrome,
    );
    assert.equal(badOrigin.ok, false);
    assert.equal(badOrigin.error, 'UNAUTHORIZED_ORIGIN');

    const unknownAction = await routeMessage({type: 'WAFA_ARBITRARY_EXEC'}, popupSender, mockChrome);
    assert.equal(unknownAction.ok, false);
    assert.equal(unknownAction.error, 'UNAUTHORIZED_MESSAGE_TYPE');

    // 2. Setup vault & verify unlock brute-force throttle after 5 failures
    const setupRes = await routeMessage(
      {type: 'WAFA_SETUP_VAULT', payload: {passphrase: 'RouterVault!2026'}},
      popupSender,
      mockChrome,
    );
    assert.equal(setupRes.ok, true);
    await routeMessage({type: 'WAFA_LOCK_VAULT'}, popupSender, mockChrome);

    for (let i = 0; i < 5; i += 1) {
      const failRes = await routeMessage(
        {type: 'WAFA_UNLOCK_VAULT', payload: {passphrase: `WrongPass#${i}`}},
        popupSender,
        mockChrome,
      );
      assert.equal(failRes.ok, false);
    }
    const throttled = await routeMessage(
      {type: 'WAFA_UNLOCK_VAULT', payload: {passphrase: 'RouterVault!2026'}},
      popupSender,
      mockChrome,
    );
    assert.equal(throttled.ok, false);
    assert.equal(throttled.error, 'UNLOCK_RATE_LIMITED');

    // Reset rate limit for subsequent payload/tab checks
    __resetRouterRateLimitsForTests();
    const unlockOk = await routeMessage(
      {type: 'WAFA_UNLOCK_VAULT', payload: {passphrase: 'RouterVault!2026'}},
      popupSender,
      mockChrome,
    );
    assert.equal(unlockOk.ok, true);

    // 3. Payload schema validation + tab binding + domain boundary
    const badKeyRes = await routeMessage(
      {
        type: 'WAFA_EXECUTE_AUTOFILL',
        payload: {
          tabId: 42,
          approvedFields: [{elementKey: '<script>bad</script>', transformedValue: 'x'}],
        },
      },
      popupSender,
      mockChrome,
    );
    assert.equal(badKeyRes.ok, false);
    assert.equal(badKeyRes.error, 'INVALID_ELEMENT_KEY');

    const wrongTabRes = await routeMessage(
      {
        type: 'WAFA_EXECUTE_AUTOFILL',
        payload: {
          tabId: 999,
          approvedFields: [{elementKey: 'wafa-field-1', transformedValue: 'Tariqul'}],
        },
      },
      popupSender,
      mockChrome,
    );
    assert.equal(wrongTabRes.ok, false);
    assert.equal(wrongTabRes.error, 'ACTIVE_TAB_CHANGED');

    // Unsupported website blocked cleanly
    activeTab = {id: 42, url: 'https://example.com/login'};
    const blockedSite = await routeMessage({type: 'WAFA_SCAN_ACTIVE_TAB'}, popupSender, mockChrome);
    assert.equal(blockedSite.ok, false);
    assert.equal(blockedSite.error, 'UNSUPPORTED_WEBSITE');

    // Supported portal succeeds
    activeTab = {id: 42, url: 'https://dgbpo.teletalk.com.bd/dgbpo2026/application.php'};
    const scanOk = await routeMessage({type: 'WAFA_SCAN_ACTIVE_TAB'}, popupSender, mockChrome);
    assert.equal(scanOk.ok, true);
    assert.equal(scanOk.protectedSkippedCount, 3);
  } finally {
    __resetExtensionMemoryForTests();
    __resetRouterRateLimitsForTests();
    configureExtensionStorageAdapters(null);
  }
});
