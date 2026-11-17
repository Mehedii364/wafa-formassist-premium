// WAFA FormAssist Extension — Encrypted-Only Local Storage (AES-GCM-256 + PBKDF2-SHA256)
// Security Guarantee: Personal profile data is NEVER persisted in plaintext IndexedDB,
// localStorage, or chrome.storage.local. Derived CryptoKeys live strictly in ephemeral memory.

import {
  PBKDF2_ITERATIONS,
  SCHEMA_VERSION,
  base64ToBytes,
  bytesToBase64,
  decryptEnvelope,
  decryptWithKey,
  deriveAesKey,
  encryptWithKey,
  generateRandomBytes,
  sha256Hex,
  validateEncryptedEnvelope,
} from './crypto.js';

const DB_NAME = 'wafa_extension_vault_v1';
const DB_VERSION = 2;
const KEY_ENCRYPTED_ENVELOPE = 'encrypted_envelope';
const KEY_VAULT_META = 'vault_meta';
const LEGACY_PLAINTEXT_KEY = 'snapshot';

export const EMPTY_VAULT_SNAPSHOT = {
  profiles: [],
  addresses: [],
  educations: [],
  employments: [],
  sessions: [],
};

export const DEFAULT_EXT_SETTINGS = {
  language: 'en',
  dashboardUrl: 'http://localhost:3000',
  requireAutofillConfirmation: true,
  allowMediumConfidenceProposal: false,
  autoLockMinutes: 15,
  permittedDomains: ['dgbpo.teletalk.com.bd'],
  activeProfileId: null,
};

const ALLOWED_SETTINGS_KEYS = new Set(Object.keys(DEFAULT_EXT_SETTINGS));

// Ephemeral in-memory session key state (never written to disk or chrome.storage)
const memoryKeyState = {
  cryptoKey: null,
  salt: null,
  iterations: PBKDF2_ITERATIONS,
  lastActivityAt: 0,
};

// Optional test adapter injection (defaults to real browser IndexedDB + chrome.storage.local)
let customVaultStore = null;
let customSettingsStore = null;

export function configureExtensionStorageAdapters(adapters) {
  customVaultStore = adapters?.vaultStore || null;
  customSettingsStore = adapters?.settingsStore || null;
}

export function __resetExtensionMemoryForTests() {
  memoryKeyState.cryptoKey = null;
  memoryKeyState.salt = null;
  memoryKeyState.iterations = PBKDF2_ITERATIONS;
  memoryKeyState.lastActivityAt = 0;
}

function openExtDb() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('INDEXEDDB_UNAVAILABLE'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      const vaultStore = db.objectStoreNames.contains('vault')
        ? req.transaction.objectStore('vault')
        : db.createObjectStore('vault', {keyPath: 'key'});
      // Purge any legacy plaintext snapshot during upgrade
      try {
        vaultStore.delete(LEGACY_PLAINTEXT_KEY);
      } catch {
        // Ignore if absent
      }
      if (!db.objectStoreNames.contains('sessions')) {
        db.createObjectStore('sessions', {keyPath: 'id'});
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('INDEXEDDB_OPEN_FAILED'));
  });
}

async function vaultGet(key) {
  if (customVaultStore) return customVaultStore.get(key) ?? null;
  const db = await openExtDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('vault', 'readonly');
    const req = tx.objectStore('vault').get(key);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

async function vaultPut(record) {
  if (customVaultStore) {
    customVaultStore.put(record);
    return;
  }
  const db = await openExtDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('vault', 'readwrite');
    tx.objectStore('vault').put(record);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function vaultDelete(key) {
  if (customVaultStore) {
    customVaultStore.delete(key);
    return;
  }
  const db = await openExtDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('vault', 'readwrite');
    tx.objectStore('vault').delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function vaultClearAll() {
  if (customVaultStore) {
    customVaultStore.clear();
    return;
  }
  const db = await openExtDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['vault', 'sessions'], 'readwrite');
    tx.objectStore('vault').clear();
    tx.objectStore('sessions').clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

function sanitizeSettingsPartial(partial) {
  if (!partial || typeof partial !== 'object' || Array.isArray(partial)) {
    throw new Error('INVALID_SETTINGS_PAYLOAD');
  }
  const cleaned = {};
  for (const [k, v] of Object.entries(partial)) {
    if (!ALLOWED_SETTINGS_KEYS.has(k)) continue;
    if (k === 'language' && (v === 'en' || v === 'bn')) {
      cleaned.language = v;
    } else if (k === 'dashboardUrl' && typeof v === 'string') {
      let parsed;
      try {
        parsed = new URL(v.trim());
      } catch {
        throw new Error('INVALID_DASHBOARD_URL');
      }
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        throw new Error('INVALID_DASHBOARD_URL');
      }
      cleaned.dashboardUrl = parsed.origin;
    } else if (k === 'requireAutofillConfirmation' || k === 'allowMediumConfidenceProposal') {
      cleaned[k] = Boolean(v);
    } else if (k === 'autoLockMinutes') {
      const mins = Number(v);
      if (!Number.isFinite(mins) || mins < 1 || mins > 240) {
        throw new Error('INVALID_AUTOLOCK_MINUTES');
      }
      cleaned.autoLockMinutes = Math.round(mins);
    } else if (k === 'permittedDomains' && Array.isArray(v)) {
      cleaned.permittedDomains = v
        .filter((d) => typeof d === 'string' && /^[a-z0-9.-]{3,120}$/i.test(d.trim()))
        .map((d) => d.trim().toLowerCase());
    } else if (k === 'activeProfileId') {
      cleaned.activeProfileId = typeof v === 'string' && v.length <= 120 ? v : null;
    }
  }
  return cleaned;
}

export async function getExtensionSettings() {
  if (customSettingsStore) {
    return {...DEFAULT_EXT_SETTINGS, ...(customSettingsStore.get('wafa_settings') || {})};
  }
  if (typeof chrome !== 'undefined' && chrome.storage?.local) {
    const res = await chrome.storage.local.get('wafa_settings');
    return {...DEFAULT_EXT_SETTINGS, ...(res.wafa_settings || {})};
  }
  return {...DEFAULT_EXT_SETTINGS};
}

export async function saveExtensionSettings(partial) {
  const sanitized = sanitizeSettingsPartial(partial);
  const current = await getExtensionSettings();
  const next = {...current, ...sanitized};
  if (customSettingsStore) {
    customSettingsStore.set('wafa_settings', next);
    return next;
  }
  if (typeof chrome !== 'undefined' && chrome.storage?.local) {
    await chrome.storage.local.set({wafa_settings: next});
  }
  return next;
}

/**
 * Guarantees no legacy plaintext 'snapshot' record remains in IndexedDB.
 */
async function purgeLegacyPlaintextIfPresent() {
  try {
    const legacy = await vaultGet(LEGACY_PLAINTEXT_KEY);
    if (legacy) {
      await vaultDelete(LEGACY_PLAINTEXT_KEY);
    }
  } catch {
    // Non-fatal cleanup
  }
}

export function touchVaultActivity(nowMs = Date.now()) {
  if (memoryKeyState.cryptoKey) {
    memoryKeyState.lastActivityAt = nowMs;
  }
}

export function lockExtensionVault() {
  memoryKeyState.cryptoKey = null;
  memoryKeyState.salt = null;
  memoryKeyState.lastActivityAt = 0;
  return {locked: true};
}

export async function checkAndEnforceAutoLock(nowMs = Date.now()) {
  if (!memoryKeyState.cryptoKey) return {locked: true, autoLocked: false};
  const settings = await getExtensionSettings();
  const timeoutMs = Math.max(1, Number(settings.autoLockMinutes || 15)) * 60 * 1000;
  if (memoryKeyState.lastActivityAt > 0 && nowMs - memoryKeyState.lastActivityAt >= timeoutMs) {
    lockExtensionVault();
    return {locked: true, autoLocked: true};
  }
  return {locked: false, autoLocked: false};
}

export async function getVaultLockStatus(nowMs = Date.now()) {
  await purgeLegacyPlaintextIfPresent();
  await checkAndEnforceAutoLock(nowMs);
  const metaRec = await vaultGet(KEY_VAULT_META);
  const meta = metaRec?.value || null;
  return {
    initialized: Boolean(meta?.initialized && meta?.verifier),
    unlocked: Boolean(memoryKeyState.cryptoKey),
    profileCount: Number(meta?.profileCount || 0),
    updatedAt: meta?.updatedAt || null,
    iterations: meta?.iterations || PBKDF2_ITERATIONS,
  };
}

function normalizeSnapshot(snapshot) {
  const src = snapshot && typeof snapshot === 'object' ? snapshot : EMPTY_VAULT_SNAPSHOT;
  return {
    profiles: Array.isArray(src.profiles) ? src.profiles : [],
    addresses: Array.isArray(src.addresses) ? src.addresses : [],
    educations: Array.isArray(src.educations) ? src.educations : [],
    employments: Array.isArray(src.employments) ? src.employments : [],
    sessions: Array.isArray(src.sessions) ? src.sessions : [],
  };
}

/**
 * Initializes or rotates the extension vault passphrase using PBKDF2-SHA256 (600k iterations)
 * and persists ONLY AES-GCM-256 encrypted envelopes to IndexedDB.
 * @param {string} passphrase
 * @param {Record<string, any> | null} [initialSnapshot]
 */
export async function setupOrChangeVaultPassphrase(passphrase, initialSnapshot = null) {
  await purgeLegacyPlaintextIfPresent();
  const salt = generateRandomBytes(16);
  const key = await deriveAesKey(passphrase, salt, PBKDF2_ITERATIONS);
  const verifier = await encryptWithKey(
    {check: 'WAFA_EXT_VAULT_OK', schemaVersion: SCHEMA_VERSION},
    key,
    salt,
    PBKDF2_ITERATIONS,
  );

  let snapshotToStore = initialSnapshot ? normalizeSnapshot(initialSnapshot) : {...EMPTY_VAULT_SNAPSHOT};
  if (!initialSnapshot && memoryKeyState.cryptoKey) {
    try {
      snapshotToStore = await loadDecryptedVaultSnapshot();
    } catch {
      snapshotToStore = {...EMPTY_VAULT_SNAPSHOT};
    }
  }

  const encryptedEnvelope = await encryptWithKey(snapshotToStore, key, salt, PBKDF2_ITERATIONS);
  const updatedAt = new Date().toISOString();

  await vaultPut({key: KEY_ENCRYPTED_ENVELOPE, envelope: encryptedEnvelope, updatedAt});
  await vaultPut({
    key: KEY_VAULT_META,
    value: {
      initialized: true,
      salt: bytesToBase64(salt),
      iterations: PBKDF2_ITERATIONS,
      verifier,
      profileCount: snapshotToStore.profiles.length,
      updatedAt,
    },
    updatedAt,
  });

  memoryKeyState.cryptoKey = key;
  memoryKeyState.salt = salt;
  memoryKeyState.iterations = PBKDF2_ITERATIONS;
  memoryKeyState.lastActivityAt = Date.now();

  return {
    initialized: true,
    unlocked: true,
    profileCount: snapshotToStore.profiles.length,
    updatedAt,
  };
}

/**
 * Unlocks the encrypted extension vault into ephemeral service-worker memory.
 */
export async function unlockExtensionVault(passphrase) {
  await purgeLegacyPlaintextIfPresent();
  const metaRec = await vaultGet(KEY_VAULT_META);
  const meta = metaRec?.value;
  if (!meta?.initialized || !meta.salt || !meta.verifier) {
    throw new Error('VAULT_NOT_INITIALIZED');
  }
  const salt = base64ToBytes(meta.salt);
  const iterations = meta.iterations || meta.verifier.iterations || PBKDF2_ITERATIONS;
  const key = await deriveAesKey(passphrase, salt, iterations, {allowLegacyMinLength: true});
  const verified = await decryptWithKey(meta.verifier, key);
  if (!verified || verified.check !== 'WAFA_EXT_VAULT_OK') {
    throw new Error('DECRYPTION_FAILED');
  }

  memoryKeyState.cryptoKey = key;
  memoryKeyState.salt = salt;
  memoryKeyState.iterations = iterations;
  memoryKeyState.lastActivityAt = Date.now();

  return loadDecryptedVaultSnapshot();
}

/**
 * Encrypts and persists a VaultDataSnapshot with a fresh random 12-byte IV.
 * Refuses to write if the vault is locked — NEVER falls back to plaintext!
 */
export async function saveEncryptedVaultSnapshot(snapshot) {
  await purgeLegacyPlaintextIfPresent();
  const lockCheck = await checkAndEnforceAutoLock();
  if (lockCheck.locked || !memoryKeyState.cryptoKey || !memoryKeyState.salt) {
    throw new Error('VAULT_LOCKED');
  }
  const normalized = normalizeSnapshot(snapshot);
  const envelope = await encryptWithKey(
    normalized,
    memoryKeyState.cryptoKey,
    memoryKeyState.salt,
    memoryKeyState.iterations,
  );
  const updatedAt = new Date().toISOString();
  await vaultPut({key: KEY_ENCRYPTED_ENVELOPE, envelope, updatedAt});

  const metaRec = await vaultGet(KEY_VAULT_META);
  if (metaRec?.value) {
    await vaultPut({
      key: KEY_VAULT_META,
      value: {
        ...metaRec.value,
        profileCount: normalized.profiles.length,
        updatedAt,
      },
      updatedAt,
    });
  }
  touchVaultActivity();
  return {ok: true, profileCount: normalized.profiles.length, updatedAt};
}

/**
 * Decrypts the stored AES-GCM envelope strictly using the in-memory CryptoKey.
 */
export async function loadDecryptedVaultSnapshot() {
  await purgeLegacyPlaintextIfPresent();
  const lockCheck = await checkAndEnforceAutoLock();
  if (lockCheck.locked || !memoryKeyState.cryptoKey) {
    throw new Error('VAULT_LOCKED');
  }
  const rec = await vaultGet(KEY_ENCRYPTED_ENVELOPE);
  if (!rec?.envelope) {
    return {...EMPTY_VAULT_SNAPSHOT};
  }
  const decrypted = await decryptWithKey(rec.envelope, memoryKeyState.cryptoKey);
  touchVaultActivity();
  return normalizeSnapshot(decrypted);
}

/**
 * Imports a Dashboard BackupPackage (.wafa.json) into the encrypted extension vault.
 * Requires the vault to be unlocked OR a new vaultPassphrase to initialize the encrypted vault.
 */
export async function importBackupIntoEncryptedVault(backupPackage, backupPassphrase, vaultPassphrase) {
  if (!backupPackage || backupPackage.format !== 'WAFA_FORMASSIST_BACKUP') {
    throw new Error('INVALID_BACKUP_FORMAT');
  }

  let snapshot;
  if (backupPackage.encrypted) {
    if (!validateEncryptedEnvelope(backupPackage.envelope)) {
      throw new Error('ENVELOPE_INVALID');
    }
    if (!backupPassphrase) {
      throw new Error('BACKUP_PASSPHRASE_REQUIRED');
    }
    if (backupPackage.checksum) {
      const expected = await sha256Hex(
        `${backupPackage.schemaVersion}|encrypted|${backupPackage.envelope.integrityHash}`,
      );
      if (expected !== backupPackage.checksum) {
        throw new Error('BACKUP_INTEGRITY_FAILED');
      }
    }
    snapshot = normalizeSnapshot(await decryptEnvelope(backupPackage.envelope, backupPassphrase));
  } else {
    if (!backupPackage.payload || typeof backupPackage.payload !== 'object') {
      throw new Error('INVALID_BACKUP_FORMAT');
    }
    if (backupPackage.checksum) {
      const expected = await sha256Hex(
        `${backupPackage.schemaVersion}|plain|${JSON.stringify(backupPackage.payload)}`,
      );
      if (expected !== backupPackage.checksum) {
        throw new Error('BACKUP_INTEGRITY_FAILED');
      }
    }
    snapshot = normalizeSnapshot(backupPackage.payload);
  }

  const status = await getVaultLockStatus();
  if (!status.initialized) {
    const chosenPass = vaultPassphrase || backupPassphrase;
    if (!chosenPass || chosenPass.length < 8) {
      throw new Error('VAULT_PASSPHRASE_REQUIRED');
    }
    await setupOrChangeVaultPassphrase(chosenPass, snapshot);
  } else if (!status.unlocked) {
    if (!vaultPassphrase) {
      throw new Error('VAULT_LOCKED');
    }
    await unlockExtensionVault(vaultPassphrase);
    await saveEncryptedVaultSnapshot(snapshot);
  } else {
    await saveEncryptedVaultSnapshot(snapshot);
  }

  return {
    ok: true,
    profileCount: snapshot.profiles.length,
    addressCount: snapshot.addresses.length,
    educationCount: snapshot.educations.length,
    employmentCount: snapshot.employments.length,
  };
}

/**
 * Exports an AES-GCM encrypted .wafa.json backup package directly from the encrypted vault.
 */
export async function exportEncryptedVaultBackup() {
  const lockCheck = await checkAndEnforceAutoLock();
  if (lockCheck.locked || !memoryKeyState.cryptoKey) {
    throw new Error('VAULT_LOCKED');
  }
  const rec = await vaultGet(KEY_ENCRYPTED_ENVELOPE);
  if (!rec?.envelope || !validateEncryptedEnvelope(rec.envelope)) {
    throw new Error('VAULT_EMPTY');
  }
  const checksum = await sha256Hex(
    `${SCHEMA_VERSION}|encrypted|${rec.envelope.integrityHash}`,
  );
  touchVaultActivity();
  return {
    format: 'WAFA_FORMASSIST_BACKUP',
    schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    encrypted: true,
    checksum,
    envelope: rec.envelope,
  };
}

export async function appendExtensionSession(session) {
  // Strictly allow only non-PII telemetry/audit metadata in sessions store
  const safeSession = {
    id: String(session.id || `ext-sess-${Date.now()}`),
    schemaVersion: SCHEMA_VERSION,
    websiteId: String(session.websiteId || 'unknown').slice(0, 80),
    websiteDomain: String(session.websiteDomain || '').slice(0, 120),
    applicationRoute: String(session.applicationRoute || '').slice(0, 200),
    profileId: String(session.profileId || 'unknown').slice(0, 80),
    profileName: String(session.profileName || 'Selected Profile').slice(0, 80),
    timestamp: String(session.timestamp || new Date().toISOString()),
    scannedCount: Number(session.scannedCount || 0),
    filledCount: Number(session.filledCount || 0),
    skippedCount: Number(session.skippedCount || 0),
    unresolvedCount: Number(session.unresolvedCount || 0),
    failedCount: Number(session.failedCount || 0),
    protectedSkippedCount: Number(session.protectedSkippedCount || 0),
    status: String(session.status || 'AUTOFILLED').slice(0, 40),
    verifiedAfterFill: Boolean(session.verifiedAfterFill),
  };

  if (customVaultStore) {
    customVaultStore.appendSession(safeSession);
    return safeSession;
  }

  const db = await openExtDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('sessions', 'readwrite');
    tx.objectStore('sessions').put(safeSession);
    tx.oncomplete = () => resolve(safeSession);
    tx.onerror = () => reject(tx.error);
  });
}

export async function listExtensionSessions() {
  if (customVaultStore) {
    return customVaultStore.listSessions();
  }
  const db = await openExtDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('sessions', 'readonly');
    const req = tx.objectStore('sessions').getAll();
    req.onsuccess = () =>
      resolve((req.result || []).sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || '')));
    req.onerror = () => reject(req.error);
  });
}

export async function clearExtensionVault() {
  lockExtensionVault();
  await vaultClearAll();
  if (customSettingsStore) {
    customSettingsStore.delete('wafa_settings');
    return;
  }
  if (typeof chrome !== 'undefined' && chrome.storage?.local) {
    await chrome.storage.local.remove('wafa_settings');
  }
}
