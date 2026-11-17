// WAFA FormAssist MV3 — Hardened Fail-Closed Message Router
// Enforces sender identity, extension-page origin checks, schema validation,
// tab/URL verification, unlock brute-force throttling, and inactivity auto-lock.

import {verifySupportedUrl} from '../adapters/dgbpo-2026/adapter.js';
import {
  appendExtensionSession,
  checkAndEnforceAutoLock,
  clearExtensionVault,
  exportEncryptedVaultBackup,
  getExtensionSettings,
  getVaultLockStatus,
  importBackupIntoEncryptedVault,
  listExtensionSessions,
  loadDecryptedVaultSnapshot,
  lockExtensionVault,
  saveExtensionSettings,
  setupOrChangeVaultPassphrase,
  touchVaultActivity,
  unlockExtensionVault,
} from '../shared/storage.js';

const PRIVILEGED_ACTIONS = new Set([
  'WAFA_GET_STATE',
  'WAFA_SETUP_VAULT',
  'WAFA_UNLOCK_VAULT',
  'WAFA_LOCK_VAULT',
  'WAFA_SAVE_SETTINGS',
  'WAFA_IMPORT_BACKUP',
  'WAFA_EXPORT_BACKUP',
  'WAFA_CLEAR_VAULT',
  'WAFA_VERIFY_ACTIVE_TAB',
  'WAFA_SCAN_ACTIVE_TAB',
  'WAFA_EXECUTE_AUTOFILL',
]);

const ELEMENT_KEY_RE = /^[a-zA-Z0-9_-]{1,64}$/;
const MAX_APPROVED_FIELDS = 120;
const MAX_FIELD_VALUE_LENGTH = 2000;

// In-memory rate-limiting state inside the MV3 service worker
const rateBuckets = {
  unlockFailures: [], // timestamps (ms) of failed unlock attempts
  actionCalls: [], // timestamps (ms) of scan/autofill calls
};

export function __resetRouterRateLimitsForTests() {
  rateBuckets.unlockFailures = [];
  rateBuckets.actionCalls = [];
}

function checkUnlockThrottle(nowMs = Date.now()) {
  const windowMs = 5 * 60 * 1000;
  rateBuckets.unlockFailures = rateBuckets.unlockFailures.filter((ts) => nowMs - ts < windowMs);
  if (rateBuckets.unlockFailures.length >= 5) {
    const oldest = rateBuckets.unlockFailures[0];
    const retryAfterSeconds = Math.max(1, Math.ceil((oldest + windowMs - nowMs) / 1000));
    return {blocked: true, retryAfterSeconds};
  }
  return {blocked: false, retryAfterSeconds: 0};
}

function recordUnlockFailure(nowMs = Date.now()) {
  rateBuckets.unlockFailures.push(nowMs);
}

function clearUnlockFailures() {
  rateBuckets.unlockFailures = [];
}

function checkActionThrottle(nowMs = Date.now()) {
  const windowMs = 60 * 1000;
  rateBuckets.actionCalls = rateBuckets.actionCalls.filter((ts) => nowMs - ts < windowMs);
  if (rateBuckets.actionCalls.length >= 20) {
    return {blocked: true};
  }
  rateBuckets.actionCalls.push(nowMs);
  return {blocked: false};
}

function validateSenderIsExtensionPage(sender, runtimeId) {
  if (!runtimeId || typeof runtimeId !== 'string') {
    return {ok: false, error: 'RUNTIME_ID_UNAVAILABLE'};
  }
  // Fail-closed: sender MUST have an explicit matching runtime ID
  if (!sender || sender.id !== runtimeId) {
    return {ok: false, error: 'UNAUTHORIZED_SENDER'};
  }
  // Privileged vault & autofill commands may ONLY come from this extension's own pages (popup/options),
  // NEVER from web pages or untrusted content scripts!
  if (sender.tab) {
    return {ok: false, error: 'CONTENT_SCRIPT_NOT_PERMITTED'};
  }
  const expectedPrefix = `chrome-extension://${runtimeId}/`;
  if (typeof sender.url !== 'string' || !sender.url.startsWith(expectedPrefix)) {
    return {ok: false, error: 'UNAUTHORIZED_ORIGIN'};
  }
  return {ok: true};
}

function validateApprovedFieldsPayload(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return {ok: false, error: 'INVALID_PAYLOAD'};
  }
  if (!Array.isArray(payload.approvedFields) || payload.approvedFields.length === 0) {
    return {ok: false, error: 'NO_APPROVED_FIELDS'};
  }
  if (payload.approvedFields.length > MAX_APPROVED_FIELDS) {
    return {ok: false, error: 'TOO_MANY_FIELDS'};
  }
  const sanitizedFields = [];
  for (const raw of payload.approvedFields) {
    if (!raw || typeof raw !== 'object') {
      return {ok: false, error: 'INVALID_FIELD_ITEM'};
    }
    if (typeof raw.elementKey !== 'string' || !ELEMENT_KEY_RE.test(raw.elementKey)) {
      return {ok: false, error: 'INVALID_ELEMENT_KEY'};
    }
    if (typeof raw.transformedValue !== 'string' || raw.transformedValue.length > MAX_FIELD_VALUE_LENGTH) {
      return {ok: false, error: 'INVALID_FIELD_VALUE'};
    }
    sanitizedFields.push({
      elementKey: raw.elementKey,
      fieldLabel: typeof raw.fieldLabel === 'string' ? raw.fieldLabel.slice(0, 120) : '',
      sourceProperty: typeof raw.sourceProperty === 'string' ? raw.sourceProperty.slice(0, 80) : null,
      transformedValue: raw.transformedValue,
      allowOverwrite: Boolean(raw.allowOverwrite),
    });
  }
  return {
    ok: true,
    approvedFields: sanitizedFields,
    expectedTabId: typeof payload.tabId === 'number' ? payload.tabId : null,
    profileId: typeof payload.profileId === 'string' ? payload.profileId.slice(0, 80) : 'unknown',
    profileName: typeof payload.profileName === 'string' ? payload.profileName.slice(0, 80) : 'Selected Profile',
    scannedCount: Number.isFinite(Number(payload.scannedCount)) ? Math.max(0, Number(payload.scannedCount)) : 0,
    skippedCount: Number.isFinite(Number(payload.skippedCount)) ? Math.max(0, Number(payload.skippedCount)) : 0,
    unresolvedCount: Number.isFinite(Number(payload.unresolvedCount)) ? Math.max(0, Number(payload.unresolvedCount)) : 0,
    protectedSkippedCount: Number.isFinite(Number(payload.protectedSkippedCount))
      ? Math.max(0, Number(payload.protectedSkippedCount))
      : 0,
  };
}

/**
 * @param {{type: string, payload?: any}} message
 * @param {{id?: string, url?: string, tab?: any}} sender
 * @param {any} [runtimeOverride]
 * @returns {Promise<Record<string, any>>}
 */
export async function routeMessage(message, sender, runtimeOverride = null) {
  const api = runtimeOverride || (typeof chrome !== 'undefined' ? chrome : null);
  const runtimeId = api?.runtime?.id;

  if (!message || typeof message !== 'object' || typeof message.type !== 'string') {
    return {ok: false, error: 'INVALID_MESSAGE'};
  }
  if (!PRIVILEGED_ACTIONS.has(message.type)) {
    return {ok: false, error: 'UNAUTHORIZED_MESSAGE_TYPE'};
  }

  const senderCheck = validateSenderIsExtensionPage(sender, runtimeId);
  if (!senderCheck.ok) {
    return senderCheck;
  }

  // Always enforce inactivity auto-lock before handling any message
  await checkAndEnforceAutoLock();

  switch (message.type) {
    case 'WAFA_GET_STATE': {
      const [settings, vaultStatus, sessions] = await Promise.all([
        getExtensionSettings(),
        getVaultLockStatus(),
        listExtensionSessions(),
      ]);
      let vault = null;
      if (vaultStatus.unlocked) {
        try {
          vault = await loadDecryptedVaultSnapshot();
        } catch {
          vault = null;
        }
      }
      return {ok: true, settings, vaultStatus, vault, sessions};
    }

    case 'WAFA_SETUP_VAULT': {
      const pass = message.payload?.passphrase;
      if (typeof pass !== 'string' || pass.length < 8 || pass.length > 128) {
        return {ok: false, error: 'PASSPHRASE_TOO_SHORT'};
      }
      const status = await setupOrChangeVaultPassphrase(pass);
      clearUnlockFailures();
      return {ok: true, vaultStatus: status};
    }

    case 'WAFA_UNLOCK_VAULT': {
      const throttle = checkUnlockThrottle();
      if (throttle.blocked) {
        return {
          ok: false,
          error: 'UNLOCK_RATE_LIMITED',
          retryAfterSeconds: throttle.retryAfterSeconds,
        };
      }
      const pass = message.payload?.passphrase;
      if (typeof pass !== 'string' || pass.length < 6 || pass.length > 128) {
        recordUnlockFailure();
        return {ok: false, error: 'INVALID_PASSPHRASE'};
      }
      try {
        const vault = await unlockExtensionVault(pass);
        clearUnlockFailures();
        const vaultStatus = await getVaultLockStatus();
        return {ok: true, vaultStatus, vault};
      } catch (err) {
        recordUnlockFailure();
        return {ok: false, error: err?.message || 'DECRYPTION_FAILED'};
      }
    }

    case 'WAFA_LOCK_VAULT': {
      lockExtensionVault();
      const vaultStatus = await getVaultLockStatus();
      return {ok: true, vaultStatus};
    }

    case 'WAFA_SAVE_SETTINGS': {
      try {
        const updated = await saveExtensionSettings(message.payload || {});
        touchVaultActivity();
        return {ok: true, settings: updated};
      } catch (err) {
        return {ok: false, error: err?.message || 'INVALID_SETTINGS_PAYLOAD'};
      }
    }

    case 'WAFA_IMPORT_BACKUP': {
      const pkg = message.payload?.backupPackage;
      const backupPassphrase =
        typeof message.payload?.backupPassphrase === 'string'
          ? message.payload.backupPassphrase
          : undefined;
      const vaultPassphrase =
        typeof message.payload?.vaultPassphrase === 'string'
          ? message.payload.vaultPassphrase
          : undefined;
      if (!pkg || typeof pkg !== 'object') {
        return {ok: false, error: 'INVALID_BACKUP_FORMAT'};
      }
      try {
        const summary = await importBackupIntoEncryptedVault(pkg, backupPassphrase, vaultPassphrase);
        const vaultStatus = await getVaultLockStatus();
        return {ok: true, summary, vaultStatus};
      } catch (err) {
        return {ok: false, error: err?.message || 'IMPORT_FAILED'};
      }
    }

    case 'WAFA_EXPORT_BACKUP': {
      try {
        const backupPackage = await exportEncryptedVaultBackup();
        return {ok: true, backupPackage};
      } catch (err) {
        return {ok: false, error: err?.message || 'EXPORT_FAILED'};
      }
    }

    case 'WAFA_CLEAR_VAULT': {
      await clearExtensionVault();
      clearUnlockFailures();
      const vaultStatus = await getVaultLockStatus();
      return {ok: true, vaultStatus};
    }

    case 'WAFA_VERIFY_ACTIVE_TAB': {
      const [tab] = await api.tabs.query({active: true, currentWindow: true});
      const settings = await getExtensionSettings();
      const verification = verifySupportedUrl(tab?.url || '', settings.permittedDomains);
      return {ok: true, tabId: tab?.id || null, verification};
    }

    case 'WAFA_SCAN_ACTIVE_TAB': {
      if (checkActionThrottle().blocked) {
        return {ok: false, error: 'RATE_LIMITED'};
      }
      const vaultStatus = await getVaultLockStatus();
      if (!vaultStatus.unlocked) {
        return {ok: false, error: 'VAULT_LOCKED'};
      }
      const [tab] = await api.tabs.query({active: true, currentWindow: true});
      if (!tab?.id) return {ok: false, error: 'NO_ACTIVE_TAB'};
      const settings = await getExtensionSettings();
      const verification = verifySupportedUrl(tab.url || '', settings.permittedDomains);
      if (!verification.supported) {
        return {ok: false, error: 'UNSUPPORTED_WEBSITE', verification};
      }
      const response = await api.tabs.sendMessage(tab.id, {type: 'WAFA_CONTENT_SCAN_FORM'});
      touchVaultActivity();
      return {
        ok: true,
        tabId: tab.id,
        verification,
        fields: Array.isArray(response?.fields) ? response.fields : [],
        protectedSkippedCount: Number(response?.protectedSkippedCount || 0),
        domRevision: Number(response?.domRevision || 0),
      };
    }

    case 'WAFA_EXECUTE_AUTOFILL': {
      if (checkActionThrottle().blocked) {
        return {ok: false, error: 'RATE_LIMITED'};
      }
      const vaultStatus = await getVaultLockStatus();
      if (!vaultStatus.unlocked) {
        return {ok: false, error: 'VAULT_LOCKED'};
      }
      const validated = validateApprovedFieldsPayload(message.payload);
      if (!validated.ok) {
        return {ok: false, error: validated.error};
      }
      const [tab] = await api.tabs.query({active: true, currentWindow: true});
      if (!tab?.id) return {ok: false, error: 'NO_ACTIVE_TAB'};
      if (validated.expectedTabId !== null && validated.expectedTabId !== tab.id) {
        return {ok: false, error: 'ACTIVE_TAB_CHANGED'};
      }
      const settings = await getExtensionSettings();
      const verification = verifySupportedUrl(tab.url || '', settings.permittedDomains);
      if (!verification.supported) {
        return {ok: false, error: 'PERMISSION_DENIED'};
      }

      const result = await api.tabs.sendMessage(tab.id, {
        type: 'WAFA_CONTENT_APPLY_AUTOFILL',
        payload: {approvedFields: validated.approvedFields},
      });
      touchVaultActivity();

      const totalSkipped = validated.skippedCount + Number(result?.skippedCount || 0);
      const sessionRecord = {
        id: `ext-sess-${Date.now()}`,
        schemaVersion: '1.0.0',
        websiteId: verification.adapter?.id || 'dgbpo-2026',
        websiteDomain: verification.domain,
        applicationRoute: verification.route,
        profileId: validated.profileId,
        profileName: validated.profileName,
        timestamp: new Date().toISOString(),
        scannedCount: validated.scannedCount,
        filledCount: Number(result?.filledCount || 0),
        skippedCount: totalSkipped,
        unresolvedCount: validated.unresolvedCount,
        failedCount: Number(result?.failedCount || 0),
        protectedSkippedCount: validated.protectedSkippedCount,
        status: (result?.failedCount || 0) > 0 ? 'PARTIALLY_COMPLETED' : 'AUTOFILLED',
        verifiedAfterFill: (result?.failedCount || 0) === 0,
      };
      await appendExtensionSession(sessionRecord);
      return {ok: true, result, session: sessionRecord};
    }

    default:
      return {ok: false, error: 'UNKNOWN_ACTION'};
  }
}
