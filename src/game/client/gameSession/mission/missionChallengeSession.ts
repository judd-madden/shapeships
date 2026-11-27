import { didUnlockAnyMissionFinding } from './missionFindingUnlocks';

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface RecordCompletedMissionFindingIdsResult {
  completedFindingIds: string[];
  didUnlockMissionFinding: boolean;
}

export const MINIMIZE_MISSIONS_STORAGE_KEY = 'shapeships.minimizeMissions.v1';
export const MISSION_FINDINGS_COMPLETED_STORAGE_KEY =
  'shapeships.missionFindingsCompleted.v1';
export const MISSIONS_COMPLETED_STORAGE_KEY =
  'shapeships.missionsCompleted.v1';
export const LORE_UNREAD_STORAGE_KEY = 'shapeships.loreUnread.v1';

function getSessionStorage(): StorageLike | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

function normalizeIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(
      value.filter(
        (id): id is string => typeof id === 'string' && /^[a-z0-9][a-z0-9-]{0,79}$/.test(id),
      ),
    ),
  );
}

const migratedSessions = new WeakSet<StorageLike>();

function readIds(key: string, storage: StorageLike | null): string[] {
  try {
    const raw = storage?.getItem(key);
    return raw ? normalizeIds(JSON.parse(raw)) : [];
  } catch { return []; }
}

function writeIds(key: string, ids: string[], storage: StorageLike | null): boolean {
  if (!storage) return false;
  try {
    if (JSON.stringify(readIds(key, storage)) !== JSON.stringify(ids)) {
      storage.setItem(key, JSON.stringify(ids));
    }
    return true;
  } catch { return false; }
}

/** One attempt per tab/source, shared by default helper reads and the runtime. */
export function migrateMissionProgressStorage(storage: StorageLike | null, sessionStorage: StorageLike | null): void {
  if (!sessionStorage || migratedSessions.has(sessionStorage)) return;
  migratedSessions.add(sessionStorage);
  if (!storage || storage === sessionStorage) return;
  for (const key of [MISSIONS_COMPLETED_STORAGE_KEY, MISSION_FINDINGS_COMPLETED_STORAGE_KEY, LORE_UNREAD_STORAGE_KEY]) {
    try {
      const legacy = sessionStorage.getItem(key);
      if (legacy === null) continue;
      if (key === LORE_UNREAD_STORAGE_KEY) {
        if (legacy === 'true' && storage.getItem(key) !== 'true') storage.setItem(key, 'true');
      } else {
        let ids: string[] = [];
        try { ids = normalizeIds(JSON.parse(legacy)); } catch { /* Malformed legacy lists are empty. */ }
        if (!writeIds(key, normalizeIds([...readIds(key, storage), ...ids]), storage)) continue;
      }
      sessionStorage.removeItem(key);
    } catch { /* Migration must never interrupt navigation or gameplay. */ }
  }
}

function getMissionProgressStorage(): StorageLike | null {
  let storage: StorageLike | null = null;
  try { storage = typeof window === 'undefined' ? null : window.localStorage; } catch { /* Privacy mode. */ }
  migrateMissionProgressStorage(storage, getSessionStorage());
  return storage;
}

function removeIds(key: string, sent: readonly string[], storage: StorageLike | null): void {
  if (!storage || sent.length === 0) return;
  const existing = readIds(key, storage);
  const removed = new Set(sent);
  const remaining = existing.filter(id => !removed.has(id));
  if (remaining.length === existing.length) return;
  try {
    if (remaining.length) storage.setItem(key, JSON.stringify(remaining));
    else storage.removeItem(key);
  } catch { /* Successfully synced progress can be offered again on a later trigger. */ }
}

export function removeSyncedMissionProgress(
  sent: { missions: readonly string[]; findings: readonly string[] },
  storage: StorageLike | null = getMissionProgressStorage(),
): void {
  removeIds(MISSIONS_COMPLETED_STORAGE_KEY, sent.missions, storage);
  removeIds(MISSION_FINDINGS_COMPLETED_STORAGE_KEY, sent.findings, storage);
}

export function clearMissionProgress(storage: StorageLike | null = getMissionProgressStorage()): void {
  removeSyncedMissionProgress({ missions: readCompletedMissionIds(storage), findings: readCompletedMissionFindingIds(storage) }, storage);
  clearLoreUnread(storage);
}

export function readMinimizeMissionsThisSession(
  storage: StorageLike | null = getSessionStorage(),
): boolean {
  if (!storage) return false;
  try {
    return storage.getItem(MINIMIZE_MISSIONS_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

export function writeMinimizeMissionsThisSession(
  enabled: boolean,
  storage: StorageLike | null = getSessionStorage(),
): void {
  if (!storage) return;
  try {
    const value = enabled ? 'true' : 'false';
    if (storage.getItem(MINIMIZE_MISSIONS_STORAGE_KEY) !== value) storage.setItem(MINIMIZE_MISSIONS_STORAGE_KEY, value);
  } catch {
    // Preference remains updated in memory when persistence is unavailable.
  }
}

export function readCompletedMissionFindingIds(
  storage: StorageLike | null = getMissionProgressStorage(),
): string[] {
  return readIds(MISSION_FINDINGS_COMPLETED_STORAGE_KEY, storage);
}

export function readCompletedMissionIds(
  storage: StorageLike | null = getMissionProgressStorage(),
): string[] {
  return readIds(MISSIONS_COMPLETED_STORAGE_KEY, storage);
}

export function recordCompletedMissionId(
  id: string,
  storage: StorageLike | null = getMissionProgressStorage(),
): string[] {
  const completedMissionIds = normalizeIds([
    ...readCompletedMissionIds(storage),
    id,
  ]);
  writeIds(MISSIONS_COMPLETED_STORAGE_KEY, completedMissionIds, storage);

  return completedMissionIds;
}

export function recordCompletedMissionFindingIds(
  ids: readonly string[],
  storage: StorageLike | null = getMissionProgressStorage(),
  displayedFindingIds?: ReadonlySet<string>,
): RecordCompletedMissionFindingIdsResult {
  const existing = readCompletedMissionFindingIds(storage);
  const result = normalizeIds([...existing, ...ids]);
  const hasNewUnlockedFinding = didUnlockAnyMissionFinding(
    displayedFindingIds ?? new Set(existing),
    new Set([...(displayedFindingIds ?? []), ...result]),
  );
  if (!writeIds(MISSION_FINDINGS_COMPLETED_STORAGE_KEY, result, storage)) {
    return {
      completedFindingIds: result,
      didUnlockMissionFinding: false,
    };
  }

  if (hasNewUnlockedFinding) {
    try {
      if (storage && storage.getItem(LORE_UNREAD_STORAGE_KEY) !== 'true') storage.setItem(LORE_UNREAD_STORAGE_KEY, 'true');
    } catch {
      // The completed Finding remains persisted when unread state is unavailable.
    }
  }

  return {
    completedFindingIds: result,
    didUnlockMissionFinding: hasNewUnlockedFinding,
  };
}

export function readLoreUnread(
  storage: StorageLike | null = getMissionProgressStorage(),
): boolean {
  if (!storage) return false;
  try {
    return storage.getItem(LORE_UNREAD_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

export function clearLoreUnread(
  storage: StorageLike | null = getMissionProgressStorage(),
): void {
  if (!storage) return;
  try {
    if (storage.getItem(LORE_UNREAD_STORAGE_KEY) === 'true') storage.setItem(LORE_UNREAD_STORAGE_KEY, 'false');
  } catch {
    // Unread state is presentation-only and must never interrupt navigation.
  }
}
