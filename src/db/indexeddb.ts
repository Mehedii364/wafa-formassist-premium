import {BUILTIN_ADAPTERS} from '../../shared/adapters/registry';
import {
  AddressRecord,
  AppSettings,
  AutofillSessionRecord,
  BackupPackage,
  DB_VERSION,
  EducationRecord,
  EmploymentRecord,
  EncryptedEnvelope,
  ProfileRecord,
  SCHEMA_VERSION,
  SyncConflictRecord,
  SyncQueueItem,
  VaultDataSnapshot,
  WebsiteAdapterSpec,
} from '../../shared/schemas/types';
import {
  base64ToBytes,
  decryptJsonWithKey,
  decryptJsonWithPassphrase,
  deriveAesKey,
  encryptJsonWithKey,
  encryptJsonWithPassphrase,
  generateRandomBytes,
  PBKDF2_ITERATIONS,
  sha256Hex,
  bytesToBase64,
} from '../../shared/security/crypto';

const DB_NAME = 'wafa_formassist_db';

export const DEFAULT_SETTINGS: AppSettings = {
  language: 'en',
  theme: 'dark',
  defaultProfileId: null,
  requireAutofillConfirmation: true,
  allowMediumConfidenceProposal: false,
  autoLockMinutes: 15,
  saveSessionHistory: true,
  maskSensitiveFields: true,
  cloudSyncEnabled: false,
  autoSyncWhenOnline: false,
  permittedDomains: ['dgbpo.teletalk.com.bd'],
  encryptionEnabled: false,
  vaultSalt: null,
  vaultVerifier: null,
  localSyncVersion: 0,
  lastSyncedAt: null,
};

export const EMPTY_SNAPSHOT: VaultDataSnapshot = {
  profiles: [],
  addresses: [],
  educations: [],
  employments: [],
  sessions: [],
};

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('INDEXEDDB_UNAVAILABLE'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('profiles')) {
        db.createObjectStore('profiles', {keyPath: 'id'});
      }
      if (!db.objectStoreNames.contains('addresses')) {
        const s = db.createObjectStore('addresses', {keyPath: 'id'});
        s.createIndex('by_profile', 'profileId', {unique: false});
      }
      if (!db.objectStoreNames.contains('educations')) {
        const s = db.createObjectStore('educations', {keyPath: 'id'});
        s.createIndex('by_profile', 'profileId', {unique: false});
      }
      if (!db.objectStoreNames.contains('employments')) {
        const s = db.createObjectStore('employments', {keyPath: 'id'});
        s.createIndex('by_profile', 'profileId', {unique: false});
      }
      if (!db.objectStoreNames.contains('sessions')) {
        db.createObjectStore('sessions', {keyPath: 'id'});
      }
      if (!db.objectStoreNames.contains('adapters')) {
        db.createObjectStore('adapters', {keyPath: 'id'});
      }
      if (!db.objectStoreNames.contains('syncQueue')) {
        db.createObjectStore('syncQueue', {keyPath: 'id'});
      }
      if (!db.objectStoreNames.contains('syncConflicts')) {
        db.createObjectStore('syncConflicts', {keyPath: 'id'});
      }
      if (!db.objectStoreNames.contains('meta')) {
        db.createObjectStore('meta', {keyPath: 'key'});
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('STORAGE_OPEN_FAILED'));
  });
}

async function getAllFromStore<T>(db: IDBDatabase, storeName: string): Promise<T[]> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const req = tx.objectStore(storeName).getAll();
    req.onsuccess = () => resolve((req.result || []) as T[]);
    req.onerror = () => reject(req.error);
  });
}

async function getMeta<T>(db: IDBDatabase, key: string): Promise<T | null> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('meta', 'readonly');
    const req = tx.objectStore('meta').get(key);
    req.onsuccess = () => resolve(req.result ? (req.result.value as T) : null);
    req.onerror = () => reject(req.error);
  });
}

async function putMeta<T>(db: IDBDatabase, key: string, value: T): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('meta', 'readwrite');
    tx.objectStore('meta').put({key, value});
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function replaceStoreItems<T>(
  db: IDBDatabase,
  storeName: string,
  items: T[],
): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    store.clear();
    for (const item of items) {
      store.put(item);
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export class LocalVaultRepository {
  private dbPromise: Promise<IDBDatabase> | null = null;
  private activeKey: CryptoKey | null = null;
  private activeSalt: Uint8Array | null = null;

  private getDb(): Promise<IDBDatabase> {
    if (!this.dbPromise) {
      this.dbPromise = openDatabase();
    }
    return this.dbPromise;
  }

  public isUnlocked(): boolean {
    return this.activeKey !== null;
  }

  public lockVault(): void {
    this.activeKey = null;
  }

  public async loadSettings(): Promise<AppSettings> {
    const db = await this.getDb();
    const saved = await getMeta<Partial<AppSettings>>(db, 'settings');
    return {...DEFAULT_SETTINGS, ...(saved || {})};
  }

  public async saveSettings(settings: AppSettings): Promise<void> {
    const db = await this.getDb();
    await putMeta(db, 'settings', settings);
  }

  public async loadAdapters(): Promise<WebsiteAdapterSpec[]> {
    const db = await this.getDb();
    const saved = await getAllFromStore<WebsiteAdapterSpec>(db, 'adapters');
    if (saved.length === 0) {
      await replaceStoreItems(db, 'adapters', BUILTIN_ADAPTERS);
      return BUILTIN_ADAPTERS;
    }
    return saved;
  }

  public async saveAdapters(adapters: WebsiteAdapterSpec[]): Promise<void> {
    const db = await this.getDb();
    await replaceStoreItems(db, 'adapters', adapters);
  }

  public async loadSyncQueue(): Promise<SyncQueueItem[]> {
    const db = await this.getDb();
    return getAllFromStore<SyncQueueItem>(db, 'syncQueue');
  }

  public async saveSyncQueue(items: SyncQueueItem[]): Promise<void> {
    const db = await this.getDb();
    await replaceStoreItems(db, 'syncQueue', items);
  }

  public async loadSyncConflicts(): Promise<SyncConflictRecord[]> {
    const db = await this.getDb();
    return getAllFromStore<SyncConflictRecord>(db, 'syncConflicts');
  }

  public async saveSyncConflicts(items: SyncConflictRecord[]): Promise<void> {
    const db = await this.getDb();
    await replaceStoreItems(db, 'syncConflicts', items);
  }

  /**
   * Loads vault snapshot from IndexedDB.
   * When encryption is enabled, decrypts exclusively using in-memory CryptoKey.
   */
  public async loadVaultSnapshot(settings: AppSettings): Promise<VaultDataSnapshot> {
    const db = await this.getDb();
    if (settings.encryptionEnabled) {
      if (!this.activeKey) {
        throw new Error('VAULT_LOCKED');
      }
      const envelope = await getMeta<EncryptedEnvelope>(db, 'encrypted_vault');
      if (!envelope) {
        return {...EMPTY_SNAPSHOT};
      }
      const decrypted = await decryptJsonWithKey<VaultDataSnapshot>(envelope, this.activeKey);
      return {
        profiles: decrypted.profiles || [],
        addresses: decrypted.addresses || [],
        educations: decrypted.educations || [],
        employments: decrypted.employments || [],
        sessions: decrypted.sessions || [],
      };
    }

    const [profiles, addresses, educations, employments, sessions] = await Promise.all([
      getAllFromStore<ProfileRecord>(db, 'profiles'),
      getAllFromStore<AddressRecord>(db, 'addresses'),
      getAllFromStore<EducationRecord>(db, 'educations'),
      getAllFromStore<EmploymentRecord>(db, 'employments'),
      getAllFromStore<AutofillSessionRecord>(db, 'sessions'),
    ]);
    return {profiles, addresses, educations, employments, sessions};
  }

  /**
   * Persists the full snapshot transactionally.
   * When encryption is enabled, writes ONLY the AES-GCM EncryptedEnvelope and wipes plaintext stores.
   */
  public async saveVaultSnapshot(
    snapshot: VaultDataSnapshot,
    settings: AppSettings,
  ): Promise<void> {
    const db = await this.getDb();
    if (settings.encryptionEnabled) {
      if (!this.activeKey || !this.activeSalt) {
        throw new Error('VAULT_LOCKED');
      }
      const envelope = await encryptJsonWithKey(
        snapshot,
        this.activeKey,
        this.activeSalt,
        generateRandomBytes(12),
        PBKDF2_ITERATIONS,
      );
      await putMeta(db, 'encrypted_vault', envelope);
      // Guarantee zero plaintext remnants in IndexedDB when vault encryption is enabled
      await Promise.all([
        replaceStoreItems(db, 'profiles', []),
        replaceStoreItems(db, 'addresses', []),
        replaceStoreItems(db, 'educations', []),
        replaceStoreItems(db, 'employments', []),
        replaceStoreItems(db, 'sessions', []),
      ]);
      return;
    }

    await Promise.all([
      replaceStoreItems(db, 'profiles', snapshot.profiles),
      replaceStoreItems(db, 'addresses', snapshot.addresses),
      replaceStoreItems(db, 'educations', snapshot.educations),
      replaceStoreItems(db, 'employments', snapshot.employments),
      replaceStoreItems(db, 'sessions', snapshot.sessions),
    ]);
  }

  /**
   * Enables or updates AES-GCM local vault encryption and re-encrypts all records immediately.
   */
  public async enableOrUpdateEncryption(
    passphrase: string,
    currentSnapshot: VaultDataSnapshot,
    currentSettings: AppSettings,
  ): Promise<AppSettings> {
    const salt = generateRandomBytes(16);
    const key = await deriveAesKey(passphrase, salt, PBKDF2_ITERATIONS);
    const verifier = await encryptJsonWithKey(
      {check: 'WAFA_VAULT_OK', schemaVersion: SCHEMA_VERSION},
      key,
      salt,
      generateRandomBytes(12),
      PBKDF2_ITERATIONS,
    );

    this.activeKey = key;
    this.activeSalt = salt;

    const updatedSettings: AppSettings = {
      ...currentSettings,
      encryptionEnabled: true,
      vaultSalt: bytesToBase64(salt),
      vaultVerifier: verifier,
    };

    await this.saveVaultSnapshot(currentSnapshot, updatedSettings);
    await this.saveSettings(updatedSettings);
    return updatedSettings;
  }

  /**
   * Unlocks an encrypted local vault using user passphrase without ever persisting the key.
   */
  public async unlockWithPassphrase(
    passphrase: string,
    settings: AppSettings,
  ): Promise<VaultDataSnapshot> {
    if (!settings.vaultSalt || !settings.vaultVerifier) {
      throw new Error('ENCRYPTION_METADATA_MISSING');
    }
    const salt = base64ToBytes(settings.vaultSalt);
    const key = await deriveAesKey(passphrase, salt, settings.vaultVerifier.iterations || PBKDF2_ITERATIONS);
    const verified = await decryptJsonWithKey<{check: string}>(settings.vaultVerifier, key);
    if (verified.check !== 'WAFA_VAULT_OK') {
      throw new Error('DECRYPTION_FAILED');
    }
    this.activeKey = key;
    this.activeSalt = salt;
    return this.loadVaultSnapshot(settings);
  }

  /**
   * Creates an integrity-checked backup package (AES-GCM encrypted or explicit plaintext).
   */
  public async createBackupPackage(
    snapshot: VaultDataSnapshot,
    options: {encrypted: boolean; passphrase?: string},
  ): Promise<BackupPackage> {
    const exportedAt = new Date().toISOString();
    if (options.encrypted) {
      if (!options.passphrase || options.passphrase.length < 6) {
        throw new Error('PASSPHRASE_TOO_SHORT');
      }
      const envelope = await encryptJsonWithPassphrase(snapshot, options.passphrase);
      const checksum = await sha256Hex(`${SCHEMA_VERSION}|encrypted|${envelope.integrityHash}`);
      return {
        format: 'WAFA_FORMASSIST_BACKUP',
        schemaVersion: SCHEMA_VERSION,
        exportedAt,
        encrypted: true,
        checksum,
        envelope,
      };
    }
    const payloadJson = JSON.stringify(snapshot);
    const checksum = await sha256Hex(`${SCHEMA_VERSION}|plain|${payloadJson}`);
    return {
      format: 'WAFA_FORMASSIST_BACKUP',
      schemaVersion: SCHEMA_VERSION,
      exportedAt,
      encrypted: false,
      checksum,
      payload: snapshot,
    };
  }

  /**
   * Validates schema version, SHA-256 checksum, and decrypts backup for Restore Preview.
   */
  public async inspectBackupPackage(
    rawJson: string,
    passphrase?: string,
  ): Promise<{packageMeta: BackupPackage; snapshot: VaultDataSnapshot}> {
    let parsed: BackupPackage;
    try {
      parsed = JSON.parse(rawJson) as BackupPackage;
    } catch {
      throw new Error('BACKUP_CORRUPTION');
    }

    if (
      !parsed ||
      parsed.format !== 'WAFA_FORMASSIST_BACKUP' ||
      !parsed.schemaVersion ||
      !parsed.checksum
    ) {
      throw new Error('BACKUP_CORRUPTION');
    }

    if (parsed.encrypted) {
      if (!parsed.envelope) throw new Error('BACKUP_CORRUPTION');
      const expectedChecksum = await sha256Hex(
        `${parsed.schemaVersion}|encrypted|${parsed.envelope.integrityHash}`,
      );
      if (expectedChecksum !== parsed.checksum) {
        throw new Error('BACKUP_CORRUPTION');
      }
      if (!passphrase) {
        throw new Error('PASSPHRASE_REQUIRED');
      }
      const snapshot = await decryptJsonWithPassphrase<VaultDataSnapshot>(parsed.envelope, passphrase);
      return {packageMeta: parsed, snapshot};
    }

    if (!parsed.payload) throw new Error('BACKUP_CORRUPTION');
    const expectedChecksum = await sha256Hex(
      `${parsed.schemaVersion}|plain|${JSON.stringify(parsed.payload)}`,
    );
    if (expectedChecksum !== parsed.checksum) {
      throw new Error('BACKUP_CORRUPTION');
    }
    return {packageMeta: parsed, snapshot: parsed.payload};
  }

  public async eraseAllLocalData(): Promise<void> {
    const db = await this.getDb();
    this.activeKey = null;
    this.activeSalt = null;
    await Promise.all([
      replaceStoreItems(db, 'profiles', []),
      replaceStoreItems(db, 'addresses', []),
      replaceStoreItems(db, 'educations', []),
      replaceStoreItems(db, 'employments', []),
      replaceStoreItems(db, 'sessions', []),
      replaceStoreItems(db, 'syncQueue', []),
      replaceStoreItems(db, 'syncConflicts', []),
      putMeta(db, 'encrypted_vault', null),
      putMeta(db, 'settings', DEFAULT_SETTINGS),
    ]);
  }
}

export const localVaultRepo = new LocalVaultRepository();
