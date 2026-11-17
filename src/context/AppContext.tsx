import React, {createContext, useCallback, useContext, useEffect, useMemo, useRef, useState} from 'react';
import {mergeRemoteAdapters} from '../../shared/adapters/registry';
import {getDictionary} from '../../shared/localization';
import {
  AddressRecord,
  AppSettings,
  AutofillSessionRecord,
  ConnectivityState,
  EducationRecord,
  EmploymentRecord,
  EncryptedEnvelope,
  LanguageCode,
  ProfileRecord,
  SCHEMA_VERSION,
  SyncConflictRecord,
  SyncQueueItem,
  ThemeMode,
  VaultDataSnapshot,
  WebsiteAdapterSpec,
} from '../../shared/schemas/types';
import {
  decryptJsonWithPassphrase,
  encryptJsonWithPassphrase,
} from '../../shared/security/crypto';
import {
  enqueueLocalVaultChange,
  markQueueItemFailed,
  mergeVaultSnapshotsNonDestructively,
  summarizeSnapshot,
} from '../../shared/sync/sync-engine';
import {DEFAULT_SETTINGS, EMPTY_SNAPSHOT, localVaultRepo} from '../db/indexeddb';
import {ConnectivityProbeState, useConnectivity} from '../hooks/useConnectivity';

export type NavPageId =
  | 'overview'
  | 'profiles'
  | 'addresses'
  | 'education'
  | 'employment'
  | 'autofill'
  | 'websites'
  | 'validation'
  | 'history'
  | 'sync'
  | 'backup'
  | 'security'
  | 'settings'
  | 'help';

export interface CloudAccountState {
  id: string;
  email: string;
  remoteVersion: number;
  lastRemoteUpdate: string | null;
}

export interface CloudBackupSummary {
  id: string;
  label: string;
  schemaVersion: string;
  byteSize: number;
  createdAt: string;
  envelope: EncryptedEnvelope;
}

export interface ToastNotice {
  id: string;
  tone: 'success' | 'warning' | 'error' | 'info';
  message: string;
}

interface AppContextValue {
  page: NavPageId;
  setPage: (p: NavPageId) => void;
  ready: boolean;
  isLocked: boolean;
  settings: AppSettings;
  t: ReturnType<typeof getDictionary>;
  snapshot: VaultDataSnapshot;
  adapters: WebsiteAdapterSpec[];
  activeProfileId: string | null;
  setActiveProfileId: (id: string | null) => void;
  activeProfile: ProfileRecord | null;

  // CRUD
  upsertProfile: (profile: Omit<ProfileRecord, 'id' | 'schemaVersion' | 'version' | 'createdAt' | 'updatedAt'> & {id?: string}) => Promise<ProfileRecord>;
  duplicateProfile: (profileId: string) => Promise<void>;
  deleteProfile: (profileId: string) => Promise<void>;
  setDefaultProfile: (profileId: string) => Promise<void>;
  upsertAddress: (addr: Omit<AddressRecord, 'id' | 'schemaVersion' | 'version' | 'createdAt' | 'updatedAt'> & {id?: string}) => Promise<void>;
  deleteAddress: (id: string) => Promise<void>;
  upsertEducation: (edu: Omit<EducationRecord, 'id' | 'schemaVersion' | 'version' | 'createdAt' | 'updatedAt'> & {id?: string}) => Promise<void>;
  deleteEducation: (id: string) => Promise<void>;
  upsertEmployment: (emp: Omit<EmploymentRecord, 'id' | 'schemaVersion' | 'version' | 'createdAt' | 'updatedAt'> & {id?: string}) => Promise<void>;
  deleteEmployment: (id: string) => Promise<void>;
  recordSession: (session: Omit<AutofillSessionRecord, 'id' | 'schemaVersion'>) => Promise<void>;
  clearSessions: () => Promise<void>;

  // Adapters & Settings
  toggleAdapterEnabled: (adapterId: string, enabled: boolean) => Promise<void>;
  checkRemoteAdapterUpdates: () => Promise<{checked: boolean; message: string}>;
  updateSettings: (partial: Partial<AppSettings>) => Promise<void>;
  resetPreferences: () => Promise<void>;

  // Security & Backup
  enableOrChangePassphrase: (passphrase: string) => Promise<void>;
  lockVaultNow: () => void;
  unlockVault: (passphrase: string) => Promise<boolean>;
  restoreSnapshot: (incoming: VaultDataSnapshot, strategy: 'skip' | 'merge' | 'replace') => Promise<void>;
  eraseAllLocalData: () => Promise<void>;

  // Hybrid Sync & Connectivity
  connectivity: ConnectivityProbeState;
  connectivityBadgeState: ConnectivityState;
  checkConnectivity: () => Promise<boolean>;
  syncQueue: SyncQueueItem[];
  syncConflicts: SyncConflictRecord[];
  isSyncing: boolean;
  cloudAccount: CloudAccountState | null;
  cloudBackups: CloudBackupSummary[];
  pendingDownloadCount: number;
  cloudAuthLogin: (email: string, password: string) => Promise<void>;
  cloudAuthRegister: (email: string, password: string, recoveryHint?: string) => Promise<void>;
  cloudAuthLogout: () => Promise<void>;
  cloudDeleteAccount: () => Promise<void>;
  refreshCloudState: () => Promise<void>;
  runEncryptedSyncNow: (encryptionPassphrase: string) => Promise<void>;
  uploadEncryptedCloudBackup: (label: string, encryptionPassphrase: string) => Promise<void>;
  restoreCloudBackup: (backup: CloudBackupSummary, encryptionPassphrase: string) => Promise<void>;
  deleteCloudBackup: (backupId: string) => Promise<void>;
  resolveSyncConflict: (
    conflictId: string,
    choice: 'keep_local' | 'keep_remote' | 'merge_both',
    encryptionPassphrase: string,
  ) => Promise<void>;

  // Notifications
  notices: ToastNotice[];
  pushNotice: (tone: ToastNotice['tone'], message: string) => void;
  dismissNotice: (id: string) => void;
}

const AppContext = createContext<AppContextValue | null>(null);

function makeId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export const AppProvider: React.FC<{children: React.ReactNode}> = ({children}) => {
  const [page, setPage] = useState<NavPageId>('overview');
  const [ready, setReady] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [snapshot, setSnapshot] = useState<VaultDataSnapshot>(EMPTY_SNAPSHOT);
  const [adapters, setAdapters] = useState<WebsiteAdapterSpec[]>([]);
  const [activeProfileId, setActiveProfileId] = useState<string | null>(null);
  const [syncQueue, setSyncQueue] = useState<SyncQueueItem[]>([]);
  const [syncConflicts, setSyncConflicts] = useState<SyncConflictRecord[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [cloudAccount, setCloudAccount] = useState<CloudAccountState | null>(null);
  const [cloudBackups, setCloudBackups] = useState<CloudBackupSummary[]>([]);
  const [notices, setNotices] = useState<ToastNotice[]>([]);

  const sessionTokenRef = useRef<string | null>(null);
  const lastActivityRef = useRef<number>(Date.now());
  const settingsRef = useRef<AppSettings>(settings);
  settingsRef.current = settings;

  const {connectivity, checkConnectivity} = useConnectivity(settings.cloudSyncEnabled);

  const pushNotice = useCallback((tone: ToastNotice['tone'], message: string) => {
    const id = makeId('toast');
    setNotices((prev) => [...prev.slice(-3), {id, tone, message}]);
    window.setTimeout(() => {
      setNotices((prev) => prev.filter((n) => n.id !== id));
    }, 5200);
  }, []);

  const dismissNotice = useCallback((id: string) => {
    setNotices((prev) => prev.filter((n) => n.id !== id));
  }, []);

  // Theme application
  useEffect(() => {
    const applyTheme = (mode: ThemeMode) => {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      const useDark = mode === 'dark' || (mode === 'system' && prefersDark);
      document.documentElement.classList.toggle('dark', useDark);
      const metaTheme = document.querySelector('meta[name="theme-color"]');
      if (metaTheme) {
        metaTheme.setAttribute('content', useDark ? '#0B0F0E' : '#F6F8F7');
      }
    };
    applyTheme(settings.theme);
    if (settings.theme === 'system') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      const onChange = () => applyTheme('system');
      mq.addEventListener('change', onChange);
      return () => mq.removeEventListener('change', onChange);
    }
  }, [settings.theme]);

  // Set <html lang>
  useEffect(() => {
    document.documentElement.lang = settings.language;
  }, [settings.language]);

  // Initial load from IndexedDB (100% offline-first!)
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [loadedSettings, loadedAdapters, loadedQueue, loadedConflicts] = await Promise.all([
          localVaultRepo.loadSettings(),
          localVaultRepo.loadAdapters(),
          localVaultRepo.loadSyncQueue(),
          localVaultRepo.loadSyncConflicts(),
        ]);
        if (!mounted) return;
        setSettings(loadedSettings);
        setAdapters(loadedAdapters);
        setSyncQueue(loadedQueue);
        setSyncConflicts(loadedConflicts);

        if (loadedSettings.encryptionEnabled) {
          setIsLocked(true);
        } else {
          const snap = await localVaultRepo.loadVaultSnapshot(loadedSettings);
          if (!mounted) return;
          setSnapshot(snap);
          const def =
            snap.profiles.find((p) => p.id === loadedSettings.defaultProfileId) ||
            snap.profiles.find((p) => p.isDefault) ||
            snap.profiles[0] ||
            null;
          setActiveProfileId(def?.id || null);
        }
      } catch {
        if (mounted) {
          pushNotice('error', 'Failed to open local IndexedDB vault.');
        }
      } finally {
        if (mounted) setReady(true);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [pushNotice]);

  // Auto-lock inactivity monitor when encryption is enabled
  useEffect(() => {
    if (!settings.encryptionEnabled || isLocked || settings.autoLockMinutes <= 0) return;
    const markActivity = () => {
      lastActivityRef.current = Date.now();
    };
    window.addEventListener('pointerdown', markActivity, {passive: true});
    window.addEventListener('keydown', markActivity, {passive: true});
    const timer = window.setInterval(() => {
      const idleMs = Date.now() - lastActivityRef.current;
      if (idleMs >= settings.autoLockMinutes * 60 * 1000) {
        localVaultRepo.lockVault();
        setSnapshot(EMPTY_SNAPSHOT);
        setIsLocked(true);
      }
    }, 15_000);
    return () => {
      window.removeEventListener('pointerdown', markActivity);
      window.removeEventListener('keydown', markActivity);
      window.clearInterval(timer);
    };
  }, [settings.encryptionEnabled, settings.autoLockMinutes, isLocked]);

  // Persist snapshot helper + local change queue tracking
  const commitSnapshot = useCallback(
    async (nextSnap: VaultDataSnapshot, nextSettingsOverride?: AppSettings) => {
      const currentSettings = nextSettingsOverride || settings;
      const nextLocalVersion = (currentSettings.localSyncVersion || 0) + 1;
      const updatedSettings: AppSettings = {
        ...currentSettings,
        localSyncVersion: nextLocalVersion,
      };
      await localVaultRepo.saveVaultSnapshot(nextSnap, updatedSettings);
      await localVaultRepo.saveSettings(updatedSettings);
      setSnapshot(nextSnap);
      setSettings(updatedSettings);

      if (updatedSettings.cloudSyncEnabled) {
        const nextQueue = enqueueLocalVaultChange(
          syncQueue,
          cloudAccount?.remoteVersion || 0,
          nextLocalVersion,
        );
        await localVaultRepo.saveSyncQueue(nextQueue);
        setSyncQueue(nextQueue);
      }
    },
    [settings, syncQueue, cloudAccount],
  );

  // --- Profile CRUD ---
  const upsertProfile: AppContextValue['upsertProfile'] = useCallback(
    async (input) => {
      const now = new Date().toISOString();
      const existing = input.id ? snapshot.profiles.find((p) => p.id === input.id) : undefined;
      let record: ProfileRecord;
      let profiles: ProfileRecord[];

      if (existing) {
        record = {
          ...existing,
          profileName: input.profileName,
          personalInformation: input.personalInformation,
          isDefault: input.isDefault,
          version: existing.version + 1,
          updatedAt: now,
        };
        profiles = snapshot.profiles.map((p) => {
          if (p.id === record.id) return record;
          return record.isDefault ? {...p, isDefault: false} : p;
        });
      } else {
        const makeDefault = input.isDefault || snapshot.profiles.length === 0;
        record = {
          id: makeId('prof'),
          schemaVersion: SCHEMA_VERSION,
          profileName: input.profileName,
          personalInformation: input.personalInformation,
          isDefault: makeDefault,
          version: 1,
          createdAt: now,
          updatedAt: now,
        };
        profiles = [
          ...snapshot.profiles.map((p) => (makeDefault ? {...p, isDefault: false} : p)),
          record,
        ];
      }

      const nextSettings = record.isDefault
        ? {...settings, defaultProfileId: record.id}
        : settings;

      await commitSnapshot({...snapshot, profiles}, nextSettings);
      setActiveProfileId(record.id);
      return record;
    },
    [snapshot, settings, commitSnapshot],
  );

  const duplicateProfile = useCallback(
    async (profileId: string) => {
      const src = snapshot.profiles.find((p) => p.id === profileId);
      if (!src) return;
      const now = new Date().toISOString();
      const newId = makeId('prof');
      const copy: ProfileRecord = {
        ...structuredClone(src),
        id: newId,
        profileName: `${src.profileName} (Copy)`,
        isDefault: false,
        version: 1,
        createdAt: now,
        updatedAt: now,
      };
      const copiedAddrs = snapshot.addresses
        .filter((a) => a.profileId === profileId)
        .map((a) => ({...structuredClone(a), id: makeId('addr'), profileId: newId, createdAt: now, updatedAt: now}));
      const copiedEdus = snapshot.educations
        .filter((e) => e.profileId === profileId)
        .map((e) => ({...structuredClone(e), id: makeId('edu'), profileId: newId, createdAt: now, updatedAt: now}));
      const copiedEmps = snapshot.employments
        .filter((e) => e.profileId === profileId)
        .map((e) => ({...structuredClone(e), id: makeId('emp'), profileId: newId, createdAt: now, updatedAt: now}));

      await commitSnapshot({
        ...snapshot,
        profiles: [...snapshot.profiles, copy],
        addresses: [...snapshot.addresses, ...copiedAddrs],
        educations: [...snapshot.educations, ...copiedEdus],
        employments: [...snapshot.employments, ...copiedEmps],
      });
      setActiveProfileId(newId);
    },
    [snapshot, commitSnapshot],
  );

  const deleteProfile = useCallback(
    async (profileId: string) => {
      const remaining = snapshot.profiles.filter((p) => p.id !== profileId);
      if (remaining.length > 0 && !remaining.some((p) => p.isDefault)) {
        remaining[0] = {...remaining[0], isDefault: true};
      }
      const nextDefaultId = remaining.find((p) => p.isDefault)?.id || null;
      await commitSnapshot(
        {
          ...snapshot,
          profiles: remaining,
          addresses: snapshot.addresses.filter((a) => a.profileId !== profileId),
          educations: snapshot.educations.filter((e) => e.profileId !== profileId),
          employments: snapshot.employments.filter((e) => e.profileId !== profileId),
        },
        {...settings, defaultProfileId: nextDefaultId},
      );
      if (activeProfileId === profileId) {
        setActiveProfileId(nextDefaultId);
      }
    },
    [snapshot, settings, activeProfileId, commitSnapshot],
  );

  const setDefaultProfile = useCallback(
    async (profileId: string) => {
      const profiles = snapshot.profiles.map((p) => ({
        ...p,
        isDefault: p.id === profileId,
        updatedAt: p.id === profileId ? new Date().toISOString() : p.updatedAt,
      }));
      await commitSnapshot({...snapshot, profiles}, {...settings, defaultProfileId: profileId});
      setActiveProfileId(profileId);
    },
    [snapshot, settings, commitSnapshot],
  );

  // --- Address CRUD (with Same-as-Present sync!) ---
  const upsertAddress: AppContextValue['upsertAddress'] = useCallback(
    async (input) => {
      const now = new Date().toISOString();
      const existing = input.id
        ? snapshot.addresses.find((a) => a.id === input.id)
        : snapshot.addresses.find(
            (a) => a.profileId === input.profileId && a.addressType === input.addressType,
          );

      let saved: AddressRecord;
      if (existing) {
        saved = {
          ...existing,
          ...input,
          id: existing.id,
          version: existing.version + 1,
          updatedAt: now,
        };
      } else {
        saved = {
          ...input,
          id: makeId('addr'),
          schemaVersion: SCHEMA_VERSION,
          version: 1,
          createdAt: now,
          updatedAt: now,
        };
      }

      let nextAddresses = existing
        ? snapshot.addresses.map((a) => (a.id === saved.id ? saved : a))
        : [...snapshot.addresses, saved];

      // Sync Permanent address automatically if it has sameAsPresent=true and Present was edited
      if (saved.addressType === 'present') {
        nextAddresses = nextAddresses.map((a) =>
          a.profileId === saved.profileId && a.addressType === 'permanent' && a.sameAsPresent
            ? {
                ...a,
                careOf: saved.careOf,
                village: saved.village,
                road: saved.road,
                house: saved.house,
                district: saved.district,
                upazila: saved.upazila,
                postOffice: saved.postOffice,
                postCode: saved.postCode,
                updatedAt: now,
              }
            : a,
        );
      }

      await commitSnapshot({...snapshot, addresses: nextAddresses});
    },
    [snapshot, commitSnapshot],
  );

  const deleteAddress = useCallback(
    async (id: string) => {
      await commitSnapshot({
        ...snapshot,
        addresses: snapshot.addresses.filter((a) => a.id !== id),
      });
    },
    [snapshot, commitSnapshot],
  );

  // --- Education CRUD ---
  const upsertEducation: AppContextValue['upsertEducation'] = useCallback(
    async (input) => {
      const now = new Date().toISOString();
      const existing = input.id ? snapshot.educations.find((e) => e.id === input.id) : undefined;
      const saved: EducationRecord = existing
        ? {...existing, ...input, id: existing.id, version: existing.version + 1, updatedAt: now}
        : {
            ...input,
            id: makeId('edu'),
            schemaVersion: SCHEMA_VERSION,
            version: 1,
            createdAt: now,
            updatedAt: now,
          };
      const next = existing
        ? snapshot.educations.map((e) => (e.id === saved.id ? saved : e))
        : [...snapshot.educations, saved];
      await commitSnapshot({...snapshot, educations: next});
    },
    [snapshot, commitSnapshot],
  );

  const deleteEducation = useCallback(
    async (id: string) => {
      await commitSnapshot({
        ...snapshot,
        educations: snapshot.educations.filter((e) => e.id !== id),
      });
    },
    [snapshot, commitSnapshot],
  );

  // --- Employment CRUD ---
  const upsertEmployment: AppContextValue['upsertEmployment'] = useCallback(
    async (input) => {
      const now = new Date().toISOString();
      const existing = input.id ? snapshot.employments.find((e) => e.id === input.id) : undefined;
      const saved: EmploymentRecord = existing
        ? {...existing, ...input, id: existing.id, version: existing.version + 1, updatedAt: now}
        : {
            ...input,
            id: makeId('emp'),
            schemaVersion: SCHEMA_VERSION,
            version: 1,
            createdAt: now,
            updatedAt: now,
          };
      const next = existing
        ? snapshot.employments.map((e) => (e.id === saved.id ? saved : e))
        : [...snapshot.employments, saved];
      await commitSnapshot({...snapshot, employments: next});
    },
    [snapshot, commitSnapshot],
  );

  const deleteEmployment = useCallback(
    async (id: string) => {
      await commitSnapshot({
        ...snapshot,
        employments: snapshot.employments.filter((e) => e.id !== id),
      });
    },
    [snapshot, commitSnapshot],
  );

  // --- Session History (Never stores sensitive values) ---
  const recordSession: AppContextValue['recordSession'] = useCallback(
    async (input) => {
      if (!settings.saveSessionHistory) return;
      const entry: AutofillSessionRecord = {
        ...input,
        id: makeId('sess'),
        schemaVersion: SCHEMA_VERSION,
      };
      const nextSessions = [entry, ...snapshot.sessions].slice(0, 100);
      await commitSnapshot({...snapshot, sessions: nextSessions});
    },
    [settings.saveSessionHistory, snapshot, commitSnapshot],
  );

  const clearSessions = useCallback(async () => {
    await commitSnapshot({...snapshot, sessions: []});
  }, [snapshot, commitSnapshot]);

  // --- Adapters & Settings ---
  const toggleAdapterEnabled = useCallback(
    async (adapterId: string, enabled: boolean) => {
      const next = adapters.map((a) => (a.id === adapterId ? {...a, enabled} : a));
      await localVaultRepo.saveAdapters(next);
      setAdapters(next);
      const permittedDomains = next.filter((a) => a.enabled).map((a) => a.domain);
      const nextSettings = {...settings, permittedDomains};
      await localVaultRepo.saveSettings(nextSettings);
      setSettings(nextSettings);
    },
    [adapters, settings],
  );

  const checkRemoteAdapterUpdates = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/adapters', {cache: 'no-store'});
      if (!res.ok) throw new Error('UNREACHABLE');
      const data = await res.json();
      const merged = mergeRemoteAdapters(adapters, data.adapters || []);
      await localVaultRepo.saveAdapters(merged);
      setAdapters(merged);
      return {
        checked: true,
        message: `Verified ${merged.length} adapter(s) against remote registry (${data.schemaVersion}).`,
      };
    } catch {
      return {
        checked: false,
        message: 'Could not reach remote adapter registry; continuing with local built-in adapters.',
      };
    }
  }, [adapters]);

  const updateSettings = useCallback(async (partial: Partial<AppSettings>) => {
    const next: AppSettings = {...settingsRef.current, ...partial};
    settingsRef.current = next;
    setSettings(next);
    await localVaultRepo.saveSettings(next);
  }, []);

  const resetPreferences = useCallback(async () => {
    const preserved: AppSettings = {
      ...DEFAULT_SETTINGS,
      encryptionEnabled: settings.encryptionEnabled,
      vaultSalt: settings.vaultSalt,
      vaultVerifier: settings.vaultVerifier,
      localSyncVersion: settings.localSyncVersion,
      lastSyncedAt: settings.lastSyncedAt,
      defaultProfileId: settings.defaultProfileId,
    };
    await localVaultRepo.saveSettings(preserved);
    setSettings(preserved);
  }, [settings]);

  // --- Security & Backup ---
  const enableOrChangePassphrase = useCallback(
    async (passphrase: string) => {
      const updated = await localVaultRepo.enableOrUpdateEncryption(passphrase, snapshot, settings);
      setSettings(updated);
      setIsLocked(false);
    },
    [snapshot, settings],
  );

  const lockVaultNow = useCallback(() => {
    if (!settings.encryptionEnabled) return;
    localVaultRepo.lockVault();
    setSnapshot(EMPTY_SNAPSHOT);
    setIsLocked(true);
  }, [settings.encryptionEnabled]);

  const unlockVault = useCallback(
    async (passphrase: string): Promise<boolean> => {
      try {
        const snap = await localVaultRepo.unlockWithPassphrase(passphrase, settings);
        setSnapshot(snap);
        setIsLocked(false);
        const def =
          snap.profiles.find((p) => p.id === settings.defaultProfileId) ||
          snap.profiles.find((p) => p.isDefault) ||
          snap.profiles[0] ||
          null;
        setActiveProfileId(def?.id || null);
        lastActivityRef.current = Date.now();
        return true;
      } catch {
        return false;
      }
    },
    [settings],
  );

  const restoreSnapshot = useCallback(
    async (incoming: VaultDataSnapshot, strategy: 'skip' | 'merge' | 'replace') => {
      let next: VaultDataSnapshot;
      if (strategy === 'replace') {
        next = incoming;
      } else if (strategy === 'merge') {
        next = mergeVaultSnapshotsNonDestructively(snapshot, incoming);
      } else {
        const skipMerge = <T extends {id: string}>(curr: T[], inc: T[]) => {
          const ids = new Set(curr.map((c) => c.id));
          return [...curr, ...inc.filter((i) => !ids.has(i.id))];
        };
        next = {
          profiles: skipMerge(snapshot.profiles, incoming.profiles),
          addresses: skipMerge(snapshot.addresses, incoming.addresses),
          educations: skipMerge(snapshot.educations, incoming.educations),
          employments: skipMerge(snapshot.employments, incoming.employments),
          sessions: skipMerge(snapshot.sessions, incoming.sessions),
        };
      }
      await commitSnapshot(next);
      const def = next.profiles.find((p) => p.isDefault) || next.profiles[0] || null;
      setActiveProfileId(def?.id || null);
    },
    [snapshot, commitSnapshot],
  );

  const eraseAllLocalData = useCallback(async () => {
    await localVaultRepo.eraseAllLocalData();
    setSnapshot(EMPTY_SNAPSHOT);
    setSettings(DEFAULT_SETTINGS);
    setSyncQueue([]);
    setSyncConflicts([]);
    setActiveProfileId(null);
    setIsLocked(false);
  }, []);

  // --- Optional Cloud Backend Helpers ---
  const authHeaders = useCallback((): Record<string, string> => {
    const h: Record<string, string> = {'Content-Type': 'application/json'};
    if (sessionTokenRef.current) {
      h.Authorization = `Bearer ${sessionTokenRef.current}`;
    }
    return h;
  }, []);

  const refreshCloudState = useCallback(async () => {
    if (!settings.cloudSyncEnabled) return;
    const reachable = await checkConnectivity();
    if (!reachable) return;
    try {
      const meRes = await fetch('/api/v1/auth/me', {
        credentials: 'include',
        headers: authHeaders(),
      });
      if (!meRes.ok) {
        setCloudAccount(null);
        setCloudBackups([]);
        return;
      }
      const meData = await meRes.json();
      setCloudAccount({
        id: meData.account.id,
        email: meData.account.email,
        remoteVersion: meData.remoteVersion || 0,
        lastRemoteUpdate: meData.lastRemoteUpdate || null,
      });

      const bRes = await fetch('/api/v1/backups', {
        credentials: 'include',
        headers: authHeaders(),
      });
      if (bRes.ok) {
        const bData = await bRes.json();
        setCloudBackups(bData.backups || []);
      }
    } catch {
      // Remain graceful offline
    }
  }, [settings.cloudSyncEnabled, checkConnectivity, authHeaders]);

  useEffect(() => {
    if (settings.cloudSyncEnabled && connectivity.apiReachable) {
      void refreshCloudState();
    }
  }, [settings.cloudSyncEnabled, connectivity.apiReachable, refreshCloudState]);

  const cloudAuthRegister = useCallback(
    async (email: string, password: string, recoveryHint?: string) => {
      const res = await fetch('/api/v1/auth/register', {
        method: 'POST',
        credentials: 'include',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({email, password, recoveryHint}),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Registration failed');
      sessionTokenRef.current = data.sessionToken || null;
      setCloudAccount({
        id: data.account.id,
        email: data.account.email,
        remoteVersion: 0,
        lastRemoteUpdate: null,
      });
      await updateSettings({cloudSyncEnabled: true});
      await refreshCloudState();
    },
    [updateSettings, refreshCloudState],
  );

  const cloudAuthLogin = useCallback(
    async (email: string, password: string) => {
      const res = await fetch('/api/v1/auth/login', {
        method: 'POST',
        credentials: 'include',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({email, password}),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Sign in failed');
      sessionTokenRef.current = data.sessionToken || null;
      await updateSettings({cloudSyncEnabled: true});
      await refreshCloudState();
    },
    [updateSettings, refreshCloudState],
  );

  const cloudAuthLogout = useCallback(async () => {
    try {
      await fetch('/api/v1/auth/logout', {
        method: 'POST',
        credentials: 'include',
        headers: authHeaders(),
      });
    } finally {
      sessionTokenRef.current = null;
      setCloudAccount(null);
      setCloudBackups([]);
    }
  }, [authHeaders]);

  const cloudDeleteAccount = useCallback(async () => {
    const res = await fetch('/api/v1/account', {
      method: 'DELETE',
      credentials: 'include',
      headers: authHeaders(),
    });
    if (!res.ok) throw new Error('Failed to delete cloud account.');
    sessionTokenRef.current = null;
    setCloudAccount(null);
    setCloudBackups([]);
    await localVaultRepo.saveSyncQueue([]);
    await localVaultRepo.saveSyncConflicts([]);
    setSyncQueue([]);
    setSyncConflicts([]);
  }, [authHeaders]);

  const runEncryptedSyncNow = useCallback(
    async (encryptionPassphrase: string) => {
      if (!settings.cloudSyncEnabled) {
        throw new Error('Cloud sync is currently disabled.');
      }
      if (!cloudAccount) {
        throw new Error('Sign in to an optional cloud account first.');
      }
      if (!encryptionPassphrase || encryptionPassphrase.length < 6) {
        throw new Error('An encryption passphrase (min 6 chars) is mandatory before cloud upload.');
      }
      const reachable = await checkConnectivity();
      if (!reachable) {
        throw new Error('Cloud API unreachable. Changes stay queued safely offline.');
      }

      setIsSyncing(true);
      try {
        // Strictly encrypt client-side via AES-GCM before leaving device
        const envelope = await encryptJsonWithPassphrase(snapshot, encryptionPassphrase);
        const pendingItem = syncQueue[0];
        const baseVersion = pendingItem?.baseVersion ?? cloudAccount.remoteVersion;
        const idempotencyKey =
          pendingItem?.idempotencyKey || `vault-v${settings.localSyncVersion}-${Date.now()}`;

        const res = await fetch('/api/v1/sync/push', {
          method: 'POST',
          credentials: 'include',
          headers: authHeaders(),
          body: JSON.stringify({baseVersion, idempotencyKey, envelope}),
        });
        const data = await res.json();

        if (res.status === 409 && data.remoteEnvelope) {
          // Preserve both versions without silently overwriting!
          const conflict: SyncConflictRecord = {
            id: makeId('conflict'),
            detectedAt: new Date().toISOString(),
            localVersion: settings.localSyncVersion,
            remoteVersion: data.remoteVersion,
            localUpdatedAt: new Date().toISOString(),
            remoteUpdatedAt: data.remoteUpdatedAt,
            localSummary: summarizeSnapshot(snapshot),
            remoteEnvelope: data.remoteEnvelope,
            resolved: false,
          };
          const nextConflicts = [...syncConflicts, conflict];
          await localVaultRepo.saveSyncConflicts(nextConflicts);
          setSyncConflicts(nextConflicts);
          throw new Error('SYNC_CONFLICT');
        }

        if (!res.ok) {
          throw new Error(data.message || 'Sync upload failed.');
        }

        await localVaultRepo.saveSyncQueue([]);
        setSyncQueue([]);
        const syncedAt = data.updatedAt || new Date().toISOString();
        const nextSettings: AppSettings = {
          ...settings,
          localSyncVersion: data.version,
          lastSyncedAt: syncedAt,
        };
        await localVaultRepo.saveSettings(nextSettings);
        setSettings(nextSettings);
        setCloudAccount((prev) =>
          prev ? {...prev, remoteVersion: data.version, lastRemoteUpdate: syncedAt} : prev,
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Sync failed';
        if (msg !== 'SYNC_CONFLICT' && syncQueue.length > 0) {
          const updatedQ = syncQueue.map((item, idx) =>
            idx === 0 ? markQueueItemFailed(item, msg) : item,
          );
          await localVaultRepo.saveSyncQueue(updatedQ);
          setSyncQueue(updatedQ);
        }
        throw err;
      } finally {
        setIsSyncing(false);
      }
    },
    [settings, cloudAccount, checkConnectivity, snapshot, syncQueue, syncConflicts, authHeaders],
  );

  const uploadEncryptedCloudBackup = useCallback(
    async (label: string, encryptionPassphrase: string) => {
      if (!cloudAccount) throw new Error('Sign in first to upload cloud backup.');
      const envelope = await encryptJsonWithPassphrase(snapshot, encryptionPassphrase);
      const res = await fetch('/api/v1/backups', {
        method: 'POST',
        credentials: 'include',
        headers: authHeaders(),
        body: JSON.stringify({label, envelope}),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Cloud backup upload failed.');
      await refreshCloudState();
    },
    [cloudAccount, snapshot, authHeaders, refreshCloudState],
  );

  const restoreCloudBackup = useCallback(
    async (backup: CloudBackupSummary, encryptionPassphrase: string) => {
      const decrypted = await decryptJsonWithPassphrase<VaultDataSnapshot>(
        backup.envelope,
        encryptionPassphrase,
      );
      await restoreSnapshot(decrypted, 'merge');
    },
    [restoreSnapshot],
  );

  const deleteCloudBackup = useCallback(
    async (backupId: string) => {
      const res = await fetch(`/api/v1/backups/${encodeURIComponent(backupId)}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: authHeaders(),
      });
      if (!res.ok) throw new Error('Failed to delete cloud backup.');
      await refreshCloudState();
    },
    [authHeaders, refreshCloudState],
  );

  const resolveSyncConflict = useCallback(
    async (
      conflictId: string,
      choice: 'keep_local' | 'keep_remote' | 'merge_both',
      encryptionPassphrase: string,
    ) => {
      const target = syncConflicts.find((c) => c.id === conflictId);
      if (!target) return;

      let resolvedSnapshot = snapshot;
      if (choice === 'keep_remote' || choice === 'merge_both') {
        const remoteSnap = await decryptJsonWithPassphrase<VaultDataSnapshot>(
          target.remoteEnvelope,
          encryptionPassphrase,
        );
        resolvedSnapshot =
          choice === 'keep_remote'
            ? remoteSnap
            : mergeVaultSnapshotsNonDestructively(snapshot, remoteSnap);
        await localVaultRepo.saveVaultSnapshot(resolvedSnapshot, settings);
        setSnapshot(resolvedSnapshot);
      }

      if (choice === 'keep_local' || choice === 'merge_both') {
        const envelope = await encryptJsonWithPassphrase(resolvedSnapshot, encryptionPassphrase);
        const res = await fetch('/api/v1/sync/push', {
          method: 'POST',
          credentials: 'include',
          headers: authHeaders(),
          body: JSON.stringify({
            baseVersion: target.remoteVersion,
            idempotencyKey: `resolve-${conflictId}-${Date.now()}`,
            envelope,
            forceResolve: true,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Conflict resolution push failed.');
        const nextSettings = {
          ...settings,
          localSyncVersion: data.version,
          lastSyncedAt: data.updatedAt,
        };
        await localVaultRepo.saveSettings(nextSettings);
        setSettings(nextSettings);
        setCloudAccount((prev) =>
          prev ? {...prev, remoteVersion: data.version, lastRemoteUpdate: data.updatedAt} : prev,
        );
      } else {
        const nextSettings = {
          ...settings,
          localSyncVersion: target.remoteVersion,
          lastSyncedAt: new Date().toISOString(),
        };
        await localVaultRepo.saveSettings(nextSettings);
        setSettings(nextSettings);
      }

      const remainingConflicts = syncConflicts.filter((c) => c.id !== conflictId);
      await localVaultRepo.saveSyncConflicts(remainingConflicts);
      await localVaultRepo.saveSyncQueue([]);
      setSyncConflicts(remainingConflicts);
      setSyncQueue([]);
    },
    [syncConflicts, snapshot, settings, authHeaders],
  );

  const activeProfile = useMemo(
    () =>
      snapshot.profiles.find((p) => p.id === activeProfileId) ||
      snapshot.profiles.find((p) => p.isDefault) ||
      snapshot.profiles[0] ||
      null,
    [snapshot.profiles, activeProfileId],
  );

  const pendingDownloadCount = useMemo(() => {
    if (!settings.cloudSyncEnabled || !cloudAccount) return 0;
    return cloudAccount.remoteVersion > settings.localSyncVersion
      ? cloudAccount.remoteVersion - settings.localSyncVersion
      : 0;
  }, [settings.cloudSyncEnabled, settings.localSyncVersion, cloudAccount]);

  const connectivityBadgeState: ConnectivityState = useMemo(() => {
    if (!connectivity.browserOnline || !connectivity.apiReachable) return 'offline';
    if (isSyncing) return 'syncing';
    if (syncConflicts.length > 0 || syncQueue.some((q) => Boolean(q.lastError))) return 'sync_failed';
    if (settings.cloudSyncEnabled && (syncQueue.length > 0 || pendingDownloadCount > 0)) {
      return 'sync_required';
    }
    return 'online';
  }, [
    connectivity.browserOnline,
    connectivity.apiReachable,
    isSyncing,
    syncConflicts.length,
    syncQueue,
    settings.cloudSyncEnabled,
    pendingDownloadCount,
  ]);

  const t = useMemo(() => getDictionary(settings.language), [settings.language]);

  const value: AppContextValue = {
    page,
    setPage,
    ready,
    isLocked,
    settings,
    t,
    snapshot,
    adapters,
    activeProfileId: activeProfile?.id || null,
    setActiveProfileId,
    activeProfile,
    upsertProfile,
    duplicateProfile,
    deleteProfile,
    setDefaultProfile,
    upsertAddress,
    deleteAddress,
    upsertEducation,
    deleteEducation,
    upsertEmployment,
    deleteEmployment,
    recordSession,
    clearSessions,
    toggleAdapterEnabled,
    checkRemoteAdapterUpdates,
    updateSettings,
    resetPreferences,
    enableOrChangePassphrase,
    lockVaultNow,
    unlockVault,
    restoreSnapshot,
    eraseAllLocalData,
    connectivity,
    connectivityBadgeState,
    checkConnectivity,
    syncQueue,
    syncConflicts,
    isSyncing,
    cloudAccount,
    cloudBackups,
    pendingDownloadCount,
    cloudAuthLogin,
    cloudAuthRegister,
    cloudAuthLogout,
    cloudDeleteAccount,
    refreshCloudState,
    runEncryptedSyncNow,
    uploadEncryptedCloudBackup,
    restoreCloudBackup,
    deleteCloudBackup,
    resolveSyncConflict,
    notices,
    pushNotice,
    dismissNotice,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}
