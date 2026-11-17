// WAFA FormAssist Extension — Independent Local Storage (IndexedDB + chrome.storage.local)
// Operates completely offline and does not depend on the web dashboard being open.

const DB_NAME = 'wafa_extension_vault_v1';
const DB_VERSION = 1;

export const DEFAULT_EXT_SETTINGS = {
  language: 'en',
  dashboardUrl: 'http://localhost:3000',
  requireAutofillConfirmation: true,
  allowMediumConfidenceProposal: false,
  permittedDomains: ['dgbpo.teletalk.com.bd'],
  activeProfileId: null,
};

function openExtDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('vault')) {
        db.createObjectStore('vault', {keyPath: 'key'});
      }
      if (!db.objectStoreNames.contains('sessions')) {
        db.createObjectStore('sessions', {keyPath: 'id'});
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function getExtensionSettings() {
  if (typeof chrome !== 'undefined' && chrome.storage?.local) {
    const res = await chrome.storage.local.get('wafa_settings');
    return {...DEFAULT_EXT_SETTINGS, ...(res.wafa_settings || {})};
  }
  return {...DEFAULT_EXT_SETTINGS};
}

export async function saveExtensionSettings(partial) {
  const current = await getExtensionSettings();
  const next = {...current, ...partial};
  if (typeof chrome !== 'undefined' && chrome.storage?.local) {
    await chrome.storage.local.set({wafa_settings: next});
  }
  return next;
}

export async function saveVaultSnapshot(snapshot) {
  const db = await openExtDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('vault', 'readwrite');
    tx.objectStore('vault').put({key: 'snapshot', value: snapshot, updatedAt: new Date().toISOString()});
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}

export async function loadVaultSnapshot() {
  const db = await openExtDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('vault', 'readonly');
    const req = tx.objectStore('vault').get('snapshot');
    req.onsuccess = () => {
      resolve(
        req.result?.value || {
          profiles: [],
          addresses: [],
          educations: [],
          employments: [],
          sessions: [],
        },
      );
    };
    req.onerror = () => reject(req.error);
  });
}

export async function appendExtensionSession(session) {
  const db = await openExtDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('sessions', 'readwrite');
    tx.objectStore('sessions').put(session);
    tx.oncomplete = () => resolve(session);
    tx.onerror = () => reject(tx.error);
  });
}

export async function listExtensionSessions() {
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
  const db = await openExtDb();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(['vault', 'sessions'], 'readwrite');
    tx.objectStore('vault').clear();
    tx.objectStore('sessions').clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  if (typeof chrome !== 'undefined' && chrome.storage?.local) {
    await chrome.storage.local.remove('wafa_settings');
  }
}
