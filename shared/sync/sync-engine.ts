import {
  SyncConflictRecord,
  SyncQueueItem,
  VaultDataSnapshot,
} from '../schemas/types';

export const MAX_BACKOFF_MS = 60_000;
export const BASE_BACKOFF_MS = 1_500;

/**
 * Computes bounded exponential backoff delay in ms for failed sync retries.
 */
export function computeBackoffDelayMs(retryCount: number): number {
  const safeCount = Math.max(0, Math.min(retryCount, 10));
  return Math.min(MAX_BACKOFF_MS, BASE_BACKOFF_MS * Math.pow(2, safeCount));
}

/**
 * Creates or coalesces an idempotent pending sync queue item for local vault changes.
 * Prevents duplicate upload entries when editing multiple fields offline.
 */
export function enqueueLocalVaultChange(
  existingQueue: SyncQueueItem[],
  baseVersion: number,
  localVersion: number,
): SyncQueueItem[] {
  const now = new Date().toISOString();
  const idempotencyKey = `vault-v${localVersion}-from-${baseVersion}`;

  // Coalesce into a single pending snapshot upsert while preserving earliest baseVersion
  const existing = existingQueue.find((q) => q.entityType === 'vault_snapshot');
  if (existing) {
    return [
      {
        ...existing,
        idempotencyKey: `vault-v${localVersion}-from-${existing.baseVersion}`,
        localVersion,
        nextRetryAt: null,
        lastError: null,
      },
    ];
  }

  return [
    {
      id: `sync-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      idempotencyKey,
      entityType: 'vault_snapshot',
      operation: 'UPSERT',
      baseVersion,
      localVersion,
      createdAt: now,
      retryCount: 0,
      nextRetryAt: null,
      lastError: null,
    },
  ];
}

export function markQueueItemFailed(item: SyncQueueItem, errorMessage: string): SyncQueueItem {
  const retryCount = item.retryCount + 1;
  const delay = computeBackoffDelayMs(retryCount);
  return {
    ...item,
    retryCount,
    nextRetryAt: new Date(Date.now() + delay).toISOString(),
    lastError: errorMessage,
  };
}

/**
 * Checks whether pushing local changes on top of a remote version creates a true conflict.
 * Never silently overwrites a newer remote version.
 */
export function detectVersionConflict(params: {
  baseVersion: number;
  localVersion: number;
  remoteVersion: number;
}): boolean {
  const {baseVersion, localVersion, remoteVersion} = params;
  // Remote moved ahead of the version our local changes were based on, AND we have local edits.
  return remoteVersion > baseVersion && localVersion > baseVersion;
}

/**
 * Deterministically merges two snapshots by ID without duplicating records
 * and keeping the newer `updatedAt` record per ID (or preserving both if user merges).
 */
export function mergeVaultSnapshotsNonDestructively(
  local: VaultDataSnapshot,
  remote: VaultDataSnapshot,
): VaultDataSnapshot {
  const mergeById = <T extends {id: string; updatedAt?: string; timestamp?: string}>(
    a: T[],
    b: T[],
  ): T[] => {
    const map = new Map<string, T>();
    for (const item of b) map.set(item.id, item);
    for (const item of a) {
      const existing = map.get(item.id);
      if (!existing) {
        map.set(item.id, item);
      } else {
        const tA = item.updatedAt || item.timestamp || '';
        const tB = existing.updatedAt || existing.timestamp || '';
        if (tA >= tB) {
          map.set(item.id, item);
        }
      }
    }
    return Array.from(map.values());
  };

  const mergedProfiles = mergeById(local.profiles, remote.profiles);
  // Ensure at most one default profile
  let defaultSeen = false;
  for (const p of mergedProfiles) {
    if (p.isDefault) {
      if (defaultSeen) p.isDefault = false;
      else defaultSeen = true;
    }
  }
  if (!defaultSeen && mergedProfiles.length > 0) {
    mergedProfiles[0].isDefault = true;
  }

  return {
    profiles: mergedProfiles,
    addresses: mergeById(local.addresses, remote.addresses),
    educations: mergeById(local.educations, remote.educations),
    employments: mergeById(local.employments, remote.employments),
    sessions: mergeById(local.sessions, remote.sessions),
  };
}

export function summarizeSnapshot(snapshot: VaultDataSnapshot): SyncConflictRecord['localSummary'] {
  return {
    profiles: snapshot.profiles.length,
    addresses: snapshot.addresses.length,
    educations: snapshot.educations.length,
    employments: snapshot.employments.length,
  };
}
